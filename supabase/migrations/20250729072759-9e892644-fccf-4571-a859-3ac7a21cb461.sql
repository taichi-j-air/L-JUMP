-- 既存のプロファイルテーブルにuser_roleカラムを追加
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS user_role TEXT DEFAULT 'user' CHECK (user_role IN ('user', 'admin', 'super_admin'));

-- セキュリティ修正された自動更新関数（CASCADE使用）
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- トリガーを再作成
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- セキュリティ修正された新規ユーザー自動プロファイル作成関数（CASCADE使用）
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
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

-- 新規ユーザー作成トリガーを再作成
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();