-- Create line_greeting_settings table
CREATE TABLE IF NOT EXISTS public.line_greeting_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  greeting_type TEXT NOT NULL CHECK (greeting_type IN ('message', 'scenario')),
  greeting_message TEXT,
  scenario_id UUID REFERENCES public.step_scenarios(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.line_greeting_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policy: ユーザーは自分の設定のみ操作可能
CREATE POLICY "users_manage_own_greeting_settings"
ON public.line_greeting_settings
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Add index for performance
CREATE INDEX idx_line_greeting_settings_user_id ON public.line_greeting_settings(user_id);