-- Remove public access policies that allow users to see other users' products
DROP POLICY IF EXISTS "public_can_view_active_products" ON public.products;
DROP POLICY IF EXISTS "public_can_view_product_settings" ON public.product_settings;

-- Ensure users can only see their own products and related data
-- The existing strict policies should handle this, but let's make sure they're the only ones

-- For the public-get-product function, we'll need a separate policy for system access
-- This policy allows the system (service role) to access any product for public API
CREATE POLICY "service_role_can_access_products" 
ON public.products 
FOR SELECT 
USING (
  (auth.jwt() ->> 'role') = 'service_role' OR
  auth.uid() = user_id
);