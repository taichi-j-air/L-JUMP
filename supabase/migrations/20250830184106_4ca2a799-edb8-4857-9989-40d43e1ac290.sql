-- Fix the user profile creation trigger to handle Google OAuth properly
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create improved function to handle new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY definer SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    user_id,
    first_name,
    last_name,
    display_name,
    avatar_url,
    provider,
    google_id
  )
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'first_name', new.raw_user_meta_data->>'given_name'),
    COALESCE(new.raw_user_meta_data->>'last_name', new.raw_user_meta_data->>'family_name'),
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'picture',
    COALESCE(new.raw_user_meta_data->>'provider', 'google'),
    new.raw_user_meta_data->>'sub'
  );
  RETURN new;
EXCEPTION
  WHEN others THEN
    -- Log the error but don't block user creation
    RAISE LOG 'Profile creation error for user %: %', new.id, SQLERRM;
    RETURN new;
END;
$$;

-- Create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();