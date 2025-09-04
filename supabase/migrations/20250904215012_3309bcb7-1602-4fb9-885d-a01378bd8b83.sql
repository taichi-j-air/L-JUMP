-- Fix Security Linter Issues: Function Search Path Mutable
-- This addresses the function search path security warnings

-- 1. Fix validate_credential_encryption function
CREATE OR REPLACE FUNCTION public.validate_credential_encryption()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Ensure credentials are properly encrypted before storage
  IF NEW.encrypted_value IS NOT NULL AND length(NEW.encrypted_value) < 32 THEN
    RAISE EXCEPTION 'Credential must be properly encrypted (minimum 32 characters)';
  END IF;
  
  -- Log credential access for security monitoring
  INSERT INTO public.security_events_log (
    event_type, user_id, table_name, record_id, details
  ) VALUES (
    'credential_modification', 
    auth.uid(), 
    'secure_line_credentials', 
    NEW.id,
    jsonb_build_object('credential_type', NEW.credential_type)
  );
  
  RETURN NEW;
END;
$$;

-- 2. Fix log_security_event_enhanced function
CREATE OR REPLACE FUNCTION public.log_security_event_enhanced(
  p_event_type text,
  p_table_name text DEFAULT NULL,
  p_record_id uuid DEFAULT NULL,
  p_details jsonb DEFAULT '{}',
  p_ip_address text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.security_events_log (
    event_type, user_id, table_name, record_id, details, ip_address, user_agent
  ) VALUES (
    p_event_type, auth.uid(), p_table_name, p_record_id, p_details, p_ip_address, p_user_agent
  );
EXCEPTION
  WHEN OTHERS THEN
    -- Don't fail the main operation if logging fails
    NULL;
END;
$$;