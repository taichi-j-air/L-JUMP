CREATE TABLE IF NOT EXISTS public.platform_stripe_credentials (
  id uuid PRIMARY KEY DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  test_publishable_key text,
  test_secret_key text,
  live_publishable_key text,
  live_secret_key text
);

ALTER TABLE public.platform_stripe_credentials ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_platform_stripe_credentials_updated_at
BEFORE UPDATE ON public.platform_stripe_credentials
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "developers_select_platform_stripe_credentials"
  ON public.platform_stripe_credentials
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.user_role IN ('developer', 'admin')
    )
  );

CREATE POLICY "developers_upsert_platform_stripe_credentials"
  ON public.platform_stripe_credentials
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.user_role IN ('developer', 'admin')
    )
  );

CREATE POLICY "developers_update_platform_stripe_credentials"
  ON public.platform_stripe_credentials
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.user_role IN ('developer', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.user_role IN ('developer', 'admin')
    )
  );
