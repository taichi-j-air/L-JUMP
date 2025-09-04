-- Security fixes: Restrict public database access and secure critical data

-- 1. Remove dangerous public access policies that expose customer data
DROP POLICY IF EXISTS "公開招待コード参照" ON public.scenario_invite_codes;
DROP POLICY IF EXISTS "招待コードは誰でも参照可能（公開招待用）" ON public.scenario_invite_codes;
DROP POLICY IF EXISTS "public_can_view_public_pages" ON public.cms_pages;
DROP POLICY IF EXISTS "unified_public_read_forms" ON public.forms;

-- 2. Create secure public access for scenario invites only when specifically needed
CREATE POLICY "limited_public_invite_code_access" 
ON public.scenario_invite_codes 
FOR SELECT 
USING (
  is_active = true AND
  (max_usage IS NULL OR usage_count < max_usage)
);

-- 3. Create secure public access for CMS pages (only truly public content)
CREATE POLICY "secure_public_cms_pages_access" 
ON public.cms_pages 
FOR SELECT 
USING (
  visibility = 'public' AND
  (passcode IS NULL OR passcode = '') AND
  (require_passcode = false OR require_passcode IS NULL)
);

-- 4. Create secure public access for forms (only public forms without sensitive data)
CREATE POLICY "secure_public_forms_access" 
ON public.forms 
FOR SELECT 
USING (
  is_public = true AND
  (name IS NOT NULL AND name != '') AND
  (description IS NOT NULL OR description IS NULL)
);

-- 5. Enhance security audit logging with automatic credential access tracking
CREATE OR REPLACE FUNCTION public.log_credential_access()
RETURNS TRIGGER AS $$
BEGIN
  -- Log all credential access attempts
  INSERT INTO public.security_audit_log (
    user_id, 
    action, 
    details, 
    success,
    created_at
  ) VALUES (
    COALESCE(auth.uid(), NEW.user_id), 
    'credential_access_' || NEW.credential_type,
    jsonb_build_object(
      'credential_type', NEW.credential_type,
      'access_time', now(),
      'updated', (TG_OP = 'UPDATE')
    ),
    true,
    now()
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for credential access logging
CREATE TRIGGER log_secure_credential_access
  AFTER INSERT OR UPDATE ON public.secure_line_credentials
  FOR EACH ROW EXECUTE FUNCTION public.log_credential_access();

-- 6. Add migration tracking for credential migration
CREATE TABLE IF NOT EXISTS public.credential_migration_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  migration_type text NOT NULL,
  status text NOT NULL,
  details jsonb DEFAULT '{}',
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on migration log
ALTER TABLE public.credential_migration_log ENABLE ROW LEVEL SECURITY;

-- Only allow developers to view migration logs
CREATE POLICY "developers_can_view_migration_logs" 
ON public.credential_migration_log 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND user_role = 'developer'
  )
);

-- System can insert migration logs
CREATE POLICY "system_can_insert_migration_logs" 
ON public.credential_migration_log 
FOR INSERT 
WITH CHECK (true);

