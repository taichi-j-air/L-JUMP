-- 開発者アカウント管理のためのテーブルとプラン管理機能を追加

-- プランの種類を定義
CREATE TYPE public.plan_type AS ENUM ('free', 'basic', 'premium', 'developer');

-- ユーザープランテーブル
CREATE TABLE public.user_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_type plan_type NOT NULL DEFAULT 'free',
  plan_start_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  plan_end_date TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  monthly_revenue DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- メンテナンスモード設定テーブル
CREATE TABLE public.system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 投稿機能のテーブル
CREATE TABLE public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_published BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS設定
ALTER TABLE public.user_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- user_plansのRLSポリシー
CREATE POLICY "users_can_view_own_plan" ON public.user_plans
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "developers_can_manage_all_plans" ON public.user_plans
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() 
      AND p.user_role = 'developer'
    )
  );

-- system_settingsのRLSポリシー  
CREATE POLICY "developers_can_manage_system_settings" ON public.system_settings
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() 
      AND p.user_role = 'developer'
    )
  );

CREATE POLICY "all_users_can_read_settings" ON public.system_settings
  FOR SELECT
  USING (true);

-- announcementsのRLSポリシー
CREATE POLICY "all_users_can_read_published_announcements" ON public.announcements
  FOR SELECT
  USING (is_published = true);

CREATE POLICY "developers_can_manage_announcements" ON public.announcements
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() 
      AND p.user_role = 'developer'
    )
  );

-- 更新時刻の自動更新
CREATE TRIGGER update_user_plans_updated_at
  BEFORE UPDATE ON public.user_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_system_settings_updated_at
  BEFORE UPDATE ON public.system_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_announcements_updated_at
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 初期メンテナンスモード設定
INSERT INTO public.system_settings (setting_key, setting_value, description)
VALUES ('maintenance_mode', 'false', '全体のメンテナンスモードの状態');

-- 開発者用の売上集計ビュー
CREATE VIEW public.user_revenue_stats AS
SELECT 
  p.user_id,
  p.display_name,
  up.plan_type,
  up.monthly_revenue,
  up.plan_start_date,
  up.plan_end_date,
  up.is_active,
  ROW_NUMBER() OVER (ORDER BY up.monthly_revenue DESC) as revenue_rank
FROM public.profiles p
LEFT JOIN public.user_plans up ON p.user_id = up.user_id
WHERE up.is_active = true;

-- ビューのRLS（開発者のみアクセス可能）
ALTER VIEW public.user_revenue_stats SET (security_barrier = true);
CREATE POLICY "developers_can_view_revenue_stats" ON public.user_revenue_stats
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() 
      AND p.user_role = 'developer'
    )
  );