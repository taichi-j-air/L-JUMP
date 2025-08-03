-- Fix security definer function issues by setting search_path
CREATE OR REPLACE FUNCTION public.get_public_profile_info(profile_user_id uuid)
RETURNS TABLE(display_name text, user_role text)
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = 'public', 'pg_temp'
AS $$
  SELECT 
    p.display_name,
    p.user_role
  FROM public.profiles p
  WHERE p.user_id = profile_user_id
    AND p.user_role IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.validate_invite_code(code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
BEGIN
  -- Validate format: should be alphanumeric, 8-32 characters
  IF code IS NULL OR 
     length(code) < 8 OR 
     length(code) > 32 OR
     code !~ '^[a-zA-Z0-9]+$' THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_display_name(name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
BEGIN
  -- Basic XSS prevention and length validation
  IF name IS NULL OR 
     length(trim(name)) < 1 OR 
     length(name) > 100 OR
     name ~ '<[^>]*>' OR  -- Basic HTML tag detection
     name ~ 'javascript:' OR
     name ~ 'data:' THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$;

-- Fix existing functions to have proper search_path
CREATE OR REPLACE FUNCTION public.generate_invite_code()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public', 'pg_temp'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.update_add_friend_url()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public', 'pg_temp'
AS $function$
BEGIN
  -- LINE Bot IDが設定されている場合、友達追加URLを自動生成
  IF NEW.line_bot_id IS NOT NULL AND NEW.line_bot_id != '' THEN
    -- @マークを除去してlin.ee URLを生成
    NEW.add_friend_url = 'https://lin.ee/' || REPLACE(NEW.line_bot_id, '@', '');
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'add friend URL update failed: %', SQLERRM;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public', 'pg_temp'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public', 'pg_temp'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.reset_monthly_quota()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public', 'pg_temp'
AS $function$
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
$function$;