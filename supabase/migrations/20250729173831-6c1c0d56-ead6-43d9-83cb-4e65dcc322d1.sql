-- Create trigger for new user profile creation
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

-- Create trigger for automatic profile creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();