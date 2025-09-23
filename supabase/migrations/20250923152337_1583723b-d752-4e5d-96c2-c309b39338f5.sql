-- Create member sites table for basic site information
CREATE TABLE public.member_sites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  slug TEXT NOT NULL,
  domain TEXT,
  is_published BOOLEAN NOT NULL DEFAULT false,
  is_public BOOLEAN NOT NULL DEFAULT false,
  access_type TEXT NOT NULL DEFAULT 'paid', -- 'free', 'paid', 'subscription'
  price NUMERIC DEFAULT 0,
  currency TEXT DEFAULT 'jpy',
  trial_days INTEGER DEFAULT 0,
  theme_config JSONB DEFAULT '{}',
  seo_config JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, slug)
);

-- Create member site content table for page content
CREATE TABLE public.member_site_content (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id UUID NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  content_blocks JSONB DEFAULT '[]',
  page_type TEXT NOT NULL DEFAULT 'page', -- 'page', 'post', 'landing'
  slug TEXT NOT NULL,
  is_published BOOLEAN NOT NULL DEFAULT false,
  access_level TEXT NOT NULL DEFAULT 'member', -- 'public', 'member', 'premium'
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(site_id, slug)
);

-- Create member site users table for user management
CREATE TABLE public.member_site_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id UUID NOT NULL,
  user_email TEXT NOT NULL,
  user_name TEXT,
  line_user_id TEXT,
  friend_id UUID,
  access_level TEXT NOT NULL DEFAULT 'member', -- 'member', 'premium', 'admin'
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'suspended', 'expired'
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  last_access_at TIMESTAMP WITH TIME ZONE,
  total_payment NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(site_id, user_email)
);

-- Create member site payments table for payment settings
CREATE TABLE public.member_site_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id UUID NOT NULL,
  payment_type TEXT NOT NULL DEFAULT 'one_time', -- 'one_time', 'subscription', 'free'
  stripe_product_id TEXT,
  stripe_price_id TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'jpy',
  billing_interval TEXT, -- 'month', 'year' for subscriptions
  trial_period_days INTEGER DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create member site subscriptions table for subscription management
CREATE TABLE public.member_site_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id UUID NOT NULL,
  site_user_id UUID NOT NULL,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'canceled', 'past_due', 'unpaid'
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  cancel_at_period_end BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.member_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_site_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_site_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_site_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_site_subscriptions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for member_sites
CREATE POLICY "Users can view their own sites" ON public.member_sites
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own sites" ON public.member_sites
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sites" ON public.member_sites
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sites" ON public.member_sites
FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for member_site_content
CREATE POLICY "Users can view content of their own sites" ON public.member_site_content
FOR SELECT USING (EXISTS (
  SELECT 1 FROM public.member_sites ms 
  WHERE ms.id = member_site_content.site_id AND ms.user_id = auth.uid()
));

CREATE POLICY "Users can create content for their own sites" ON public.member_site_content
FOR INSERT WITH CHECK (EXISTS (
  SELECT 1 FROM public.member_sites ms 
  WHERE ms.id = member_site_content.site_id AND ms.user_id = auth.uid()
));

CREATE POLICY "Users can update content of their own sites" ON public.member_site_content
FOR UPDATE USING (EXISTS (
  SELECT 1 FROM public.member_sites ms 
  WHERE ms.id = member_site_content.site_id AND ms.user_id = auth.uid()
));

CREATE POLICY "Users can delete content of their own sites" ON public.member_site_content
FOR DELETE USING (EXISTS (
  SELECT 1 FROM public.member_sites ms 
  WHERE ms.id = member_site_content.site_id AND ms.user_id = auth.uid()
));

-- Create RLS policies for member_site_users
CREATE POLICY "Users can view users of their own sites" ON public.member_site_users
FOR SELECT USING (EXISTS (
  SELECT 1 FROM public.member_sites ms 
  WHERE ms.id = member_site_users.site_id AND ms.user_id = auth.uid()
));

CREATE POLICY "Users can create users for their own sites" ON public.member_site_users
FOR INSERT WITH CHECK (EXISTS (
  SELECT 1 FROM public.member_sites ms 
  WHERE ms.id = member_site_users.site_id AND ms.user_id = auth.uid()
));

CREATE POLICY "Users can update users of their own sites" ON public.member_site_users
FOR UPDATE USING (EXISTS (
  SELECT 1 FROM public.member_sites ms 
  WHERE ms.id = member_site_users.site_id AND ms.user_id = auth.uid()
));

CREATE POLICY "Users can delete users of their own sites" ON public.member_site_users
FOR DELETE USING (EXISTS (
  SELECT 1 FROM public.member_sites ms 
  WHERE ms.id = member_site_users.site_id AND ms.user_id = auth.uid()
));

-- Create RLS policies for member_site_payments
CREATE POLICY "Users can view payments of their own sites" ON public.member_site_payments
FOR SELECT USING (EXISTS (
  SELECT 1 FROM public.member_sites ms 
  WHERE ms.id = member_site_payments.site_id AND ms.user_id = auth.uid()
));

CREATE POLICY "Users can create payments for their own sites" ON public.member_site_payments
FOR INSERT WITH CHECK (EXISTS (
  SELECT 1 FROM public.member_sites ms 
  WHERE ms.id = member_site_payments.site_id AND ms.user_id = auth.uid()
));

CREATE POLICY "Users can update payments of their own sites" ON public.member_site_payments
FOR UPDATE USING (EXISTS (
  SELECT 1 FROM public.member_sites ms 
  WHERE ms.id = member_site_payments.site_id AND ms.user_id = auth.uid()
));

CREATE POLICY "Users can delete payments of their own sites" ON public.member_site_payments
FOR DELETE USING (EXISTS (
  SELECT 1 FROM public.member_sites ms 
  WHERE ms.id = member_site_payments.site_id AND ms.user_id = auth.uid()
));

-- Create RLS policies for member_site_subscriptions
CREATE POLICY "Users can view subscriptions of their own sites" ON public.member_site_subscriptions
FOR SELECT USING (EXISTS (
  SELECT 1 FROM public.member_sites ms 
  WHERE ms.id = member_site_subscriptions.site_id AND ms.user_id = auth.uid()
));

CREATE POLICY "Users can create subscriptions for their own sites" ON public.member_site_subscriptions
FOR INSERT WITH CHECK (EXISTS (
  SELECT 1 FROM public.member_sites ms 
  WHERE ms.id = member_site_subscriptions.site_id AND ms.user_id = auth.uid()
));

CREATE POLICY "Users can update subscriptions of their own sites" ON public.member_site_subscriptions
FOR UPDATE USING (EXISTS (
  SELECT 1 FROM public.member_sites ms 
  WHERE ms.id = member_site_subscriptions.site_id AND ms.user_id = auth.uid()
));

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_member_sites_updated_at
  BEFORE UPDATE ON public.member_sites
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_member_site_content_updated_at
  BEFORE UPDATE ON public.member_site_content
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_member_site_users_updated_at
  BEFORE UPDATE ON public.member_site_users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_member_site_payments_updated_at
  BEFORE UPDATE ON public.member_site_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_member_site_subscriptions_updated_at
  BEFORE UPDATE ON public.member_site_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();