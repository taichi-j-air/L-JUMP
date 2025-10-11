-- ポストバックログテーブル（復活ボタンの押下履歴を記録）
CREATE TABLE IF NOT EXISTS postback_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  friend_id uuid NOT NULL REFERENCES line_friends(id) ON DELETE CASCADE,
  scenario_id uuid NOT NULL REFERENCES step_scenarios(id) ON DELETE CASCADE,
  action text NOT NULL,
  line_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(friend_id, scenario_id, action)
);

-- パフォーマンス最適化用インデックス
CREATE INDEX IF NOT EXISTS idx_postback_logs_lookup 
ON postback_logs(friend_id, scenario_id, action);

-- RLS有効化
ALTER TABLE postback_logs ENABLE ROW LEVEL SECURITY;

-- ポリシー: ユーザーは自分の友達のログのみ閲覧可能
CREATE POLICY "Users can view own friend postback logs"
ON postback_logs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM line_friends
    WHERE line_friends.id = postback_logs.friend_id
    AND line_friends.user_id = auth.uid()
  )
);

-- ポリシー: システムによる挿入のみ許可
CREATE POLICY "System can insert postback logs"
ON postback_logs FOR INSERT
WITH CHECK (true);