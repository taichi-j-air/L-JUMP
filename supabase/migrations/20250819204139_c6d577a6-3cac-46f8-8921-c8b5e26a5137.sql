-- Drop all existing policies first
DROP POLICY IF EXISTS "users_can_view_own_products_only" ON public.products;
DROP POLICY IF EXISTS "users_can_view_own_product_settings" ON public.product_settings;
DROP POLICY IF EXISTS "users_can_view_own_product_actions_only" ON public.product_actions;

-- Add new strict policies
CREATE POLICY "strict_users_own_products" 
ON public.products 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "strict_users_own_product_settings" 
ON public.product_settings 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM products p 
    WHERE p.id = product_settings.product_id 
    AND p.user_id = auth.uid()
  )
);

CREATE POLICY "strict_users_own_product_actions" 
ON public.product_actions 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM products p 
    WHERE p.id = product_actions.product_id 
    AND p.user_id = auth.uid()
  )
);