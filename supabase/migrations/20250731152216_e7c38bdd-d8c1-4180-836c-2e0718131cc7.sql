-- Add add_friend_url column to profiles table
ALTER TABLE public.profiles ADD COLUMN add_friend_url text;

-- Create invite_clicks table for tracking clicks
CREATE TABLE public.invite_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_code text NOT NULL,
  ip text,
  user_agent text,
  referer text,
  clicked_at timestamptz DEFAULT now()
);

-- Enable RLS and create policy for public inserts
ALTER TABLE public.invite_clicks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public insert" ON public.invite_clicks
FOR INSERT WITH CHECK (true);

-- Update scenario_friend_logs table structure (already exists but may need updates)
-- Add invite_code column if it doesn't exist in the expected format

-- Create analytics view
CREATE OR REPLACE VIEW public.scenario_invite_stats AS
SELECT
  c.invite_code,
  c.scenario_id,
  COUNT(ic.id) AS clicks,
  COUNT(sl.id) AS friends,
  MAX(c.usage_count) AS total_added
FROM scenario_invite_codes c
LEFT JOIN invite_clicks ic ON ic.invite_code = c.invite_code
LEFT JOIN scenario_friend_logs sl ON sl.invite_code = c.invite_code
GROUP BY c.invite_code, c.scenario_id;