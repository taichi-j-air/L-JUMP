-- Fix the security definer view issue by removing the view and recreating without security definer
DROP VIEW IF EXISTS public.scenario_invite_stats;

-- Create the view without security definer (it will use the querying user's permissions)
CREATE VIEW public.scenario_invite_stats AS
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

-- Add RLS policy for the view access
CREATE POLICY "ユーザーは自分のシナリオの統計のみ参照可能" 
ON public.scenario_invite_codes 
FOR SELECT 
USING (auth.uid() = user_id);