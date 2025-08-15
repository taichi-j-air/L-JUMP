-- 1. Create success message templates table for user-specific templates
CREATE TABLE IF NOT EXISTS public.success_message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  content_html TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.success_message_templates ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for templates
CREATE POLICY "templates_owner_select"
ON public.success_message_templates FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "templates_owner_cud"
ON public.success_message_templates FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_success_templates_user ON public.success_message_templates(user_id);

-- 2. Add new columns to forms table
ALTER TABLE public.forms
  ADD COLUMN IF NOT EXISTS success_message_mode TEXT NOT NULL DEFAULT 'plain'
    CHECK (success_message_mode IN ('plain','rich')),
  ADD COLUMN IF NOT EXISTS success_message_plain TEXT,
  ADD COLUMN IF NOT EXISTS success_message_template_id UUID NULL
    REFERENCES public.success_message_templates(id) ON DELETE SET NULL;

-- 3. Update form_submissions to cascade delete when forms are deleted
ALTER TABLE public.form_submissions
  DROP CONSTRAINT IF EXISTS form_submissions_form_id_fkey;

ALTER TABLE public.form_submissions
  ADD CONSTRAINT form_submissions_form_id_fkey
  FOREIGN KEY (form_id) REFERENCES public.forms(id) ON DELETE CASCADE;

-- 4. Create trigger to update updated_at on templates
CREATE OR REPLACE FUNCTION public.update_success_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_success_templates_updated_at
BEFORE UPDATE ON public.success_message_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_success_templates_updated_at();