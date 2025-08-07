-- 無効なlin.ee URLを完全に削除し、正しいURL生成に修正
UPDATE profiles 
SET add_friend_url = NULL 
WHERE user_id = 'c986e437-a760-4885-ae25-dd8ae3038516';