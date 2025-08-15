-- Fix function search path security warning
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public', 'pg_temp';