-- Create a secure function to resolve friends that bypasses RLS
CREATE OR REPLACE FUNCTION public.resolve_friend_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  owner_user_id uuid;
  source_uid_upper text;
  found_friend record;
BEGIN
  -- Skip if friend already resolved
  IF NEW.friend_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Get form owner
  SELECT user_id INTO owner_user_id
  FROM public.forms 
  WHERE id = NEW.form_id;

  IF owner_user_id IS NULL THEN
    RAISE EXCEPTION 'Form not found: %', NEW.form_id;
  END IF;

  -- Set user_id if not already set
  IF NEW.user_id IS NULL THEN
    NEW.user_id := owner_user_id;
  END IF;

  -- Try to resolve friend from source_uid in meta
  IF NEW.meta IS NOT NULL AND NEW.meta->>'source_uid' IS NOT NULL THEN
    source_uid_upper := UPPER(TRIM(NEW.meta->>'source_uid'));
    
    -- Skip placeholder values
    IF source_uid_upper NOT IN ('[UID]', 'UID', '') THEN
      -- Look up friend by short_uid_ci (bypasses RLS due to SECURITY DEFINER)
      SELECT lf.id, lf.line_user_id
      INTO found_friend
      FROM public.line_friends lf
      WHERE lf.user_id = owner_user_id 
        AND lf.short_uid_ci = source_uid_upper
      LIMIT 1;

      IF found_friend.id IS NOT NULL THEN
        NEW.friend_id := found_friend.id;
        NEW.line_user_id := COALESCE(NEW.line_user_id, found_friend.line_user_id);
      END IF;
    END IF;
  END IF;

  -- Check friend-only form constraint
  DECLARE
    form_requires_friend boolean;
  BEGIN
    SELECT require_line_friend INTO form_requires_friend
    FROM public.forms 
    WHERE id = NEW.form_id;

    IF form_requires_friend = true AND NEW.friend_id IS NULL THEN
      RAISE EXCEPTION 'このフォームはLINE友だち限定です。正しいリンクから開いてください。'
        USING ERRCODE = '42501';
    END IF;
  END;

  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS resolve_friend_on_insert_trigger ON public.form_submissions;

-- Create new trigger using the secure function
CREATE TRIGGER resolve_friend_on_insert_trigger
  BEFORE INSERT ON public.form_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.resolve_friend_on_insert();

-- Update form_submissions INSERT policy to allow public form submissions
DROP POLICY IF EXISTS "insert_public_submissions" ON public.form_submissions;

CREATE POLICY "insert_public_submissions" 
ON public.form_submissions 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.forms f 
    WHERE f.id = form_submissions.form_id 
      AND f.user_id = form_submissions.user_id 
      AND f.is_public = true
  )
);

-- Ensure owner can view their form submissions
DROP POLICY IF EXISTS "owner_selects_submissions" ON public.form_submissions;

CREATE POLICY "owner_selects_submissions" 
ON public.form_submissions 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.forms f 
    WHERE f.id = form_submissions.form_id 
      AND f.user_id = auth.uid()
  )
);