-- Update the check_duplicate_submission function to handle duplicate_policy
CREATE OR REPLACE FUNCTION public.check_duplicate_submission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  form_duplicate_policy text;
  existing_submission_id uuid;
BEGIN
  -- Get the form's duplicate policy
  SELECT duplicate_policy INTO form_duplicate_policy
  FROM public.forms 
  WHERE id = NEW.form_id;
  
  -- If policy is 'allow', always permit the insertion
  IF form_duplicate_policy = 'allow' THEN
    RETURN NEW;
  END IF;
  
  -- Check for existing submission by friend_id or line_user_id
  IF NEW.friend_id IS NOT NULL THEN
    SELECT id INTO existing_submission_id
    FROM public.form_submissions 
    WHERE form_id = NEW.form_id 
      AND friend_id = NEW.friend_id
      AND id != NEW.id
    LIMIT 1;
  ELSIF NEW.line_user_id IS NOT NULL THEN
    SELECT id INTO existing_submission_id
    FROM public.form_submissions 
    WHERE form_id = NEW.form_id 
      AND line_user_id = NEW.line_user_id
      AND id != NEW.id
    LIMIT 1;
  END IF;
  
  -- Handle based on policy if existing submission found
  IF existing_submission_id IS NOT NULL THEN
    IF form_duplicate_policy = 'block' THEN
      RAISE EXCEPTION 'この友だちは既にこのフォームに回答済みです。'
        USING ERRCODE = '23505';
    ELSIF form_duplicate_policy = 'overwrite' THEN
      -- Update existing submission instead of inserting new one
      UPDATE public.form_submissions 
      SET 
        data = NEW.data,
        meta = NEW.meta,
        submitted_at = now()
      WHERE id = existing_submission_id;
      
      -- Return NULL to prevent the insert
      RETURN NULL;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;