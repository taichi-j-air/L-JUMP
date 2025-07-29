-- Update existing users' webhook URLs to use the correct Supabase function URL
UPDATE public.profiles 
SET webhook_url = 'https://rtjxurmuaawyzjcdkqxt.supabase.co/functions/v1/line-webhook'
WHERE webhook_url LIKE '%yourdomain.com%' OR webhook_url IS NULL;

-- Update the handle_new_user function to use the correct webhook URL
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
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
END;
$$;