-- LINE Login用のカラムを追加
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS line_login_channel_id TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS line_login_channel_secret TEXT;