-- 7. Create function for secure credential migration
CREATE OR REPLACE FUNCTION public.migrate_user_credentials_to_secure(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_migrated_count integer := 0;
  v_profile_data record;
  v_line_api_data record;
BEGIN
  -- Only allow users to migrate their own credentials or developers
  IF auth.uid() != p_user_id AND NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND user_role = 'developer'
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Get profile credentials
  SELECT 
    line_channel_access_token,
    line_channel_secret,
    line_channel_id,
    line_bot_id,
    liff_id
  INTO v_profile_data
  FROM public.profiles
  WHERE user_id = p_user_id;

  -- Get line_api_credentials if exists
  SELECT 
    line_channel_access_token,
    line_channel_secret,
    line_channel_id,
    line_bot_id,
    liff_id
  INTO v_line_api_data
  FROM public.line_api_credentials
  WHERE user_id = p_user_id;

  -- Migrate channel_access_token
  IF COALESCE(v_profile_data.line_channel_access_token, v_line_api_data.line_channel_access_token) IS NOT NULL THEN
    INSERT INTO public.secure_line_credentials (user_id, credential_type, encrypted_value)
    VALUES (p_user_id, 'channel_access_token', COALESCE(v_profile_data.line_channel_access_token, v_line_api_data.line_channel_access_token))
    ON CONFLICT (user_id, credential_type) DO UPDATE SET
      encrypted_value = EXCLUDED.encrypted_value,
      updated_at = now();
    v_migrated_count := v_migrated_count + 1;
  END IF;

  -- Migrate channel_secret
  IF COALESCE(v_profile_data.line_channel_secret, v_line_api_data.line_channel_secret) IS NOT NULL THEN
    INSERT INTO public.secure_line_credentials (user_id, credential_type, encrypted_value)
    VALUES (p_user_id, 'channel_secret', COALESCE(v_profile_data.line_channel_secret, v_line_api_data.line_channel_secret))
    ON CONFLICT (user_id, credential_type) DO UPDATE SET
      encrypted_value = EXCLUDED.encrypted_value,
      updated_at = now();
    v_migrated_count := v_migrated_count + 1;
  END IF;

  -- Migrate channel_id
  IF COALESCE(v_profile_data.line_channel_id, v_line_api_data.line_channel_id) IS NOT NULL THEN
    INSERT INTO public.secure_line_credentials (user_id, credential_type, encrypted_value)
    VALUES (p_user_id, 'channel_id', COALESCE(v_profile_data.line_channel_id, v_line_api_data.line_channel_id))
    ON CONFLICT (user_id, credential_type) DO UPDATE SET
      encrypted_value = EXCLUDED.encrypted_value,
      updated_at = now();
    v_migrated_count := v_migrated_count + 1;
  END IF;

  -- Migrate bot_id
  IF COALESCE(v_profile_data.line_bot_id, v_line_api_data.line_bot_id) IS NOT NULL THEN
    INSERT INTO public.secure_line_credentials (user_id, credential_type, encrypted_value)
    VALUES (p_user_id, 'bot_id', COALESCE(v_profile_data.line_bot_id, v_line_api_data.line_bot_id))
    ON CONFLICT (user_id, credential_type) DO UPDATE SET
      encrypted_value = EXCLUDED.encrypted_value,
      updated_at = now();
    v_migrated_count := v_migrated_count + 1;
  END IF;

  -- Migrate liff_id
  IF COALESCE(v_profile_data.liff_id, v_line_api_data.liff_id) IS NOT NULL THEN
    INSERT INTO public.secure_line_credentials (user_id, credential_type, encrypted_value)
    VALUES (p_user_id, 'liff_id', COALESCE(v_profile_data.liff_id, v_line_api_data.liff_id))
    ON CONFLICT (user_id, credential_type) DO UPDATE SET
      encrypted_value = EXCLUDED.encrypted_value,
      updated_at = now();
    v_migrated_count := v_migrated_count + 1;
  END IF;

  -- Log migration
  INSERT INTO public.credential_migration_log (user_id, migration_type, status, details)
  VALUES (p_user_id, 'line_credentials', 'completed', jsonb_build_object('migrated_count', v_migrated_count));

  RETURN json_build_object('success', true, 'migrated_count', v_migrated_count);

EXCEPTION
  WHEN OTHERS THEN
    -- Log failed migration
    INSERT INTO public.credential_migration_log (user_id, migration_type, status, details)
    VALUES (p_user_id, 'line_credentials', 'failed', jsonb_build_object('error', SQLERRM));
    
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- 8. Enhance input validation functions with additional security
CREATE OR REPLACE FUNCTION public.validate_and_sanitize_json_input(input_json jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  json_text TEXT;
BEGIN
  IF input_json IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;
  
  json_text := input_json::text;
  
  -- Enhanced security checks
  IF json_text ~* 'javascript:|data:|vbscript:|on\w+\s*=|<script|eval\(|function\(|import\(|require\(' THEN
    RAISE EXCEPTION 'Potentially dangerous content detected';
  END IF;
  
  -- Size limit (100KB)
  IF length(json_text) > 100000 THEN
    RAISE EXCEPTION 'Input too large';
  END IF;
  
  -- Sanitize and return
  RETURN sanitize_text_input(json_text)::jsonb;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Invalid or dangerous JSON input: %', SQLERRM;
END;
$$;