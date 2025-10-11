-- Table to store per-user LINE greeting settings
CREATE TABLE IF NOT EXISTS public.line_greeting_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  greeting_type text NOT NULL DEFAULT 'message' CHECK (greeting_type IN ('message','scenario')),
  greeting_message text,
  scenario_id uuid REFERENCES public.step_scenarios(id) ON DELETE SET NULL,
  scenario_invite_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_line_greeting_settings_user ON public.line_greeting_settings(user_id);

ALTER TABLE public.line_greeting_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_line_greeting_settings"
  ON public.line_greeting_settings
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "insert_own_line_greeting_settings"
  ON public.line_greeting_settings
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (
      scenario_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.step_scenarios s
        WHERE s.id = line_greeting_settings.scenario_id
          AND s.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "update_own_line_greeting_settings"
  ON public.line_greeting_settings
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (
      scenario_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.step_scenarios s
        WHERE s.id = line_greeting_settings.scenario_id
          AND s.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "delete_own_line_greeting_settings"
  ON public.line_greeting_settings
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_line_greeting_settings_updated_at
BEFORE UPDATE ON public.line_greeting_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
