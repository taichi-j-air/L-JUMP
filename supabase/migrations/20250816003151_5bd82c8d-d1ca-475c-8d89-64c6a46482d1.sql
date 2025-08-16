-- Set endlix5541@gmail.com as developer account
UPDATE public.profiles 
SET user_role = 'developer' 
WHERE user_id IN (
  SELECT id 
  FROM auth.users 
  WHERE email = 'endlix5541@gmail.com'
);

-- Create plan management table for flexible pricing
CREATE TABLE public.plan_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_type plan_type NOT NULL,
  name TEXT NOT NULL,
  monthly_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  yearly_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  message_limit INTEGER NOT NULL DEFAULT 0,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.plan_configs ENABLE ROW LEVEL SECURITY;

-- Policies for plan_configs
CREATE POLICY "developers_can_manage_plan_configs" ON public.plan_configs
FOR ALL
USING (EXISTS (
  SELECT 1 FROM profiles p
  WHERE p.user_id = auth.uid() AND p.user_role = 'developer'
));

CREATE POLICY "all_users_can_read_plan_configs" ON public.plan_configs
FOR SELECT
USING (is_active = true);

-- Insert default plan configurations
INSERT INTO public.plan_configs (plan_type, name, monthly_price, yearly_price, message_limit, features) VALUES
('free', 'フリープラン', 0, 0, 100, '["基本的な機能のみ", "月間メッセージ数制限あり", "シナリオ数制限あり", "サポートなし"]'::jsonb),
('basic', 'ベーシックプラン', 2980, 29800, 10000, '["全機能利用可能", "月間メッセージ数 10,000通", "シナリオ数無制限", "メールサポート", "フォーム機能", "タグ管理"]'::jsonb),
('premium', 'プレミアムプラン', 9800, 98000, 50000, '["ベーシックプランの全機能", "月間メッセージ数 50,000通", "優先サポート", "高度な分析機能", "API利用可能", "カスタムブランディング"]'::jsonb);

-- Add yearly billing option to user_plans
ALTER TABLE public.user_plans ADD COLUMN is_yearly BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.user_plans ADD COLUMN stripe_customer_id TEXT;
ALTER TABLE public.user_plans ADD COLUMN stripe_subscription_id TEXT;

-- Create updated_at trigger for plan_configs
CREATE TRIGGER update_plan_configs_updated_at
BEFORE UPDATE ON public.plan_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();