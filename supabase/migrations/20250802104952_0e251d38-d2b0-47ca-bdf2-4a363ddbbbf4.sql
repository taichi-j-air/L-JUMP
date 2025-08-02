-- 直接更新を実行
UPDATE public.profiles 
SET add_friend_url = 'https://line.me/R/ti/p/617apyhj'
WHERE user_id = 'c986e437-a760-4885-ae25-dd8ae3038516';

-- 確認クエリ
SELECT add_friend_url, line_bot_id FROM public.profiles WHERE user_id = 'c986e437-a760-4885-ae25-dd8ae3038516';