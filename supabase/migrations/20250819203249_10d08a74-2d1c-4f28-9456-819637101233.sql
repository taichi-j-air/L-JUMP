-- Allow users to delete and update their own orders
CREATE POLICY "users_can_delete_own_orders" 
ON public.orders 
FOR DELETE 
USING (user_id = auth.uid());

CREATE POLICY "users_can_update_own_orders" 
ON public.orders 
FOR UPDATE 
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());