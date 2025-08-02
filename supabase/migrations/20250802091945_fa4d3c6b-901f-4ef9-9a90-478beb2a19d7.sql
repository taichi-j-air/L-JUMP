-- step_scenarios のRLS設定
ALTER TABLE public.step_scenarios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "公開招待用シナリオ参照" ON public.step_scenarios;
CREATE POLICY "公開招待用シナリオ参照"
  ON public.step_scenarios
  FOR SELECT
  USING (is_active = true);

-- profiles のRLS設定
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "公開プロフィール参照" ON public.profiles;
CREATE POLICY "公開プロフィール参照"
  ON public.profiles
  FOR SELECT
  USING (true);

-- scenario_invite_codes のRLS設定
ALTER TABLE public.scenario_invite_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "公開招待コード参照" ON public.scenario_invite_codes;
CREATE POLICY "公開招待コード参照"
  ON public.scenario_invite_codes
  FOR SELECT
  USING (is_active = true);