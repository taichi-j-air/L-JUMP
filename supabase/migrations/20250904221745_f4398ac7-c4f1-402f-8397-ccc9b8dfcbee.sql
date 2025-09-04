-- 既存のポリシーをすべて削除してから新しいポリシーを作成

-- step_delivery_trackingテーブルの全ポリシーを削除
DROP POLICY IF EXISTS "secure_step_delivery_select" ON step_delivery_tracking;
DROP POLICY IF EXISTS "secure_step_delivery_insert" ON step_delivery_tracking; 
DROP POLICY IF EXISTS "secure_step_delivery_update" ON step_delivery_tracking;
DROP POLICY IF EXISTS "secure_step_delivery_delete" ON step_delivery_tracking;
DROP POLICY IF EXISTS "system_step_delivery_management" ON step_delivery_tracking;
DROP POLICY IF EXISTS "Users can manage their own step delivery tracking" ON step_delivery_tracking;
DROP POLICY IF EXISTS "Users can view their own step delivery tracking" ON step_delivery_tracking;

-- 新しい厳格なポリシーを作成
CREATE POLICY "users_select_own_step_tracking" ON step_delivery_tracking
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM step_scenarios ss 
      WHERE ss.id = step_delivery_tracking.scenario_id 
      AND ss.user_id = auth.uid()
    )
  );

CREATE POLICY "users_insert_own_step_tracking" ON step_delivery_tracking
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM step_scenarios ss 
      WHERE ss.id = step_delivery_tracking.scenario_id 
      AND ss.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM line_friends lf
      WHERE lf.id = step_delivery_tracking.friend_id
      AND lf.user_id = auth.uid()
    )
  );

CREATE POLICY "users_update_own_step_tracking" ON step_delivery_tracking
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM step_scenarios ss 
      WHERE ss.id = step_delivery_tracking.scenario_id 
      AND ss.user_id = auth.uid()
    )
  );

CREATE POLICY "users_delete_own_step_tracking" ON step_delivery_tracking
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM step_scenarios ss 
      WHERE ss.id = step_delivery_tracking.scenario_id 
      AND ss.user_id = auth.uid()
    )
  );

-- システム（service_role）用のポリシー
CREATE POLICY "system_manage_step_tracking" ON step_delivery_tracking
  FOR ALL USING (
    (auth.jwt() ->> 'role'::text) = 'service_role'::text
  );

-- scenario_friend_logsテーブルのポリシーも修正
DROP POLICY IF EXISTS "secure_scenario_friend_logs_select" ON scenario_friend_logs;
DROP POLICY IF EXISTS "secure_scenario_friend_logs_insert" ON scenario_friend_logs; 
DROP POLICY IF EXISTS "system_scenario_friend_logs" ON scenario_friend_logs;

CREATE POLICY "users_select_own_scenario_logs" ON scenario_friend_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM step_scenarios ss 
      WHERE ss.id = scenario_friend_logs.scenario_id 
      AND ss.user_id = auth.uid()
    )
  );

CREATE POLICY "users_insert_own_scenario_logs" ON scenario_friend_logs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM step_scenarios ss 
      WHERE ss.id = scenario_friend_logs.scenario_id 
      AND ss.user_id = auth.uid()
    )
    AND (
      friend_id IS NULL OR 
      EXISTS (
        SELECT 1 FROM line_friends lf
        WHERE lf.id = scenario_friend_logs.friend_id
        AND lf.user_id = auth.uid()
      )
    )
  );

-- システム用のポリシー
CREATE POLICY "system_manage_scenario_logs" ON scenario_friend_logs
  FOR ALL USING (
    (auth.jwt() ->> 'role'::text) = 'service_role'::text
  );