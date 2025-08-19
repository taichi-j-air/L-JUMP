-- First remove the existing constraint completely
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;

-- Allow subscription_canceled status now
-- Don't add constraint back yet, just fix the immediate issue