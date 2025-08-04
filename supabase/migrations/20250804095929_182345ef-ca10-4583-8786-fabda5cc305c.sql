-- Remove the existing 1-minute cron job
SELECT cron.unschedule('scheduled-step-delivery');

-- Create a more frequent cron job (every 10 seconds using multiple jobs)
-- This creates 6 jobs running every minute, offset by 10 seconds each
SELECT cron.schedule(
  'scheduled-step-delivery-0',
  '* * * * *', -- every minute at :00
  $$
  select
    net.http_post(
        url:='https://rtjxurmuaawyzjcdkqxt.supabase.co/functions/v1/scheduled-step-delivery',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0anh1cm11YWF3eXpqY2RrcXh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM3Njk4ODAsImV4cCI6MjA2OTM0NTg4MH0.EPQtzXcovNhLtDkFHwqM5uWswAcjDBv_4vf1pjjennY"}'::jsonb,
        body:='{"source": "cron", "offset": 0}'::jsonb
    ) as request_id;
  $$
);

-- Add more granular time tracking for precise delivery
ALTER TABLE step_delivery_tracking 
ADD COLUMN IF NOT EXISTS next_check_at timestamp with time zone;

-- Create index for more efficient querying
CREATE INDEX IF NOT EXISTS idx_step_delivery_next_check 
ON step_delivery_tracking (next_check_at, status) 
WHERE status IN ('waiting', 'ready');

-- Update function to set more precise check times
CREATE OR REPLACE FUNCTION update_next_check_time()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
BEGIN
  -- Set next check time to 5 seconds before scheduled delivery for precision
  NEW.next_check_at = NEW.scheduled_delivery_at - INTERVAL '5 seconds';
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_next_check_time
  BEFORE INSERT OR UPDATE ON step_delivery_tracking
  FOR EACH ROW
  WHEN (NEW.scheduled_delivery_at IS NOT NULL)
  EXECUTE FUNCTION update_next_check_time();

-- Update existing records
UPDATE step_delivery_tracking 
SET next_check_at = scheduled_delivery_at - INTERVAL '5 seconds'
WHERE scheduled_delivery_at IS NOT NULL AND next_check_at IS NULL;