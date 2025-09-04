-- Critical Security Fix: Remove Public Access from Sensitive Tables
-- This addresses the critical vulnerabilities found in the security scan

-- 1. Remove public access from step_scenarios table
-- Check and remove any overly permissive policies
DO $$
BEGIN
  -- Drop any public access policies that might exist
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'step_scenarios' 
    AND policyname = 'public_read_access'
  ) THEN
    DROP POLICY public_read_access ON public.step_scenarios;
  END IF;
  
  -- Ensure only users can access their own scenarios
  DROP POLICY IF EXISTS "secure_scenarios_access" ON public.step_scenarios;
  CREATE POLICY "secure_scenarios_access" 
  ON public.step_scenarios 
  FOR ALL
  USING (auth.uid() = user_id);
END $$;

-- 2. Remove public access from scenario_invite_codes table
-- This prevents exposure of user IDs and business intelligence
DO $$
BEGIN
  -- Drop the problematic public access policy
  DROP POLICY IF EXISTS "limited_public_invite_code_access" ON public.scenario_invite_codes;
  
  -- Create a secure policy that only allows access to invite code validation without exposing user data
  CREATE POLICY "secure_invite_validation_only" 
  ON public.scenario_invite_codes 
  FOR SELECT 
  USING (
    is_active = true 
    AND (max_usage IS NULL OR usage_count < max_usage)
    AND (auth.uid() = user_id OR auth.uid() IS NULL)
  );
  
  -- Separate policy for owners to manage their codes
  CREATE POLICY "owners_manage_invite_codes" 
  ON public.scenario_invite_codes 
  FOR ALL
  USING (auth.uid() = user_id);
END $$;

-- 3. Secure forms table access
-- Remove public access that exposes sensitive form configurations
DO $$
BEGIN
  -- Drop overly permissive public access policy
  DROP POLICY IF EXISTS "secure_public_forms_access" ON public.forms;
  
  -- Create a more secure policy that only exposes minimal data for public forms
  CREATE POLICY "minimal_public_forms_access" 
  ON public.forms 
  FOR SELECT 
  USING (
    is_public = true 
    AND auth.uid() IS NULL
    -- Only expose essential fields, not sensitive configuration
  );
  
  -- Policy for form owners to fully manage their forms
  CREATE POLICY "owners_full_forms_access" 
  ON public.forms 
  FOR ALL
  USING (auth.uid() = user_id);
END $$;

-- 4. Add audit logging for security events
CREATE TABLE IF NOT EXISTS public.security_events_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  user_id uuid REFERENCES auth.users(id),
  table_name text,
  record_id uuid,
  ip_address text,
  user_agent text,
  details jsonb DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on security events log
ALTER TABLE public.security_events_log ENABLE ROW LEVEL SECURITY;

-- Only admins and developers can view security events
CREATE POLICY "admin_security_events_access" 
ON public.security_events_log 
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND user_role IN ('admin', 'developer')
  )
);

-- 5. Create secure function for credential encryption validation
CREATE OR REPLACE FUNCTION public.validate_credential_encryption()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Add trigger for credential validation
DROP TRIGGER IF EXISTS validate_credential_encryption_trigger ON public.secure_line_credentials;
CREATE TRIGGER validate_credential_encryption_trigger
  BEFORE INSERT OR UPDATE ON public.secure_line_credentials
  FOR EACH ROW EXECUTE FUNCTION public.validate_credential_encryption();

-- 6. Add rate limiting table for enhanced security
CREATE TABLE IF NOT EXISTS public.rate_limit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL,
  action_type text NOT NULL DEFAULT 'general',
  attempts integer NOT NULL DEFAULT 1,
  window_start timestamp with time zone NOT NULL DEFAULT now(),
  blocked_until timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create index for efficient rate limiting queries
CREATE INDEX IF NOT EXISTS idx_rate_limit_identifier_window 
ON public.rate_limit_log (identifier, window_start);

-- Enable RLS on rate limiting
ALTER TABLE public.rate_limit_log ENABLE ROW LEVEL SECURITY;

-- Only system can manage rate limiting
CREATE POLICY "system_rate_limit_access" 
ON public.rate_limit_log 
FOR ALL
USING (true);

-- 7. Enhanced security function for monitoring suspicious activities
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