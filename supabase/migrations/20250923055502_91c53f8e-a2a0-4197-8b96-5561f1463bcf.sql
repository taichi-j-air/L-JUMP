-- Fix timer_end_at for affected friend_page_access records
-- First, update cms_pages to have correct timer_duration_seconds (3 seconds for the test page)
UPDATE public.cms_pages 
SET timer_duration_seconds = 3
WHERE share_code = '068efb24fe66ba0e' 
  AND timer_enabled = true 
  AND timer_mode = 'per_access';

-- Then fix the friend_page_access record to have correct timer_end_at
UPDATE public.friend_page_access 
SET timer_end_at = timer_start_at + INTERVAL '3 seconds',
    updated_at = now()
WHERE page_share_code = '068efb24fe66ba0e'
  AND timer_start_at IS NOT NULL;

-- Update friend_page_access records for all pages to use correct timer_duration_seconds from cms_pages
UPDATE public.friend_page_access 
SET timer_end_at = (
  timer_start_at + (
    SELECT COALESCE(timer_duration_seconds, 3600) * INTERVAL '1 second'
    FROM public.cms_pages 
    WHERE cms_pages.share_code = friend_page_access.page_share_code
      AND cms_pages.timer_enabled = true
      AND cms_pages.timer_mode = 'per_access'
    LIMIT 1
  )
),
updated_at = now()
WHERE timer_start_at IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.cms_pages 
    WHERE cms_pages.share_code = friend_page_access.page_share_code
      AND cms_pages.timer_enabled = true
      AND cms_pages.timer_mode = 'per_access'
      AND timer_duration_seconds > 0
  )
  AND (
    timer_end_at IS NULL 
    OR timer_end_at > timer_start_at + INTERVAL '1 day' -- Fix records with incorrect long durations
  );