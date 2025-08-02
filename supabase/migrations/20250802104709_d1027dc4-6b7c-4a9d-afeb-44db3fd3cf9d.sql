-- line.me形式に戻す（より確実）
UPDATE profiles 
SET add_friend_url = 'https://line.me/R/ti/p/' || REPLACE(line_bot_id, '@', '')
WHERE user_id = 'c986e437-a760-4885-ae25-dd8ae3038516';