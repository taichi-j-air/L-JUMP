-- 1) Add case-insensitive short_uid column and indexes
ALTER TABLE public.line_friends
  ADD COLUMN IF NOT EXISTS short_uid_ci text
  GENERATED ALWAYS AS (upper(short_uid)) STORED;

-- Create unique index for owner + short_uid (case insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS ux_line_friends_owner_shortuid
  ON public.line_friends(user_id, short_uid_ci)
  WHERE short_uid_ci IS NOT NULL;

-- Create index for owner + line_user_id lookups
CREATE INDEX IF NOT EXISTS ix_line_friends_owner_lineuserid
  ON public.line_friends(user_id, line_user_id);

-- 2) Add meta tracking to form_submissions
ALTER TABLE public.form_submissions
  ADD COLUMN IF NOT EXISTS meta jsonb DEFAULT '{}'::jsonb;

ALTER TABLE public.form_submissions
  ADD COLUMN IF NOT EXISTS source_uid text
  GENERATED ALWAYS AS ((meta->>'source_uid')) STORED;

-- Create index for source_uid analysis
CREATE INDEX IF NOT EXISTS ix_form_submissions_source_uid
  ON public.form_submissions(source_uid)
  WHERE source_uid IS NOT NULL;