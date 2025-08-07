-- 古い配信時刻を現在時刻に更新してテストできるようにする
UPDATE step_delivery_tracking 
SET 
  scheduled_delivery_at = NOW() + INTERVAL '30 seconds',
  updated_at = NOW()
WHERE scheduled_delivery_at < NOW() - INTERVAL '1 day';

-- 過去の配信済みステータスをリセット
UPDATE step_delivery_tracking 
SET status = 'ready'
WHERE status = 'waiting' AND scheduled_delivery_at <= NOW();