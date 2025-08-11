-- Add customizable color columns for forms
ALTER TABLE public.forms
  ADD COLUMN IF NOT EXISTS submit_button_bg_color TEXT NOT NULL DEFAULT '#0cb386',
  ADD COLUMN IF NOT EXISTS submit_button_text_color TEXT NOT NULL DEFAULT '#ffffff',
  ADD COLUMN IF NOT EXISTS accent_color TEXT NOT NULL DEFAULT '#0cb386';