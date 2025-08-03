-- Create secure database function to prevent security definer view vulnerability
CREATE OR REPLACE FUNCTION public.get_user_profile_secure(profile_user_id uuid)
RETURNS TABLE(
  display_name text, 
  user_role text,
  line_api_status text,
  friends_count integer
)
LANGUAGE sql
STABLE 
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT 
    p.display_name,
    p.user_role,
    p.line_api_status,
    p.friends_count
  FROM public.profiles p
  WHERE p.user_id = profile_user_id
    AND p.user_role IS NOT NULL;
$function$;

-- Create secure function for rate limiting
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  identifier text,
  max_requests integer,
  time_window_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  current_count integer;
  window_start timestamp;
BEGIN
  -- Calculate window start time
  window_start := now() - (time_window_seconds || ' seconds')::interval;
  
  -- Clean up old entries
  DELETE FROM rate_limit_log 
  WHERE created_at < window_start;
  
  -- Count requests in current window
  SELECT COUNT(*) INTO current_count
  FROM rate_limit_log
  WHERE identifier = check_rate_limit.identifier
    AND created_at >= window_start;
  
  -- Check if limit exceeded
  IF current_count >= max_requests THEN
    RETURN false;
  END IF;
  
  -- Log this request
  INSERT INTO rate_limit_log (identifier, created_at)
  VALUES (check_rate_limit.identifier, now());
  
  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    -- If table doesn't exist, create it
    CREATE TABLE IF NOT EXISTS rate_limit_log (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      identifier text NOT NULL,
      created_at timestamp with time zone NOT NULL DEFAULT now()
    );
    
    -- Create index for performance
    CREATE INDEX IF NOT EXISTS idx_rate_limit_identifier_time 
    ON rate_limit_log (identifier, created_at);
    
    RETURN true;
END;
$function$;

-- Enhanced input validation functions with better security
CREATE OR REPLACE FUNCTION public.validate_and_sanitize_display_name(name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  sanitized text;
BEGIN
  IF name IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Enhanced sanitization
  sanitized := regexp_replace(name, '<[^>]*>', '', 'g'); -- Remove HTML tags
  sanitized := regexp_replace(sanitized, 'javascript:', '', 'gi'); -- Remove javascript: URLs
  sanitized := regexp_replace(sanitized, 'data:', '', 'gi'); -- Remove data: URLs
  sanitized := regexp_replace(sanitized, 'vbscript:', '', 'gi'); -- Remove vbscript: URLs
  sanitized := regexp_replace(sanitized, 'on\w+\s*=', '', 'gi'); -- Remove event handlers
  sanitized := regexp_replace(sanitized, '[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', 'g'); -- Remove control characters
  sanitized := trim(sanitized);
  
  -- Length validation
  IF length(sanitized) < 1 OR length(sanitized) > 100 THEN
    RETURN NULL;
  END IF;
  
  RETURN sanitized;
END;
$function$;

-- Enhanced LINE user ID validation
CREATE OR REPLACE FUNCTION public.validate_line_user_id_enhanced(line_user_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- Enhanced validation: must start with 'U' followed by exactly 32 hex characters
  IF line_user_id IS NULL OR 
     length(line_user_id) != 33 OR
     line_user_id !~ '^U[0-9a-fA-F]{32}$' THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$function$;

-- Create audit log table for security monitoring
CREATE TABLE IF NOT EXISTS public.security_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  action text NOT NULL,
  details jsonb,
  ip_address text,
  user_agent text,
  success boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on audit log
ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;

-- Create policy for audit log (only admins can view)
CREATE POLICY "Admins can view audit logs" 
ON public.security_audit_log 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE user_id = auth.uid() 
    AND user_role = 'admin'
));

-- Create policy for system to insert audit logs
CREATE POLICY "System can insert audit logs" 
ON public.security_audit_log 
FOR INSERT 
WITH CHECK (true);

-- Create function to log security events
CREATE OR REPLACE FUNCTION public.log_security_event(
  p_user_id uuid DEFAULT auth.uid(),
  p_action text DEFAULT '',
  p_details jsonb DEFAULT '{}',
  p_ip_address text DEFAULT '',
  p_user_agent text DEFAULT '',
  p_success boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  INSERT INTO public.security_audit_log (
    user_id, action, details, ip_address, user_agent, success
  ) VALUES (
    p_user_id, p_action, p_details, p_ip_address, p_user_agent, p_success
  );
EXCEPTION
  WHEN OTHERS THEN
    -- Don't fail the main operation if logging fails
    NULL;
END;
$function$;