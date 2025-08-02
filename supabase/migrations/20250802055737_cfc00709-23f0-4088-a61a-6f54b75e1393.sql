-- 1. セキュリティ強化版View作成
-- 既存のSECURITY DEFINERビューを削除
DROP VIEW IF EXISTS public.scenario_invite_stats;

-- RLS準拠の安全なビューを作成
CREATE VIEW public.scenario_invite_stats 
WITH (security_invoker = true) AS
SELECT 
    sic.id as invite_code_id,
    sic.invite_code,
    sic.scenario_id,
    sic.user_id,
    COALESCE(COUNT(DISTINCT ic.id), 0) as clicks,
    COALESCE(COUNT(DISTINCT sfl.id), 0) as friends,
    sic.usage_count,
    sic.created_at,
    sic.is_active
FROM public.scenario_invite_codes sic
LEFT JOIN public.invite_clicks ic ON ic.invite_code = sic.invite_code
LEFT JOIN public.scenario_friend_logs sfl ON sfl.invite_code = sic.invite_code
WHERE sic.user_id = auth.uid()  -- RLS準拠の制限
GROUP BY sic.id, sic.invite_code, sic.scenario_id, sic.user_id, sic.usage_count, sic.created_at, sic.is_active;