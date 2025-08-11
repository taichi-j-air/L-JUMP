-- Add form settings and submission friend mapping
BEGIN;

-- forms: add settings
ALTER TABLE public.forms
  ADD COLUMN IF NOT EXISTS require_line_friend boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS prevent_duplicate_per_friend boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS post_submit_scenario_id uuid NULL;

-- Optional FK to step_scenarios
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'forms_post_submit_scenario_id_fkey'
  ) THEN
    ALTER TABLE public.forms
      ADD CONSTRAINT forms_post_submit_scenario_id_fkey
      FOREIGN KEY (post_submit_scenario_id)
      REFERENCES public.step_scenarios(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- form_submissions: add friend mapping columns
ALTER TABLE public.form_submissions
  ADD COLUMN IF NOT EXISTS friend_id uuid NULL,
  ADD COLUMN IF NOT EXISTS line_user_id text NULL;

-- Optional FK to line_friends
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'form_submissions_friend_id_fkey'
  ) THEN
    ALTER TABLE public.form_submissions
      ADD CONSTRAINT form_submissions_friend_id_fkey
      FOREIGN KEY (friend_id)
      REFERENCES public.line_friends(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- Unique per friend per form (only when friend_id is known)
CREATE UNIQUE INDEX IF NOT EXISTS ux_form_submissions_form_friend
  ON public.form_submissions (form_id, friend_id)
  WHERE friend_id IS NOT NULL;

-- Set user_id from forms on insert
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_set_submission_user_id'
  ) THEN
    CREATE TRIGGER trg_set_submission_user_id
    BEFORE INSERT ON public.form_submissions
    FOR EACH ROW
    EXECUTE FUNCTION public.set_submission_user_id();
  END IF;
END $$;

COMMIT;