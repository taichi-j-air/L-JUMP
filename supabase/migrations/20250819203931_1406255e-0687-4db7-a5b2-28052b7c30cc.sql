-- Fix orders table status constraint to allow subscription_canceled
ALTER TABLE public.orders 
DROP CONSTRAINT IF EXISTS orders_status_check;

-- Add new constraint allowing subscription_canceled status
ALTER TABLE public.orders 
ADD CONSTRAINT orders_status_check 
CHECK (status IN ('pending', 'paid', 'canceled', 'refunded', 'subscription_canceled'));

-- Fix products table RLS policies to ensure users only see their own products
DROP POLICY IF EXISTS "public_can_view_active_products" ON public.products;

-- Update the product viewing policy to only allow users to see their own products or public active products
CREATE POLICY "users_can_view_own_or_active_products" 
ON public.products 
FOR SELECT 
USING (user_id = auth.uid() OR (is_active = true AND auth.role() = 'anon'));

-- Ensure product_settings follow the same pattern
DROP POLICY IF EXISTS "public_can_view_product_settings" ON public.product_settings;

CREATE POLICY "users_and_public_can_view_product_settings" 
ON public.product_settings 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM products p 
    WHERE p.id = product_settings.product_id 
    AND (p.user_id = auth.uid() OR (p.is_active = true AND auth.role() = 'anon'))
  )
);

-- Fix product_actions to only show user's own actions
DROP POLICY IF EXISTS "users_can_view_own_product_actions" ON public.product_actions;

CREATE POLICY "users_can_view_own_product_actions" 
ON public.product_actions 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM products p 
    WHERE p.id = product_actions.product_id 
    AND p.user_id = auth.uid()
  )
);