-- Add toggle controls for timer display settings
ALTER TABLE public.cms_pages 
ADD COLUMN show_remaining_text boolean NOT NULL DEFAULT true,
ADD COLUMN show_end_date boolean NOT NULL DEFAULT true;