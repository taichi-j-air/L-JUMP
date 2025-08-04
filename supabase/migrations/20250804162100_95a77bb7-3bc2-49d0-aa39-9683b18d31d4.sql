-- Step 1: 現在のビューの定義を確認
SELECT 
    viewname,
    definition
FROM pg_views 
WHERE viewname = 'scenario_invite_stats'
AND schemaname = 'public';

-- Step 2: 現在のビューを安全に削除し、SECURITY DEFINER属性なしで再作成
DROP VIEW IF EXISTS public.scenario_invite_stats;

-- Step 3: ビューを再作成（SECURITY DEFINER属性なし）
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

-- Step 4: RLSを有効化
ALTER TABLE public.scenario_invite_stats ENABLE ROW LEVEL SECURITY;

-- Step 5: 適切なRLSポリシーを作成
CREATE POLICY "Users can view own invite stats" 
ON public.scenario_invite_stats 
FOR SELECT 
USING (auth.uid() = user_id);

-- Step 6: 認証済みユーザーに必要な権限を付与
GRANT SELECT ON public.scenario_invite_stats TO authenticated;

-- Step 7: 修正結果を確認
SELECT 
    viewname,
    definition
FROM pg_views 
WHERE viewname = 'scenario_invite_stats'
AND schemaname = 'public';