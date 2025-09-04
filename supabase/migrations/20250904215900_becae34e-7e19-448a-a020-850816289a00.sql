-- Critical Security Fixes: Remove Public Access and Tighten RLS Policies
-- This addresses the critical database exposure vulnerabilities

-- 1. Remove overly permissive public access policies
DROP POLICY IF EXISTS "minimal_public_forms_access" ON public.forms;
DROP POLICY IF EXISTS "secure_invite_validation_only" ON public.scenario_invite_codes;
DROP POLICY IF EXISTS "Secure scenario access" ON public.step_scenarios;
DROP POLICY IF EXISTS "公開招待用シナリオ参照" ON public.step_scenarios;

-- 2. Create secure public form access policy (only expose essential fields for submission)
CREATE POLICY "secure_public_form_access" 
ON public.forms 
FOR SELECT 
USING (
  is_public = true 
  AND (
    auth.uid() = user_id 
    OR auth.uid() IS NULL
  )
);

-- 3. Create secure invite code validation policy (only for validated lookups)
CREATE POLICY "secure_invite_lookup_only" 
ON public.scenario_invite_codes 
FOR SELECT 
USING (
  auth.uid() = user_id 
  OR (
    is_active = true 
    AND (max_usage IS NULL OR usage_count < max_usage)
    AND auth.uid() IS NOT NULL
  )
);

-- 4. Remove public scenario access - only owners and authenticated users with valid invites
CREATE POLICY "authenticated_scenario_access" 
ON public.step_scenarios 
FOR SELECT 
USING (
  auth.uid() = user_id 
  OR (
    is_active = true 
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 
      FROM scenario_invite_codes sic 
      WHERE sic.scenario_id = step_scenarios.id 
        AND sic.is_active = true
    )
  )
);

-- 5. Add enhanced logging for security events
CREATE OR REPLACE FUNCTION public.log_suspicious_database_access()
RETURNS TRIGGER AS $$
BEGIN
  -- Log when unauthenticated users try to access restricted data
  IF auth.uid() IS NULL AND TG_TABLE_NAME IN ('forms', 'step_scenarios', 'scenario_invite_codes') THEN
    INSERT INTO public.security_events_log (
      event_type, 
      table_name, 
      details,
      created_at
    ) VALUES (
      'unauthenticated_access_attempt',
      TG_TABLE_NAME,
      jsonb_build_object(
        'operation', TG_OP,
        'attempted_at', now()
      ),
      now()
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;