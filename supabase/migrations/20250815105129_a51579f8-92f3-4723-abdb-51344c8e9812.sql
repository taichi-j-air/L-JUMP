-- Drop the existing unique constraint
DROP INDEX IF EXISTS ux_form_submissions_form_friend;

-- Create a new conditional unique constraint that only applies when prevent_duplicate_per_friend is true
CREATE UNIQUE INDEX ux_form_submissions_form_friend_conditional 
ON public.form_submissions (form_id, friend_id) 
WHERE friend_id IS NOT NULL 
  AND EXISTS (
    SELECT 1 FROM public.forms f 
    WHERE f.id = form_submissions.form_id 
      AND f.prevent_duplicate_per_friend = true
  );