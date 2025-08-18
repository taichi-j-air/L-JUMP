-- RLSポリシーの修正: ordersテーブル
-- 現在の問題のあるポリシーを削除して適切なものに置き換え

-- 既存のpolicyを削除
DROP POLICY IF EXISTS "system_can_manage_orders" ON orders;
DROP POLICY IF EXISTS "users_can_view_own_orders" ON orders;

-- 適切なRLSポリシーを作成
-- ユーザーは自分の注文のみ表示可能
CREATE POLICY "users_can_view_own_orders" ON orders 
FOR SELECT 
USING (user_id = auth.uid());

-- システムが注文を管理可能（サービスロールキー使用時）
CREATE POLICY "system_can_manage_orders" ON orders 
FOR ALL 
USING (auth.jwt() ->> 'role' = 'service_role')
WITH CHECK (auth.jwt() ->> 'role' = 'service_role');