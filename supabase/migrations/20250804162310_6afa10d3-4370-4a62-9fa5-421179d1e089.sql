-- すべてのユーザー定義ビューとその詳細な情報を確認
SELECT 
    c.relname as view_name,
    n.nspname as schema_name,
    c.relowner,
    r.rulename,
    r.ev_type,
    r.ev_enabled,
    pg_get_viewdef(c.oid) as view_definition
FROM pg_class c
JOIN pg_namespace n ON c.relnamespace = n.oid
LEFT JOIN pg_rewrite r ON r.ev_class = c.oid
WHERE c.relkind = 'v' 
AND n.nspname = 'public';

-- pg_rewriteテーブルからSECURITY DEFINERルールを確認
SELECT 
    r.rulename,
    r.ev_class,
    c.relname as table_name,
    r.ev_action
FROM pg_rewrite r
JOIN pg_class c ON r.ev_class = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public'
AND c.relname = 'scenario_invite_stats';

-- ビューを完全に削除して、明示的にSECURITY INVOKERで再作成
DROP VIEW IF EXISTS public.scenario_invite_stats CASCADE;

-- SECURITY INVOKERを明示的に指定してビューを再作成
CREATE VIEW public.scenario_invite_stats 
WITH (security_invoker = true) AS
SELECT 
    sic.user_id,
    sic.scenario_id,
    sic.invite_code,
    (SELECT COUNT(*) FROM scenario_friend_logs sfl WHERE sfl.invite_code = sic.invite_code) as friends,
    (SELECT COUNT(*) FROM invite_clicks ic WHERE ic.invite_code = sic.invite_code) as clicks,
    sic.is_active,
    sic.usage_count,
    sic.created_at
FROM scenario_invite_codes sic;

-- 権限を再設定
GRANT SELECT ON public.scenario_invite_stats TO authenticated;
GRANT SELECT ON public.scenario_invite_stats TO anon;