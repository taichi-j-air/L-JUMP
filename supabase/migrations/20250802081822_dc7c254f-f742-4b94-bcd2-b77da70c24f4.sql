-- 既存のビューを削除してから作成し直し
DROP VIEW IF EXISTS public.scenario_invite_stats;

-- profiles テーブルにadd_friend_url追加
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS add_friend_url text;

-- invite_clicks テーブル（完全版）
CREATE TABLE IF NOT EXISTS public.invite_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_code TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT,
  referer TEXT,
  device_type TEXT,
  clicked_at TIMESTAMPTZ DEFAULT now()
);

-- invite_clicksのRLS設定
ALTER TABLE public.invite_clicks ENABLE ROW LEVEL SECURITY;

-- 誰でもクリックログ記録可能（重要）
DROP POLICY IF EXISTS "public insert" ON public.invite_clicks;
CREATE POLICY "public insert" ON public.invite_clicks FOR INSERT WITH CHECK (true);

-- ユーザーは自分の招待コードのクリックのみ参照可能
DROP POLICY IF EXISTS "users can view own clicks" ON public.invite_clicks;
CREATE POLICY "users can view own clicks" ON public.invite_clicks FOR SELECT
USING (EXISTS (
  SELECT 1 FROM scenario_invite_codes sic 
  JOIN step_scenarios ss ON ss.id = sic.scenario_id
  WHERE sic.invite_code = invite_clicks.invite_code AND ss.user_id = auth.uid()
));

-- invite_page_viewsのRLS設定追加（忘れがち）
ALTER TABLE public.invite_page_views ENABLE ROW LEVEL SECURITY;

-- 統計ビュー（完全版）
CREATE VIEW public.scenario_invite_stats AS
SELECT
  c.invite_code,
  c.scenario_id,
  c.user_id,
  COUNT(DISTINCT ic.id) AS clicks,
  COUNT(DISTINCT sl.id) AS friends,
  c.usage_count,
  c.is_active,
  c.created_at
FROM scenario_invite_codes c
LEFT JOIN invite_clicks ic ON ic.invite_code = c.invite_code
LEFT JOIN scenario_friend_logs sl ON sl.invite_code = c.invite_code
GROUP BY c.invite_code, c.scenario_id, c.user_id, c.usage_count, c.is_active, c.created_at;