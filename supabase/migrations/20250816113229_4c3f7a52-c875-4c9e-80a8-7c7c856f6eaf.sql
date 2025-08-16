-- Create products table for managing Stripe products
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_product_id TEXT,
  stripe_price_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2),
  currency TEXT DEFAULT 'jpy',
  product_type TEXT NOT NULL CHECK (product_type IN ('one_time', 'subscription', 'subscription_with_trial')),
  trial_period_days INTEGER,
  interval TEXT CHECK (interval IN ('month', 'year')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create product_settings table for landing page and checkout settings
CREATE TABLE public.product_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  landing_page_title TEXT,
  landing_page_content TEXT,
  landing_page_image_url TEXT,
  button_text TEXT DEFAULT '購入する',
  button_color TEXT DEFAULT '#0cb386',
  success_redirect_url TEXT,
  cancel_redirect_url TEXT,
  custom_parameters JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create product_actions table for success/failure actions
CREATE TABLE public.product_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN ('success', 'failure')),
  
  -- Tag actions
  add_tag_ids UUID[],
  remove_tag_ids UUID[],
  
  -- Scenario actions
  scenario_action TEXT CHECK (scenario_action IN ('add_to_existing', 'replace_all')),
  target_scenario_id UUID,
  
  -- Failure notification settings
  failure_message TEXT,
  notify_user BOOLEAN DEFAULT false,
  notification_method TEXT CHECK (notification_method IN ('line', 'system')),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create stripe_credentials table for secure API key storage
CREATE TABLE public.stripe_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  live_secret_key TEXT,
  live_publishable_key TEXT,
  test_secret_key TEXT,
  test_publishable_key TEXT,
  is_live_mode BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_credentials ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for products
CREATE POLICY "users_can_view_own_products" ON public.products
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "users_can_create_own_products" ON public.products
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "users_can_update_own_products" ON public.products
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "users_can_delete_own_products" ON public.products
  FOR DELETE USING (user_id = auth.uid());

-- Create RLS policies for product_settings
CREATE POLICY "users_can_view_own_product_settings" ON public.product_settings
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.products p WHERE p.id = product_settings.product_id AND p.user_id = auth.uid()
  ));

CREATE POLICY "users_can_create_own_product_settings" ON public.product_settings
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.products p WHERE p.id = product_settings.product_id AND p.user_id = auth.uid()
  ));

CREATE POLICY "users_can_update_own_product_settings" ON public.product_settings
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM public.products p WHERE p.id = product_settings.product_id AND p.user_id = auth.uid()
  ));

CREATE POLICY "users_can_delete_own_product_settings" ON public.product_settings
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM public.products p WHERE p.id = product_settings.product_id AND p.user_id = auth.uid()
  ));

-- Create RLS policies for product_actions
CREATE POLICY "users_can_view_own_product_actions" ON public.product_actions
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.products p WHERE p.id = product_actions.product_id AND p.user_id = auth.uid()
  ));

CREATE POLICY "users_can_create_own_product_actions" ON public.product_actions
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.products p WHERE p.id = product_actions.product_id AND p.user_id = auth.uid()
  ));

CREATE POLICY "users_can_update_own_product_actions" ON public.product_actions
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM public.products p WHERE p.id = product_actions.product_id AND p.user_id = auth.uid()
  ));

CREATE POLICY "users_can_delete_own_product_actions" ON public.product_actions
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM public.products p WHERE p.id = product_actions.product_id AND p.user_id = auth.uid()
  ));

-- Create RLS policies for stripe_credentials
CREATE POLICY "users_can_view_own_stripe_credentials" ON public.stripe_credentials
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "users_can_create_own_stripe_credentials" ON public.stripe_credentials
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "users_can_update_own_stripe_credentials" ON public.stripe_credentials
  FOR UPDATE USING (user_id = auth.uid());

-- Create indexes for better performance
CREATE INDEX idx_products_user_id ON public.products(user_id);
CREATE INDEX idx_product_settings_product_id ON public.product_settings(product_id);
CREATE INDEX idx_product_actions_product_id ON public.product_actions(product_id);
CREATE INDEX idx_stripe_credentials_user_id ON public.stripe_credentials(user_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_product_settings_updated_at
  BEFORE UPDATE ON public.product_settings  
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_product_actions_updated_at
  BEFORE UPDATE ON public.product_actions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_stripe_credentials_updated_at
  BEFORE UPDATE ON public.stripe_credentials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();