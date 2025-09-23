-- Add service role access policy for cms_pages table
CREATE POLICY "service_role_can_access_all_cms_pages" 
ON public.cms_pages 
FOR SELECT
USING ((auth.jwt() ->> 'role'::text) = 'service_role'::text);