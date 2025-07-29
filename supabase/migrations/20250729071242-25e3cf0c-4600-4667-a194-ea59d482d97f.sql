-- プロファイルテーブルを作成
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users ON DELETE CASCADE,
  display_name TEXT,
  line_channel_access_token TEXT,
  line_channel_secret TEXT,
  webhook_url TEXT,
  line_api_status TEXT DEFAULT 'not_configured' CHECK (line_api_status IN ('not_configured', 'configured', 'verified')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLSを有効化
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLSポリシーを作成
CREATE POLICY "ユーザーは自分のプロファイルのみ参照可能" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "ユーザーは自分のプロファイルを作成可能" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ユーザーは自分のプロファイルを更新可能" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "ユーザーは自分のプロファイルを削除可能" 
ON public.profiles 
FOR DELETE 
USING (auth.uid() = user_id);

-- 自動更新関数
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- プロファイル更新時のトリガー
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 新規ユーザー登録時に自動でプロファイル作成
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
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

-- 新規ユーザー作成時のトリガー
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();