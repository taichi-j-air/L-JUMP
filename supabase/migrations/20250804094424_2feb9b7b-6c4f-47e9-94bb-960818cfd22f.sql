-- Add scheduled delivery time column to step_delivery_tracking table
ALTER TABLE step_delivery_tracking 
ADD COLUMN scheduled_delivery_at timestamp with time zone;

-- Create function to calculate and set scheduled delivery time
CREATE OR REPLACE FUNCTION calculate_scheduled_delivery_time(
  p_friend_added_at timestamp with time zone,
  p_delivery_type text,
  p_delivery_seconds integer,
  p_delivery_minutes integer,
  p_delivery_hours integer,
  p_delivery_days integer,
  p_specific_time timestamp with time zone DEFAULT NULL
) RETURNS timestamp with time zone
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- For immediate delivery
  IF p_delivery_type = 'immediately' THEN
    RETURN p_friend_added_at;
  END IF;
  
  -- For specific time delivery
  IF p_delivery_type = 'specific_time' AND p_specific_time IS NOT NULL THEN
    RETURN p_specific_time;
  END IF;
  
  -- For relative time delivery (after friend addition)
  IF p_delivery_type = 'relative' THEN
    RETURN p_friend_added_at + 
           INTERVAL '1 day' * COALESCE(p_delivery_days, 0) +
           INTERVAL '1 hour' * COALESCE(p_delivery_hours, 0) +
           INTERVAL '1 minute' * COALESCE(p_delivery_minutes, 0) +
           INTERVAL '1 second' * COALESCE(p_delivery_seconds, 0);
  END IF;
  
  -- Default to immediate if no valid type
  RETURN p_friend_added_at;
END;
$$;

-- Update existing tracking records to set scheduled delivery time
UPDATE step_delivery_tracking sdt
SET scheduled_delivery_at = calculate_scheduled_delivery_time(
  (SELECT added_at FROM line_friends WHERE id = sdt.friend_id),
  (SELECT delivery_type FROM steps WHERE id = sdt.step_id),
  (SELECT delivery_seconds FROM steps WHERE id = sdt.step_id),
  (SELECT delivery_minutes FROM steps WHERE id = sdt.step_id),
  (SELECT delivery_hours FROM steps WHERE id = sdt.step_id),
  (SELECT delivery_days FROM steps WHERE id = sdt.step_id),
  (SELECT specific_time FROM steps WHERE id = sdt.step_id)
)
WHERE scheduled_delivery_at IS NULL;

-- Create trigger to automatically set scheduled delivery time for new tracking records
CREATE OR REPLACE FUNCTION set_scheduled_delivery_time()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Calculate scheduled delivery time based on step settings
  SELECT calculate_scheduled_delivery_time(
    (SELECT added_at FROM line_friends WHERE id = NEW.friend_id),
    s.delivery_type,
    s.delivery_seconds,
    s.delivery_minutes,
    s.delivery_hours,
    s.delivery_days,
    s.specific_time
  )
  INTO NEW.scheduled_delivery_at
  FROM steps s
  WHERE s.id = NEW.step_id;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_set_scheduled_delivery_time
  BEFORE INSERT ON step_delivery_tracking
  FOR EACH ROW
  EXECUTE FUNCTION set_scheduled_delivery_time();

-- Create index for efficient querying of scheduled deliveries
CREATE INDEX idx_step_delivery_tracking_scheduled 
ON step_delivery_tracking (scheduled_delivery_at, status) 
WHERE status IN ('waiting', 'ready');