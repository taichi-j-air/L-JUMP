-- Add monitoring triggers for security events
CREATE TRIGGER log_forms_access_trigger
  BEFORE SELECT ON public.forms
  FOR EACH ROW
  EXECUTE FUNCTION public.log_suspicious_database_access();

CREATE TRIGGER log_scenarios_access_trigger
  BEFORE SELECT ON public.step_scenarios
  FOR EACH ROW
  EXECUTE FUNCTION public.log_suspicious_database_access();

CREATE TRIGGER log_invite_codes_access_trigger
  BEFORE SELECT ON public.scenario_invite_codes
  FOR EACH ROW
  EXECUTE FUNCTION public.log_suspicious_database_access();

-- Add index for security events for better performance
CREATE INDEX IF NOT EXISTS idx_security_events_log_timestamp 
ON public.security_events_log (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_security_events_log_event_type 
ON public.security_events_log (event_type);

-- Add function to clean up old security events (retention policy)
CREATE OR REPLACE FUNCTION public.cleanup_old_security_events()
RETURNS void AS $$
BEGIN
  -- Keep only events from last 30 days
  DELETE FROM public.security_events_log 
  WHERE created_at < now() - interval '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;