-- CRITICAL SECURITY FIX: Remove overly permissive RLS policy on profiles table
DROP POLICY IF EXISTS "公開プロフィール参照" ON public.profiles;

-- Create secure profile access policy that only allows users to see specific public fields
CREATE POLICY "Limited public profile access" ON public.profiles
FOR SELECT USING (
  -- Only allow access to non-sensitive fields for authenticated users
  auth.role() = 'authenticated' AND 
  -- Users can only see their own full profile or limited public info of others
  (auth.uid() = user_id OR 
   -- For other users, they can only see very limited info through specific functions
   FALSE)
);

-- Create a secure function for getting public profile info when needed
CREATE OR REPLACE FUNCTION public.get_public_profile_info(profile_user_id uuid)
RETURNS TABLE(display_name text, user_role text)
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT 
    p.display_name,
    p.user_role
  FROM public.profiles p
  WHERE p.user_id = profile_user_id
    AND p.user_role IS NOT NULL;
$$;

-- CRITICAL: Separate sensitive LINE API credentials into a new secure table
CREATE TABLE IF NOT EXISTS public.line_api_credentials (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  line_channel_access_token text,
  line_channel_secret text,
  line_channel_id text,
  line_bot_id text,
  line_login_channel_id text,
  line_login_channel_secret text,
  liff_id text,
  liff_url text,
  encrypted_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on the new credentials table
ALTER TABLE public.line_api_credentials ENABLE ROW LEVEL SECURITY;

-- Only allow users to access their own credentials
CREATE POLICY "Users can only access own LINE credentials" ON public.line_api_credentials
FOR ALL USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_line_api_credentials_updated_at
BEFORE UPDATE ON public.line_api_credentials
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- SECURITY: Remove sensitive columns from profiles table
-- First migrate existing data to the new secure table
INSERT INTO public.line_api_credentials (
  user_id,
  line_channel_access_token,
  line_channel_secret,
  line_channel_id,
  line_bot_id,
  line_login_channel_id,
  line_login_channel_secret,
  liff_id,
  liff_url
)
SELECT 
  user_id,
  line_channel_access_token,
  line_channel_secret,
  line_channel_id,
  line_bot_id,
  line_login_channel_id,
  line_login_channel_secret,
  liff_id,
  liff_url
FROM public.profiles
WHERE line_channel_access_token IS NOT NULL
   OR line_channel_secret IS NOT NULL
   OR line_channel_id IS NOT NULL
   OR line_bot_id IS NOT NULL
   OR line_login_channel_id IS NOT NULL
   OR line_login_channel_secret IS NOT NULL
   OR liff_id IS NOT NULL
   OR liff_url IS NOT NULL
ON CONFLICT (user_id) DO UPDATE SET
  line_channel_access_token = EXCLUDED.line_channel_access_token,
  line_channel_secret = EXCLUDED.line_channel_secret,
  line_channel_id = EXCLUDED.line_channel_id,
  line_bot_id = EXCLUDED.line_bot_id,
  line_login_channel_id = EXCLUDED.line_login_channel_id,
  line_login_channel_secret = EXCLUDED.line_login_channel_secret,
  liff_id = EXCLUDED.liff_id,
  liff_url = EXCLUDED.liff_url,
  updated_at = now();

-- Now remove the sensitive columns from profiles (will be done in a separate migration after code updates)

-- CRITICAL: Fix overly permissive policies on invite_clicks
DROP POLICY IF EXISTS "Temporary allow all" ON public.invite_clicks;

-- Ensure proper access control for scenario data
CREATE POLICY "Secure scenario access" ON public.step_scenarios
FOR SELECT USING (
  -- Users can see their own scenarios
  auth.uid() = user_id OR
  -- Or scenarios that are active and being accessed through valid invite codes
  (is_active = true AND EXISTS (
    SELECT 1 FROM public.scenario_invite_codes sic 
    WHERE sic.scenario_id = step_scenarios.id 
    AND sic.is_active = true
  ))
);

-- Add input validation function for invite codes
CREATE OR REPLACE FUNCTION public.validate_invite_code(code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Add input validation for display names
CREATE OR REPLACE FUNCTION public.validate_display_name(name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
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