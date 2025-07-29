-- FlexMaster アプリケーション - 完全なデータベースセットアップ
-- 実行順序: この順番で実行してください

-- 1. プロファイルテーブル作成
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users ON DELETE CASCADE,
  display_name TEXT,
  line_channel_access_token TEXT,
  line_channel_secret TEXT,
  webhook_url TEXT,
  line_api_status TEXT DEFAULT 'not_configured' CHECK (line_api_status IN ('not_configured', 'configured', 'verified')),
  user_role TEXT DEFAULT 'user' CHECK (user_role IN ('user', 'admin', 'super_admin')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. RLS有効化
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. RLSポリシー作成
CREATE POLICY "ユーザーは自分のプロファイルのみ参照可能" 
ON public.profiles FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "ユーザーは自分のプロファイルを作成可能" 
ON public.profiles FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ユーザーは自分のプロファイルを更新可能" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "ユーザーは自分のプロファイルを削除可能" 
ON public.profiles FOR DELETE 
USING (auth.uid() = user_id);

-- 4. 自動更新関数
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- 5. 自動更新トリガー
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 6. 新規ユーザー自動プロファイル作成関数
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, webhook_url)
  VALUES (
    NEW.id, 
    NEW.raw_user_meta_data ->> 'display_name',
    'https://yourdomain.com/webhook/' || NEW.id
  );
  RETURN NEW;
END;
$$;

-- 7. 新規ユーザー作成トリガー
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();