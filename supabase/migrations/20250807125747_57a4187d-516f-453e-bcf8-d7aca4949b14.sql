-- 孤立したstep_delivery_trackingレコードを削除
DELETE FROM step_delivery_tracking 
WHERE step_id NOT IN (SELECT id FROM steps);

-- step_delivery_trackingの外部キー制約を更新（既存を削除してCASCADE付きで再作成）
ALTER TABLE step_delivery_tracking 
DROP CONSTRAINT IF EXISTS step_delivery_tracking_step_id_fkey;

ALTER TABLE step_delivery_tracking 
ADD CONSTRAINT step_delivery_tracking_step_id_fkey 
FOREIGN KEY (step_id) REFERENCES steps(id) ON DELETE CASCADE;

-- 自動配信スケジューラーをセットアップ（1分ごと）
SELECT cron.schedule(
  'step-delivery-scheduler',
  '*/1 * * * *',
  $$
  SELECT
    net.http_post(
        url:='https://rtjxurmuaawyzjcdkqxt.supabase.co/functions/v1/scheduled-step-delivery',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0anh1cm11YWF3eXpqY2RrcXh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM3Njk4ODAsImV4cCI6MjA2OTM0NTg4MH0.EPQtzXcovNhLtDkFHwqM5uWswAcjDBv_4vf1pjjennY"}'::jsonb,
        body:='{"scheduled": true}'::jsonb
    ) as request_id;
  $$
);