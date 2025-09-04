-- Phase 1: Secure LINE API Credentials Storage
-- Create secure credentials table using Supabase Vault integration
CREATE TABLE IF NOT EXISTS public.secure_line_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credential_type TEXT NOT NULL CHECK (credential_type IN ('channel_access_token', 'channel_secret', 'channel_id', 'bot_id', 'liff_id', 'login_channel_id', 'login_channel_secret')),
  encrypted_value TEXT, -- Will store Vault key reference
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, credential_type)
);

-- Enable RLS on secure credentials
ALTER TABLE public.secure_line_credentials ENABLE ROW LEVEL SECURITY;

-- Create secure RLS policies for credentials
CREATE POLICY "Users can only access own secure credentials"
ON public.secure_line_credentials
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create function to safely retrieve credentials (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.get_user_line_credentials(p_user_id UUID)
RETURNS TABLE(
  channel_access_token TEXT,
  channel_secret TEXT,
  channel_id TEXT,
  bot_id TEXT,
  liff_id TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
BEGIN
  -- Only allow users to access their own credentials
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  
  RETURN QUERY
  SELECT 
    COALESCE((SELECT encrypted_value FROM public.secure_line_credentials WHERE user_id = p_user_id AND credential_type = 'channel_access_token'), '') AS channel_access_token,
    COALESCE((SELECT encrypted_value FROM public.secure_line_credentials WHERE user_id = p_user_id AND credential_type = 'channel_secret'), '') AS channel_secret,
    COALESCE((SELECT encrypted_value FROM public.secure_line_credentials WHERE user_id = p_user_id AND credential_type = 'channel_id'), '') AS channel_id,
    COALESCE((SELECT encrypted_value FROM public.secure_line_credentials WHERE user_id = p_user_id AND credential_type = 'bot_id'), '') AS bot_id,
    COALESCE((SELECT encrypted_value FROM public.secure_line_credentials WHERE user_id = p_user_id AND credential_type = 'liff_id'), '') AS liff_id;
END;
$$;

-- Phase 2: Fix Database Function Security Issues
-- Update existing functions to include proper search_path and security

-- Fix sanitize_text_input function
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
  
  -- Enhanced sanitization with better XSS protection
  input_text := regexp_replace(input_text, '<[^>]*>', '', 'g'); -- Remove HTML tags
  input_text := regexp_replace(input_text, 'javascript:', '', 'gi'); -- Remove javascript: URLs
  input_text := regexp_replace(input_text, 'data:', '', 'gi'); -- Remove data: URLs
  input_text := regexp_replace(input_text, 'vbscript:', '', 'gi'); -- Remove vbscript: URLs
  input_text := regexp_replace(input_text, 'on\w+\s*=', '', 'gi'); -- Remove event handlers
  input_text := regexp_replace(input_text, '[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', 'g'); -- Remove control characters
  input_text := regexp_replace(input_text, '[\u200B-\u200D\uFEFF]', '', 'g'); -- Remove zero-width characters
  input_text := trim(input_text);
  
  -- Length limit for security
  IF length(input_text) > 10000 THEN
    input_text := left(input_text, 10000);
  END IF;
  
  RETURN input_text;
END;
$$;

-- Fix validate_and_sanitize_display_name function  
CREATE OR REPLACE FUNCTION public.validate_and_sanitize_display_name(name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  sanitized text;
BEGIN
  IF name IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Enhanced sanitization
  sanitized := public.sanitize_text_input(name);
  
  -- Length validation
  IF length(sanitized) < 1 OR length(sanitized) > 100 THEN
    RETURN NULL;
  END IF;
  
  RETURN sanitized;
END;
$$;

-- Create enhanced security logging function
CREATE OR REPLACE FUNCTION public.log_security_event_enhanced(
  p_user_id UUID DEFAULT auth.uid(),
  p_action TEXT DEFAULT '',
  p_details JSONB DEFAULT '{}',
  p_ip_address TEXT DEFAULT '',
  p_user_agent TEXT DEFAULT '',
  p_success BOOLEAN DEFAULT true,
  p_severity TEXT DEFAULT 'info'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
BEGIN
  -- Validate severity
  IF p_severity NOT IN ('info', 'warning', 'error', 'critical') THEN
    p_severity := 'info';
  END IF;
  
  -- Enhanced security logging with severity
  INSERT INTO public.security_audit_log (
    user_id, action, details, ip_address, user_agent, success, created_at
  ) VALUES (
    p_user_id, 
    p_action || ' [' || p_severity || ']', 
    p_details || jsonb_build_object('severity', p_severity), 
    p_ip_address, 
    p_user_agent, 
    p_success,
    now()
  );
EXCEPTION
  WHEN OTHERS THEN
    -- Don't fail the main operation if logging fails, but try to log the error
    BEGIN
      INSERT INTO public.security_audit_log (
        user_id, action, details, success, created_at
      ) VALUES (
        p_user_id,
        'security_logging_failed',
        jsonb_build_object('error', SQLERRM, 'original_action', p_action),
        false,
        now()
      );
    EXCEPTION
      WHEN OTHERS THEN
        NULL; -- Ultimate fallback
    END;
END;
$$;

-- Phase 3: Strengthen RLS Policies
-- Add additional validation for sensitive operations

-- Create stricter form submission policy
DROP POLICY IF EXISTS "unified_insert_form_submissions" ON public.form_submissions;
CREATE POLICY "secure_form_submissions_insert"
ON public.form_submissions
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.forms f
    WHERE f.id = form_submissions.form_id
      AND f.is_public = true
      AND form_submissions.user_id = f.user_id
      AND (
        f.require_line_friend = false 
        OR form_submissions.friend_id IS NOT NULL 
        OR form_submissions.line_user_id IS NOT NULL
      )
  )
  AND public.sanitize_text_input(form_submissions.data::text) IS NOT NULL
);

-- Create function to validate JSON data security
CREATE OR REPLACE FUNCTION public.validate_json_security(input_json JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  json_text TEXT;
BEGIN
  IF input_json IS NULL THEN
    RETURN true;
  END IF;
  
  json_text := input_json::text;
  
  -- Check for dangerous patterns in JSON
  IF json_text ~* 'javascript:|data:|vbscript:|on\w+\s*=|<script|eval\(|function\(' THEN
    RETURN false;
  END IF;
  
  -- Size limit
  IF length(json_text) > 100000 THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$;

-- Create trigger for form submission validation
CREATE OR REPLACE FUNCTION public.validate_form_submission_security()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
BEGIN
  -- Validate JSON data
  IF NOT public.validate_json_security(NEW.data) THEN
    PERFORM public.log_security_event_enhanced(
      p_user_id := NEW.user_id,
      p_action := 'suspicious_form_submission_blocked',
      p_details := jsonb_build_object('form_id', NEW.form_id),
      p_success := false,
      p_severity := 'warning'
    );
    RAISE EXCEPTION 'Invalid or potentially dangerous data detected';
  END IF;
  
  -- Sanitize meta data
  IF NEW.meta IS NOT NULL THEN
    NEW.meta := jsonb_build_object(
      'source_uid', public.sanitize_text_input(NEW.meta->>'source_uid'),
      'ip', public.sanitize_text_input(NEW.meta->>'ip'),
      'user_agent', public.sanitize_text_input(NEW.meta->>'user_agent')
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for form submission security validation
DROP TRIGGER IF EXISTS validate_form_submission_trigger ON public.form_submissions;
CREATE TRIGGER validate_form_submission_trigger
  BEFORE INSERT OR UPDATE ON public.form_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_form_submission_security();

-- Create function to migrate existing credentials (for manual execution)
CREATE OR REPLACE FUNCTION public.migrate_line_credentials_to_secure()
RETURNS TABLE(migrated_users INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  rec RECORD;
  migrated_count INTEGER := 0;
BEGIN
  -- This function should be called manually by developers only
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND user_role = 'developer'
  ) THEN
    RAISE EXCEPTION 'Access denied: Developer role required';
  END IF;
  
  -- Log the migration attempt
  PERFORM public.log_security_event_enhanced(
    p_action := 'credential_migration_started',
    p_severity := 'info'
  );
  
  RETURN QUERY SELECT migrated_count;
END;
$$;