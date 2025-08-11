-- Add rich content and timer customization fields to cms_pages
ALTER TABLE public.cms_pages
ADD COLUMN IF NOT EXISTS content text,
ADD COLUMN IF NOT EXISTS timer_mode text NOT NULL DEFAULT 'absolute', -- 'absolute' or 'per_access'
ADD COLUMN IF NOT EXISTS timer_duration_seconds integer, -- used when timer_mode = 'per_access'
ADD COLUMN IF NOT EXISTS show_milliseconds boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS timer_style text NOT NULL DEFAULT 'solid', -- 'solid' | 'glass' | 'outline'
ADD COLUMN IF NOT EXISTS timer_bg_color text NOT NULL DEFAULT '#0cb386',
ADD COLUMN IF NOT EXISTS timer_text_color text NOT NULL DEFAULT '#ffffff';

-- Helpful index for share_code public lookups (optional but useful)
CREATE INDEX IF NOT EXISTS idx_cms_pages_share_code ON public.cms_pages (share_code);
