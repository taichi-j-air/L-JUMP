-- Add FK with ON DELETE CASCADE from form_submissions.form_id to forms.id
DO $$
BEGIN
  ALTER TABLE public.form_submissions
    ADD CONSTRAINT form_submissions_form_id_fkey
    FOREIGN KEY (form_id)
    REFERENCES public.forms(id)
    ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN
    -- Constraint already exists; replace to ensure CASCADE
    BEGIN
      ALTER TABLE public.form_submissions DROP CONSTRAINT IF EXISTS form_submissions_form_id_fkey;
      ALTER TABLE public.form_submissions
        ADD CONSTRAINT form_submissions_form_id_fkey
        FOREIGN KEY (form_id)
        REFERENCES public.forms(id)
        ON DELETE CASCADE;
    EXCEPTION
      WHEN others THEN
        -- If drop failed because name differs, do nothing
        NULL;
    END;
END$$;