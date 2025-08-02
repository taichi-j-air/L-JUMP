-- 既存のinvite_clicksテーブルを削除してから再作成
DROP TABLE IF EXISTS public.invite_clicks;

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

-- RLS設定
ALTER TABLE invite_clicks ENABLE ROW LEVEL SECURITY;

-- 一時的に全アクセス許可（後で制限）
DROP POLICY IF EXISTS "Temporary allow all" ON invite_clicks;
CREATE POLICY "Temporary allow all" ON invite_clicks FOR ALL USING (true);