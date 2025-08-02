-- ページビュー記録テーブル（招待ページのアクセス統計用）
CREATE TABLE IF NOT EXISTS public.invite_page_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_code TEXT NOT NULL,
  user_agent TEXT,
  referer TEXT,
  device_type TEXT CHECK (device_type IN ('mobile', 'desktop')),
  viewed_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- パフォーマンス向上用インデックス
CREATE INDEX IF NOT EXISTS invite_page_views_code_idx ON invite_page_views(invite_code);
CREATE INDEX IF NOT EXISTS invite_page_views_device_idx ON invite_page_views(device_type);
CREATE INDEX IF NOT EXISTS invite_page_views_date_idx ON invite_page_views(viewed_at);

-- RLS（行レベルセキュリティ）設定
ALTER TABLE invite_page_views ENABLE ROW LEVEL SECURITY;

-- ユーザーは自分の招待コードのページビューのみ参照可能
CREATE POLICY "Users can view own page views" ON invite_page_views FOR SELECT
USING (EXISTS (
  SELECT 1 FROM scenario_invite_codes sic 
  JOIN step_scenarios ss ON ss.id = sic.scenario_id
  WHERE sic.invite_code = invite_page_views.invite_code AND ss.user_id = auth.uid()
));

-- フロントエンドからのページビュー記録用（誰でも挿入可能）
CREATE POLICY "Anyone can insert page views" ON invite_page_views FOR INSERT
WITH CHECK (true);