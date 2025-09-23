-- Fix existing cms_pages with timer_duration_seconds = 0 for per_access mode
UPDATE public.cms_pages 
SET timer_duration_seconds = 3600  -- 1 hour default
WHERE timer_enabled = true 
  AND timer_mode = 'per_access' 
  AND (timer_duration_seconds IS NULL OR timer_duration_seconds <= 0);

-- Update friend_page_access records to calculate timer_end_at where missing
UPDATE public.friend_page_access 
SET timer_end_at = (
  timer_start_at + (
    SELECT COALESCE(timer_duration_seconds, 3600) * INTERVAL '1 second'
    FROM public.cms_pages 
    WHERE cms_pages.share_code = friend_page_access.page_share_code
      AND cms_pages.timer_enabled = true
      AND cms_pages.timer_mode = 'per_access'
      AND cms_pages.timer_duration_seconds > 0
    LIMIT 1
  )
)
WHERE timer_end_at IS NULL 
  AND timer_start_at IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.cms_pages 
    WHERE cms_pages.share_code = friend_page_access.page_share_code
      AND cms_pages.timer_enabled = true
      AND cms_pages.timer_mode = 'per_access'
      AND cms_pages.timer_duration_seconds > 0
  );