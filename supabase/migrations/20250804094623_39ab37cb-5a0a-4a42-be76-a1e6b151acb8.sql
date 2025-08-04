-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the step delivery function to run every minute
SELECT cron.schedule(
  'scheduled-step-delivery',
  '* * * * *', -- every minute
  $$
  select
    net.http_post(
        url:='https://rtjxurmuaawyzjcdkqxt.supabase.co/functions/v1/scheduled-step-delivery',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0anh1cm11YWF3eXpqY2RrcXh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM3Njk4ODAsImV4cCI6MjA2OTM0NTg4MH0.EPQtzXcovNhLtDkFHwqM5uWswAcjDBv_4vf1pjjennY"}'::jsonb,
        body:='{"source": "cron"}'::jsonb
    ) as request_id;
  $$
);