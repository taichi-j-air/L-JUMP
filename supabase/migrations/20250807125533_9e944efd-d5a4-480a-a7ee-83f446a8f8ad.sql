-- ステップ削除時にstep_delivery_trackingも削除されるように外部キー制約を追加
ALTER TABLE step_delivery_tracking 
DROP CONSTRAINT IF EXISTS step_delivery_tracking_step_id_fkey;

ALTER TABLE step_delivery_tracking 
ADD CONSTRAINT step_delivery_tracking_step_id_fkey 
FOREIGN KEY (step_id) REFERENCES steps(id) ON DELETE CASCADE;

-- step_messagesもカスケード削除されるように確認・設定
ALTER TABLE step_messages 
DROP CONSTRAINT IF EXISTS step_messages_step_id_fkey;

ALTER TABLE step_messages 
ADD CONSTRAINT step_messages_step_id_fkey 
FOREIGN KEY (step_id) REFERENCES steps(id) ON DELETE CASCADE;

-- 自動配信スケジューラーをセットアップ（1分間隔でチェック）
SELECT cron.schedule(
  'step-delivery-scheduler',
  '*/1 * * * *', -- 1分ごと
  $$
  SELECT
    net.http_post(
        url:='https://rtjxurmuaawyzjcdkqxt.supabase.co/functions/v1/scheduled-step-delivery',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0anh1cm11YWF3eXpqY2RrcXh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM3Njk4ODAsImV4cCI6MjA2OTM0NTg4MH0.EPQtzXcovNhLtDkFHwqM5uWswAcjDBv_4vf1pjjennY"}'::jsonb,
        body:='{"scheduled": true}'::jsonb
    ) as request_id;
  $$
);

-- 既存のcron jobがあれば削除してから作成
SELECT cron.unschedule('step-delivery-scheduler');
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