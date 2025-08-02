-- scenario_invite_statsビューを一時的に削除
DROP VIEW IF EXISTS public.scenario_invite_stats;

-- invite_clicksテーブルを削除してから再作成
DROP TABLE IF EXISTS public.invite_clicks CASCADE;

-- シンプルなクリックログテーブル
CREATE TABLE public.invite_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_code TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT,
  referer TEXT,
  clicked_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- インデックス作成
CREATE INDEX invite_clicks_code_idx ON invite_clicks(invite_code);
CREATE INDEX invite_clicks_created_idx ON invite_clicks(clicked_at);

-- scenario_invite_statsビューを再作成（clicked_atに合わせて修正）
CREATE VIEW public.scenario_invite_stats AS
SELECT 
  sic.id as invite_code_id,
  sic.user_id,
  sic.scenario_id,
  sic.invite_code,
  sic.usage_count,
  sic.is_active,
  sic.created_at,
  COALESCE(click_counts.clicks, 0) as clicks,
  COALESCE(friend_counts.friends, 0) as friends
FROM scenario_invite_codes sic
LEFT JOIN (
  SELECT 
    invite_code,
    COUNT(*) as clicks
  FROM invite_clicks
  GROUP BY invite_code
) click_counts ON sic.invite_code = click_counts.invite_code
LEFT JOIN (
  SELECT 
    invite_code,
    COUNT(*) as friends
  FROM scenario_friend_logs
  GROUP BY invite_code
) friend_counts ON sic.invite_code = friend_counts.invite_code;

-- RLS設定
ALTER TABLE invite_clicks ENABLE ROW LEVEL SECURITY;

-- 一時的に全アクセス許可
DROP POLICY IF EXISTS "Temporary allow all" ON invite_clicks;
CREATE POLICY "Temporary allow all" ON invite_clicks FOR ALL USING (true);