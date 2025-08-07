-- Enhanced scenario-based step delivery system

-- Add scenario tracking to line_friends
ALTER TABLE line_friends 
ADD COLUMN IF NOT EXISTS scenario_name text,
ADD COLUMN IF NOT EXISTS registration_source text,
ADD COLUMN IF NOT EXISTS campaign_id text;

-- Create step delivery logs table for better tracking
CREATE TABLE IF NOT EXISTS step_delivery_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  step_id uuid REFERENCES steps(id) ON DELETE CASCADE,
  friend_id uuid REFERENCES line_friends(id) ON DELETE CASCADE,
  scenario_id uuid REFERENCES step_scenarios(id) ON DELETE CASCADE,
  delivery_status text NOT NULL DEFAULT 'pending',
  scheduled_at timestamp with time zone,
  delivered_at timestamp with time zone,
  error_message text,
  retry_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE step_delivery_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for step delivery logs
CREATE POLICY "Users can view own delivery logs" 
ON step_delivery_logs 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM step_scenarios ss 
  WHERE ss.id = step_delivery_logs.scenario_id 
  AND ss.user_id = auth.uid()
));

CREATE POLICY "System can manage delivery logs" 
ON step_delivery_logs 
FOR ALL 
USING (true);

-- Enhance step_delivery_tracking with scenario context
ALTER TABLE step_delivery_tracking 
ADD COLUMN IF NOT EXISTS campaign_id text,
ADD COLUMN IF NOT EXISTS registration_source text,
ADD COLUMN IF NOT EXISTS error_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_error text;

-- Create function for scenario-based friend registration
CREATE OR REPLACE FUNCTION register_friend_with_scenario(
  p_line_user_id text,
  p_display_name text DEFAULT NULL,
  p_picture_url text DEFAULT NULL,
  p_scenario_name text DEFAULT 'default',
  p_campaign_id text DEFAULT NULL,
  p_registration_source text DEFAULT 'direct'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  v_friend_id uuid;
  v_user_id uuid;
  v_scenario_id uuid;
BEGIN
  -- Get user_id from auth context or use system default
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Authentication required');
  END IF;

  -- Find scenario by name
  SELECT id INTO v_scenario_id
  FROM step_scenarios
  WHERE name = p_scenario_name 
  AND user_id = v_user_id
  AND is_active = true
  LIMIT 1;

  IF v_scenario_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Scenario not found');
  END IF;

  -- Check if friend already exists
  SELECT id INTO v_friend_id
  FROM line_friends
  WHERE line_user_id = p_line_user_id AND user_id = v_user_id;

  -- Create or update friend record
  IF v_friend_id IS NULL THEN
    INSERT INTO line_friends (
      user_id, line_user_id, display_name, picture_url,
      scenario_name, campaign_id, registration_source
    )
    VALUES (
      v_user_id, p_line_user_id, p_display_name, p_picture_url,
      p_scenario_name, p_campaign_id, p_registration_source
    )
    RETURNING id INTO v_friend_id;
  ELSE
    -- Update existing friend with new scenario info
    UPDATE line_friends
    SET 
      scenario_name = p_scenario_name,
      campaign_id = p_campaign_id,
      registration_source = p_registration_source,
      updated_at = now()
    WHERE id = v_friend_id;
  END IF;

  -- Register friend to scenario
  INSERT INTO scenario_friend_logs (scenario_id, friend_id, line_user_id)
  VALUES (v_scenario_id, v_friend_id, p_line_user_id)
  ON CONFLICT DO NOTHING;

  -- Set up step delivery tracking for this scenario
  INSERT INTO step_delivery_tracking (
    scenario_id, step_id, friend_id, status,
    campaign_id, registration_source
  )
  SELECT 
    v_scenario_id, s.id, v_friend_id,
    CASE WHEN s.step_order = 1 THEN 'ready' ELSE 'waiting' END,
    p_campaign_id, p_registration_source
  FROM steps s
  WHERE s.scenario_id = v_scenario_id
  ORDER BY s.step_order
  ON CONFLICT (scenario_id, step_id, friend_id) DO NOTHING;

  RETURN json_build_object(
    'success', true,
    'friend_id', v_friend_id,
    'scenario_id', v_scenario_id,
    'scenario_name', p_scenario_name
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Create trigger for automatic step scheduling
CREATE OR REPLACE FUNCTION schedule_next_step()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
BEGIN
  -- When a step is delivered, schedule the next step
  IF NEW.status = 'delivered' AND OLD.status != 'delivered' THEN
    -- Mark next step as ready if exists
    UPDATE step_delivery_tracking
    SET status = 'ready'
    WHERE scenario_id = NEW.scenario_id
      AND friend_id = NEW.friend_id
      AND step_id = (
        SELECT s2.id FROM steps s1
        JOIN steps s2 ON s2.scenario_id = s1.scenario_id 
          AND s2.step_order = s1.step_order + 1
        WHERE s1.id = NEW.step_id
      );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_schedule_next_step ON step_delivery_tracking;
CREATE TRIGGER trigger_schedule_next_step
  AFTER UPDATE ON step_delivery_tracking
  FOR EACH ROW
  EXECUTE FUNCTION schedule_next_step();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_step_delivery_tracking_ready 
ON step_delivery_tracking (scenario_id, friend_id, status) 
WHERE status = 'ready';

CREATE INDEX IF NOT EXISTS idx_line_friends_scenario 
ON line_friends (user_id, scenario_name, campaign_id);

CREATE INDEX IF NOT EXISTS idx_step_delivery_logs_status 
ON step_delivery_logs (delivery_status, scheduled_at);

-- Update trigger for step_delivery_logs
CREATE TRIGGER update_step_delivery_logs_updated_at
  BEFORE UPDATE ON step_delivery_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();