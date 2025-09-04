-- Add monitoring for security events with correct trigger syntax
-- Note: PostgreSQL doesn't support BEFORE triggers on SELECT operations
-- Instead, we'll use INSERT triggers on security-related tables

-- Create a function to log credential access
CREATE OR REPLACE FUNCTION public.log_credential_access()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.security_events_log (
    user_id,
    event_type, 
    table_name, 
    record_id,
    details,
    created_at
  ) VALUES (
    NEW.user_id,
    'credential_access',
    TG_TABLE_NAME,
    NEW.id,
    jsonb_build_object(
      'operation', TG_OP,
      'credential_type', NEW.credential_type,
      'timestamp', now()
    ),
    now()
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Add trigger for credential access logging
DROP TRIGGER IF EXISTS log_credential_access_trigger ON public.secure_line_credentials;
CREATE TRIGGER log_credential_access_trigger
  AFTER INSERT OR UPDATE ON public.secure_line_credentials
  FOR EACH ROW
  EXECUTE FUNCTION public.log_credential_access();

-- Add indexes for security events for better performance
CREATE INDEX IF NOT EXISTS idx_security_events_log_timestamp 
ON public.security_events_log (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_security_events_log_event_type 
ON public.security_events_log (event_type);

CREATE INDEX IF NOT EXISTS idx_security_events_log_user_id 
ON public.security_events_log (user_id);

-- Add function to clean up old security events (retention policy)
CREATE OR REPLACE FUNCTION public.cleanup_old_security_events()
RETURNS void AS $$
BEGIN
  -- Keep only events from last 30 days
  DELETE FROM public.security_events_log 
  WHERE created_at < now() - interval '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Enhanced form submission validation function
CREATE OR REPLACE FUNCTION public.validate_form_submission_enhanced()
RETURNS TRIGGER AS $$
BEGIN
  -- Enhanced validation with security logging
  IF NOT public.validate_json_security(NEW.data) THEN
    -- Log the security violation
    INSERT INTO public.security_events_log (
      user_id,
      event_type,
      table_name,
      details,
      created_at
    ) VALUES (
      NEW.user_id,
      'malicious_form_submission_blocked',
      'form_submissions',
      jsonb_build_object(
        'form_id', NEW.form_id,
        'data_size', octet_length(NEW.data::text),
        'ip', NEW.meta->>'ip',
        'user_agent', NEW.meta->>'user_agent'
      ),
      now()
    );
    
    RAISE EXCEPTION 'Malicious content detected in form submission';
  END IF;
  
  -- Additional sanitization for meta data
  IF NEW.meta IS NOT NULL THEN
    NEW.meta := jsonb_build_object(
      'source_uid', public.sanitize_text_input(NEW.meta->>'source_uid'),
      'ip', public.sanitize_text_input(NEW.meta->>'ip'),
      'user_agent', public.sanitize_text_input(NEW.meta->>'user_agent'),
      'timestamp', COALESCE(NEW.meta->>'timestamp', now()::text)
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Update the form submission validation trigger
DROP TRIGGER IF EXISTS validate_form_submission_security_trigger ON public.form_submissions;
CREATE TRIGGER validate_form_submission_security_trigger
  BEFORE INSERT ON public.form_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_form_submission_enhanced();