-- Drop the existing unique constraint completely since we'll handle duplicates in application logic
DROP INDEX IF EXISTS ux_form_submissions_form_friend;

-- Add error handling function for duplicate submissions
CREATE OR REPLACE FUNCTION public.check_duplicate_submission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  form_prevents_duplicates boolean;
BEGIN
  -- Only check for duplicates if friend_id is not null
  IF NEW.friend_id IS NOT NULL THEN
    -- Get the form's duplicate prevention setting
    SELECT prevent_duplicate_per_friend INTO form_prevents_duplicates
    FROM public.forms 
    WHERE id = NEW.form_id;
    
    -- If form prevents duplicates, check for existing submission
    IF form_prevents_duplicates = true THEN
      IF EXISTS (
        SELECT 1 FROM public.form_submissions 
        WHERE form_id = NEW.form_id 
          AND friend_id = NEW.friend_id
          AND id != NEW.id
      ) THEN
        RAISE EXCEPTION 'この友だちは既にこのフォームに回答済みです。'
          USING ERRCODE = '23505';
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for duplicate check
CREATE TRIGGER check_duplicate_submission_trigger
  BEFORE INSERT ON public.form_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.check_duplicate_submission();