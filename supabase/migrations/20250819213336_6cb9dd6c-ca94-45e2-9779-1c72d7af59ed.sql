-- Fix security vulnerability in stripe_events table
-- Remove public access and restrict to service role only

-- Drop existing policies that allow public access
DROP POLICY IF EXISTS "system_can_manage_stripe_events" ON public.stripe_events;
DROP POLICY IF EXISTS "system_can_manage_events" ON public.stripe_events;
DROP POLICY IF EXISTS "users_can_view_own_events" ON public.stripe_events;
DROP POLICY IF EXISTS "system_can_insert_events" ON public.stripe_events;

-- Create secure policy that only allows service role access
CREATE POLICY "service_role_only_stripe_events" ON public.stripe_events
FOR ALL 
USING ((auth.jwt() ->> 'role'::text) = 'service_role'::text)
WITH CHECK ((auth.jwt() ->> 'role'::text) = 'service_role'::text);

-- Ensure RLS is enabled
ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;