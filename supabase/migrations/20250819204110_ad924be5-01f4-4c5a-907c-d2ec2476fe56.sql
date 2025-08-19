-- Fix products table RLS policies to ensure users only see their own products
DROP POLICY IF EXISTS "public_can_view_active_products" ON public.products;
DROP POLICY IF EXISTS "users_can_view_own_or_active_products" ON public.products;

CREATE POLICY "users_can_view_own_products_only" 
ON public.products 
FOR SELECT 
USING (user_id = auth.uid());

-- Update product_settings to only show user's own settings
DROP POLICY IF EXISTS "public_can_view_product_settings" ON public.product_settings;
DROP POLICY IF EXISTS "users_and_public_can_view_product_settings" ON public.product_settings;

CREATE POLICY "users_can_view_own_product_settings" 
ON public.product_settings 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM products p 
    WHERE p.id = product_settings.product_id 
    AND p.user_id = auth.uid()
  )
);

-- Fix product_actions to only show user's own actions
DROP POLICY IF EXISTS "users_can_view_own_product_actions" ON public.product_actions;
DROP POLICY IF EXISTS "users_can_view_own_product_actions_strict" ON public.product_actions;

CREATE POLICY "users_can_view_own_product_actions_only" 
ON public.product_actions 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM products p 
    WHERE p.id = product_actions.product_id 
    AND p.user_id = auth.uid()
  )
);