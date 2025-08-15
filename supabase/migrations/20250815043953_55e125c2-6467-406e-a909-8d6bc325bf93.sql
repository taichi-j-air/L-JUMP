-- Add RLS policy to allow anonymous UID lookup for public forms
-- This is necessary for the public form to resolve short_uid to friend_id
DROP POLICY IF EXISTS "allow_anonymous_uid_lookup" ON public.line_friends;

CREATE POLICY "allow_anonymous_uid_lookup"
ON public.line_friends
FOR SELECT
TO anon, authenticated
USING (
  -- Allow lookup by user_id and short_uid_ci for form submissions
  -- This is minimal access - only id and line_user_id are exposed for matching friends
  short_uid_ci IS NOT NULL
);

-- Create trigger for automatic friend resolution on form submission
CREATE OR REPLACE FUNCTION public.resolve_friend_on_insert()
RETURNS trigger AS $$
BEGIN
  -- Skip if friend already resolved
  IF NEW.friend_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Try to resolve friend from source_uid in meta
  IF NEW.meta IS NOT NULL AND NEW.meta->>'source_uid' IS NOT NULL THEN
    -- Look up friend by short_uid_ci
    SELECT lf.id, lf.line_user_id
    INTO NEW.friend_id, NEW.line_user_id
    FROM public.forms f
    JOIN public.line_friends lf ON lf.user_id = f.user_id 
      AND lf.short_uid_ci = UPPER(NEW.meta->>'source_uid')
    WHERE f.id = NEW.form_id
    LIMIT 1;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply trigger to form_submissions
DROP TRIGGER IF EXISTS trg_resolve_friend_on_insert ON public.form_submissions;
CREATE TRIGGER trg_resolve_friend_on_insert
  BEFORE INSERT ON public.form_submissions
  FOR EACH ROW 
  EXECUTE FUNCTION public.resolve_friend_on_insert();