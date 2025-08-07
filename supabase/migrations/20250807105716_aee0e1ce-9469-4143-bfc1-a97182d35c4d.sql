-- 無効なlin.ee URLを削除し、bot IDベースのURLに統一
UPDATE profiles 
SET add_friend_url = NULL 
WHERE add_friend_url LIKE 'https://lin.ee/617apyhj%';

-- line_bot_idが有効な場合はそのまま保持（scenario-invite関数が適切にURLを生成）