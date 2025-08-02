-- シンプルなクリックログテーブル
CREATE TABLE IF NOT EXISTS public.invite_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_code TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT,
  referer TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS invite_clicks_code_idx ON invite_clicks(invite_code);
CREATE INDEX IF NOT EXISTS invite_clicks_created_idx ON invite_clicks(created_at);

-- RLS設定（一旦無効化して動作確認）
ALTER TABLE invite_clicks ENABLE ROW LEVEL SECURITY;

-- 一時的に全アクセス許可（後で制限）
CREATE POLICY "Temporary allow all" ON invite_clicks FOR ALL USING (true);