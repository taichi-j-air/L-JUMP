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

  -- Allow policy → 何もしない
  IF form_duplicate_policy = 'allow' THEN
    RETURN NEW;
  END IF;

  -- 既存回答チェック (friend_id OR line_user_id OR source_uid のいずれか一致)
  SELECT id INTO existing_submission_id
  FROM public.form_submissions
  WHERE form_id = NEW.form_id
    AND (
      (NEW.friend_id IS NOT NULL AND friend_id = NEW.friend_id)
      OR (NEW.line_user_id IS NOT NULL AND line_user_id = NEW.line_user_id)
      OR (NEW.source_uid IS NOT NULL AND source_uid = NEW.source_uid)
    )
  LIMIT 1;

  -- 既存回答があった場合の挙動
  IF existing_submission_id IS NOT NULL THEN
    IF form_duplicate_policy = 'block' THEN
      RAISE EXCEPTION 'このユーザーは既に回答済みです。'
        USING ERRCODE = '23505';
    ELSIF form_duplicate_policy = 'overwrite' THEN
      UPDATE public.form_submissions
      SET 
        data = NEW.data,
        meta = NEW.meta,
        line_user_id = COALESCE(NEW.line_user_id, line_user_id),
        friend_id = COALESCE(NEW.friend_id, friend_id),
        source_uid = COALESCE(NEW.source_uid, source_uid),
        submitted_at = now()
      WHERE id = existing_submission_id;

      -- skip insert
      RETURN NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
