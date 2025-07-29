-- 既存のプロファイルテーブルにuser_roleカラムを追加
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS user_role TEXT DEFAULT 'user' CHECK (user_role IN ('user', 'admin', 'super_admin'));

-- セキュリティ修正された自動更新関数
DROP FUNCTION IF EXISTS public.update_updated_at_column();
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- セキュリティ修正された新規ユーザー自動プロファイル作成関数
DROP FUNCTION IF EXISTS public.handle_new_user();
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