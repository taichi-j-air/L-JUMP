-- Add page_type column to cms_pages table to separate friends-only and public pages
ALTER TABLE public.cms_pages 
ADD COLUMN page_type text NOT NULL DEFAULT 'friends_only';

-- Add check constraint to ensure valid page types
ALTER TABLE public.cms_pages 
ADD CONSTRAINT page_type_check CHECK (page_type IN ('friends_only', 'public'));

-- Update existing pages - assume existing pages are friends_only pages
UPDATE public.cms_pages 
SET page_type = 'friends_only' 
WHERE page_type = 'friends_only';

-- Add index for better query performance
CREATE INDEX idx_cms_pages_page_type ON public.cms_pages(page_type);