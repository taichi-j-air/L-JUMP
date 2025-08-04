-- Remove the existing SECURITY DEFINER view and recreate it safely
DROP VIEW IF EXISTS public.scenario_invite_stats;

-- Recreate the view without SECURITY DEFINER property
CREATE VIEW public.scenario_invite_stats AS
SELECT 
  sic.invite_code,
  sic.scenario_id,
  sic.user_id,
  sic.usage_count,
  sic.is_active,
  sic.created_at,
  COALESCE(ic.clicks, 0) AS clicks,
  COALESCE(sfl.friends, 0) AS friends
FROM scenario_invite_codes sic
LEFT JOIN (
  SELECT 
    invite_code,
    COUNT(*) AS clicks
  FROM invite_clicks
  GROUP BY invite_code
) ic ON ic.invite_code = sic.invite_code
LEFT JOIN (
  SELECT 
    invite_code,
    COUNT(*) AS friends
  FROM scenario_friend_logs
  GROUP BY invite_code
) sfl ON sfl.invite_code = sic.invite_code;

-- Add RLS policy for the view
ALTER VIEW public.scenario_invite_stats SET (security_barrier = true);

-- Enable RLS on the view (if supported)
-- Note: Views inherit RLS from their underlying tables