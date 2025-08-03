-- Check if there are any views with SECURITY DEFINER and fix them
-- Drop any problematic views (this is likely the scenario_invite_stats view)
DROP VIEW IF EXISTS public.scenario_invite_stats;

-- Create the view without SECURITY DEFINER (normal view)
CREATE VIEW public.scenario_invite_stats AS
SELECT 
  sic.scenario_id,
  sic.user_id,
  sic.invite_code,
  sic.usage_count,
  sic.is_active,
  sic.created_at,
  COALESCE(ic.clicks, 0) as clicks,
  COALESCE(sfl.friends, 0) as friends
FROM public.scenario_invite_codes sic
LEFT JOIN (
  SELECT 
    invite_code,
    COUNT(*) as clicks
  FROM public.invite_clicks 
  GROUP BY invite_code
) ic ON sic.invite_code = ic.invite_code
LEFT JOIN (
  SELECT 
    invite_code,
    COUNT(DISTINCT friend_id) as friends
  FROM public.scenario_friend_logs 
  GROUP BY invite_code
) sfl ON sic.invite_code = sfl.invite_code;

-- Add proper RLS to ensure users can only see their own stats
CREATE POLICY "Users can only view own invite stats" ON public.scenario_invite_codes
FOR SELECT USING (auth.uid() = user_id);

-- Additional security: Strengthen edge function input validation
-- Add validation for LINE user IDs
CREATE OR REPLACE FUNCTION public.validate_line_user_id(line_user_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
BEGIN
  -- Validate LINE user ID format: should start with 'U' followed by 32 hex characters
  IF line_user_id IS NULL OR 
     length(line_user_id) != 33 OR
     line_user_id !~ '^U[0-9a-fA-F]{32}$' THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$;

-- Add function to sanitize text input (prevent XSS in user-generated content)
CREATE OR REPLACE FUNCTION public.sanitize_text_input(input_text text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
BEGIN
  IF input_text IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Remove potentially dangerous content
  input_text := regexp_replace(input_text, '<[^>]*>', '', 'g'); -- Remove HTML tags
  input_text := regexp_replace(input_text, 'javascript:', '', 'gi'); -- Remove javascript: URLs
  input_text := regexp_replace(input_text, 'data:', '', 'gi'); -- Remove data: URLs
  input_text := regexp_replace(input_text, 'vbscript:', '', 'gi'); -- Remove vbscript: URLs
  input_text := trim(input_text);
  
  RETURN input_text;
END;
$$;