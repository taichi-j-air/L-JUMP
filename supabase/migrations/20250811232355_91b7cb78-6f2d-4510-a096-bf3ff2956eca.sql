-- Add timer label columns to cms_pages for customizable countdown labels
ALTER TABLE public.cms_pages
  ADD COLUMN IF NOT EXISTS timer_day_label text NOT NULL DEFAULT '日',
  ADD COLUMN IF NOT EXISTS timer_hour_label text NOT NULL DEFAULT '時間',
  ADD COLUMN IF NOT EXISTS timer_minute_label text NOT NULL DEFAULT '分',
  ADD COLUMN IF NOT EXISTS timer_second_label text NOT NULL DEFAULT '秒';

-- Optional: set comments for better schema documentation
COMMENT ON COLUMN public.cms_pages.timer_day_label IS 'Label for days in countdown timer (e.g., 日)';
COMMENT ON COLUMN public.cms_pages.timer_hour_label IS 'Label for hours in countdown timer (e.g., 時間)';
COMMENT ON COLUMN public.cms_pages.timer_minute_label IS 'Label for minutes in countdown timer (e.g., 分)';
COMMENT ON COLUMN public.cms_pages.timer_second_label IS 'Label for seconds in countdown timer (e.g., 秒)';