-- Create orders table for tracking payments with uid
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID,
  status TEXT CHECK (status IN ('paid', 'failed', 'expired', 'pending')) DEFAULT 'pending',
  amount INTEGER,
  currency TEXT DEFAULT 'jpy',
  friend_uid TEXT, -- LINE friend identifier from URL
  livemode BOOLEAN DEFAULT false,
  stripe_session_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  stripe_payment_intent_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create stripe_events table for idempotency
CREATE TABLE IF NOT EXISTS public.stripe_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  livemode BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'
);

-- Enable RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;

-- Orders policies
CREATE POLICY "users_can_view_own_orders" ON public.orders
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "system_can_manage_orders" ON public.orders
  FOR ALL USING (true) WITH CHECK (true);

-- Stripe events policies (system only)
CREATE POLICY "system_can_manage_stripe_events" ON public.stripe_events
  FOR ALL USING (true) WITH CHECK (true);

-- Add public select policy for products (for LP page)
CREATE POLICY "public_can_view_active_products" ON public.products
  FOR SELECT USING (is_active = true);

-- Add public select policy for product_settings (for LP page)
CREATE POLICY "public_can_view_product_settings" ON public.product_settings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.products p 
      WHERE p.id = product_settings.product_id 
      AND p.is_active = true
    )
  );

-- Update trigger for orders
CREATE OR REPLACE FUNCTION update_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_orders_updated_at_trigger
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION update_orders_updated_at();