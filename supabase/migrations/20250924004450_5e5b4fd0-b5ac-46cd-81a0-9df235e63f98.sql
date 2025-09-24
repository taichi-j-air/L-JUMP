-- Add content_blocks column to member_site_categories table
ALTER TABLE public.member_site_categories
  ADD COLUMN IF NOT EXISTS content_blocks jsonb NOT NULL DEFAULT '[]'::jsonb;