-- 孤立したstep_delivery_trackingレコードを削除
DELETE FROM step_delivery_tracking 
WHERE step_id NOT IN (SELECT id FROM steps);

-- 孤立したstep_messagesレコードを削除
DELETE FROM step_messages 
WHERE step_id NOT IN (SELECT id FROM steps);

-- 外部キー制約を追加
ALTER TABLE step_delivery_tracking 
ADD CONSTRAINT step_delivery_tracking_step_id_fkey 
FOREIGN KEY (step_id) REFERENCES steps(id) ON DELETE CASCADE;

ALTER TABLE step_messages 
ADD CONSTRAINT step_messages_step_id_fkey 
FOREIGN KEY (step_id) REFERENCES steps(id) ON DELETE CASCADE;