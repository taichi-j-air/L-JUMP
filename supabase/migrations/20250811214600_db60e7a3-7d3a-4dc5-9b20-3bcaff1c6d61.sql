-- Extend cms_pages with advanced fields for friends-only/public pages
-- Safe, idempotent migration

-- Ensure visibility enum exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'page_visibility') THEN
    CREATE TYPE public.page_visibility AS ENUM ('friends_only', 'public');
  END IF;
END$$;

-- Ensure table exists (created previously). If it already exists, this is a no-op.
CREATE TABLE IF NOT EXISTS public.cms_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  share_code TEXT NOT NULL DEFAULT replace(encode(gen_random_bytes(8), 'hex'), '-', ''),
  content TEXT,
  visibility public.page_visibility NOT NULL DEFAULT 'friends_only',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraints
CREATE UNIQUE INDEX IF NOT EXISTS ux_cms_pages_user_slug ON public.cms_pages(user_id, slug);
CREATE UNIQUE INDEX IF NOT EXISTS ux_cms_pages_share_code ON public.cms_pages(share_code);

-- Add extended fields if missing
ALTER TABLE public.cms_pages
  ADD COLUMN IF NOT EXISTS internal_name TEXT,
  ADD COLUMN IF NOT EXISTS tag_label TEXT,
  ADD COLUMN IF NOT EXISTS content_blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS allowed_tag_ids UUID[] NOT NULL DEFAULT ARRAY[]::uuid[],
  ADD COLUMN IF NOT EXISTS blocked_tag_ids UUID[] NOT NULL DEFAULT ARRAY[]::uuid[],
  ADD COLUMN IF NOT EXISTS require_passcode BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS passcode TEXT,
  ADD COLUMN IF NOT EXISTS timer_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS timer_deadline TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS timer_display_mode TEXT NOT NULL DEFAULT 'dhms',
  ADD COLUMN IF NOT EXISTS internal_timer BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS timer_text TEXT,
  ADD COLUMN IF NOT EXISTS expire_action TEXT NOT NULL DEFAULT 'keep_public';

-- RLS
ALTER TABLE public.cms_pages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='cms_pages' AND policyname='select_own_cms_pages'
  ) THEN
    CREATE POLICY "select_own_cms_pages" ON public.cms_pages FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='cms_pages' AND policyname='public_can_view_public_pages'
  ) THEN
    CREATE POLICY "public_can_view_public_pages" ON public.cms_pages FOR SELECT USING (visibility = 'public');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='cms_pages' AND policyname='insert_own_cms_pages'
  ) THEN
    CREATE POLICY "insert_own_cms_pages" ON public.cms_pages FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='cms_pages' AND policyname='update_own_cms_pages'
  ) THEN
    CREATE POLICY "update_own_cms_pages" ON public.cms_pages FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='cms_pages' AND policyname='delete_own_cms_pages'
  ) THEN
    CREATE POLICY "delete_own_cms_pages" ON public.cms_pages FOR DELETE USING (auth.uid() = user_id);
  END IF;
END$$;

-- Updated_at trigger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_update_cms_pages_updated_at'
  ) THEN
    CREATE TRIGGER trigger_update_cms_pages_updated_at
    BEFORE UPDATE ON public.cms_pages
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END$$;