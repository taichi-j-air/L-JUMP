-- 3. RLSポリシーの最終確認と不足分の追加

-- invite_clicksテーブルにRLSポリシーが不足していないか確認し、必要に応じて追加
DO $$
BEGIN
    -- invite_clicksテーブルのSELECTポリシーが存在するかチェック
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'invite_clicks' 
        AND cmd = 'SELECT'
    ) THEN
        -- SELECTポリシーを追加
        EXECUTE 'CREATE POLICY "ユーザーは自分の招待クリックのみ参照可能"
            ON public.invite_clicks FOR SELECT
            USING (EXISTS (
                SELECT 1 FROM public.scenario_invite_codes sic 
                WHERE sic.invite_code = invite_clicks.invite_code 
                    AND sic.user_id = auth.uid()
            ))';
    END IF;

    -- scenario_friend_logsテーブルのRLSも確認
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'scenario_friend_logs' 
        AND cmd = 'SELECT'
        AND policyname LIKE '%参照可能%'
    ) THEN
        -- 既存のポリシーがあるので、追加のポリシーは不要だが、改善版を作成
        EXECUTE 'CREATE POLICY "ユーザーは自分のシナリオの友達ログのみ参照可能_v2"
            ON public.scenario_friend_logs FOR SELECT
            USING (EXISTS (
                SELECT 1 FROM public.step_scenarios s
                WHERE s.id = scenario_friend_logs.scenario_id 
                    AND s.user_id = auth.uid()
            ))';
    END IF;
END $$;