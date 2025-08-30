-- プロファイルテーブルにフィールドを追加
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS first_name text,
ADD COLUMN IF NOT EXISTS last_name text,
ADD COLUMN IF NOT EXISTS phone_number text,
ADD COLUMN IF NOT EXISTS avatar_url text,
ADD COLUMN IF NOT EXISTS provider text DEFAULT 'email',
ADD COLUMN IF NOT EXISTS onboarding_step integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS google_id text;

-- Google IDにユニークインデックスを追加
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_google_id ON public.profiles(google_id) WHERE google_id IS NOT NULL;

-- handle_new_user関数を更新してGoogle認証にも対応
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  provider_name text;
  google_user_id text;
  first_name_val text;
  last_name_val text;
  full_name text;
BEGIN
  -- プロバイダー情報を取得
  provider_name := COALESCE(NEW.app_metadata->>'provider', 'email');
  
  -- Googleログインの場合
  IF provider_name = 'google' THEN
    google_user_id := NEW.user_metadata->>'sub';
    first_name_val := NEW.user_metadata->>'given_name';
    last_name_val := NEW.user_metadata->>'family_name';
    full_name := NEW.user_metadata->>'full_name';
  ELSE
    -- 従来のメール登録
    full_name := NEW.raw_user_meta_data->>'display_name';
  END IF;

  INSERT INTO public.profiles (
    user_id, 
    display_name, 
    webhook_url, 
    line_api_status, 
    user_role,
    provider,
    google_id,
    first_name,
    last_name,
    onboarding_step
  )
  VALUES (
    NEW.id, 
    COALESCE(full_name, first_name_val, 'ユーザー'),
    'https://rtjxurmuaawyzjcdkqxt.supabase.co/functions/v1/line-webhook',
    'not_configured',
    'user',
    provider_name,
    google_user_id,
    first_name_val,
    last_name_val,
    CASE WHEN provider_name = 'google' THEN 1 ELSE 0 END
  );
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'user profile creation failed: %', SQLERRM;
END;
$$;