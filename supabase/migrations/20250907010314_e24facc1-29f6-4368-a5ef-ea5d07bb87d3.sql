-- Add is_published column to cms_pages table
ALTER TABLE public.cms_pages 
ADD COLUMN is_published boolean NOT NULL DEFAULT true;

-- Add comment to explain the column
COMMENT ON COLUMN public.cms_pages.is_published IS 'Controls whether the page is visible to LINE friends. true = visible, false = completely private';