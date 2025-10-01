-- Enable required extensions and schedule scheduled-step-delivery invocations
-- 1) Ensure extensions schema exists (usually pre-created in Supabase, safe to call)
CREATE SCHEMA IF NOT EXISTS extensions;

-- 2) Enable pg_net and pg_cron (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- 3) (Re)create cron job to invoke the edge function every minute
DO $$
BEGIN
  -- Unschedule existing job with the same name if present (idempotent)
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'scheduled-step-delivery-every-minute') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'scheduled-step-delivery-every-minute';
  END IF;

  -- Schedule the job (every minute) with properly escaped SQL
  PERFORM cron.schedule(
    'scheduled-step-delivery-every-minute',
    '* * * * *',
    $cron$
    SELECT net.http_post(
      url := 'https://rtjxurmuaawyzjcdkqxt.supabase.co/functions/v1/scheduled-step-delivery',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0anh1cm11YWF3eXpqY2RrcXh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM3Njk4ODAsImV4cCI6MjA2OTM0NTg4MH0.EPQtzXcovNhLtDkFHwqM5uWswAcjDBv_4vf1pjjennY"}'::jsonb,
      body := '{"source":"cron"}'::jsonb
    ) AS request_id;
    $cron$
  );
END $$;

-- 4) Kick once immediately to process any backlog
SELECT net.http_post(
  url := 'https://rtjxurmuaawyzjcdkqxt.supabase.co/functions/v1/scheduled-step-delivery',
  headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0anh1cm11YWF3eXpqY2RrcXh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM3Njk4ODAsImV4cCI6MjA2OTM0NTg4MH0.EPQtzXcovNhLtDkFHwqM5uWswAcjDBv_4vf1pjjennY"}'::jsonb,
  body := '{"source":"migration-init"}'::jsonb
) AS kicked;