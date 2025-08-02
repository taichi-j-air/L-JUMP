-- 2. 関数のセキュリティ最終確認と強化
-- 全ての関数にpg_tempを追加してセキュリティを強化

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    result text;
BEGIN
    -- より安全なランダム文字列生成
    SELECT encode(gen_random_bytes(12), 'base64')
    INTO result;
    
    -- 使用不可文字を除去
    result := translate(result, '+/=', 'xyz');
    
    RETURN result;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'invite code generation failed: %', SQLERRM;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  webhook_base_url text := 'https://rtjxurmuaawyzjcdkqxt.supabase.co/functions/v1/line-webhook';
BEGIN
  INSERT INTO public.profiles (user_id, display_name, webhook_url, line_api_status, user_role)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', 'ユーザー'),
    webhook_base_url,
    'not_configured',
    'user'
  );
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'user profile creation failed: %', SQLERRM;
END;
$$;

CREATE OR REPLACE FUNCTION public.reset_monthly_quota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- 月が変わった場合にカウンターリセット
  IF NEW.current_month != EXTRACT(MONTH FROM now()) 
     OR NEW.current_year != EXTRACT(YEAR FROM now()) THEN
    NEW.monthly_message_used = 0;
    NEW.current_month = EXTRACT(MONTH FROM now());
    NEW.current_year = EXTRACT(YEAR FROM now());
  END IF;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'quota reset failed: %', SQLERRM;
END;
$$;