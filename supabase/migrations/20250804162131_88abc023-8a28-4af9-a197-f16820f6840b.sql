-- Step 1: 現在のビューを削除
DROP VIEW IF EXISTS public.scenario_invite_stats;

-- Step 2: SECURITY DEFINER属性なしでビューを再作成
CREATE VIEW public.scenario_invite_stats AS
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

-- Step 3: 認証済みユーザーにビューへのアクセス権限を付与
GRANT SELECT ON public.scenario_invite_stats TO authenticated;
GRANT SELECT ON public.scenario_invite_stats TO anon;

-- Step 4: 確認 - ビューの定義をチェック
SELECT 
    viewname,
    definition
FROM pg_views 
WHERE viewname = 'scenario_invite_stats'
AND schemaname = 'public';

-- Step 5: 基礎テーブルのRLS状態を確認
SELECT 
    tablename,
    rowsecurity
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('scenario_invite_codes', 'scenario_friend_logs', 'invite_clicks');