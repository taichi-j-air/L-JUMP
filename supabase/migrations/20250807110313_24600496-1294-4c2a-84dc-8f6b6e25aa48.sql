-- 全ての無効なlin.ee URLを削除
UPDATE profiles 
SET add_friend_url = NULL 
WHERE add_friend_url LIKE 'https://lin.ee/617apyhj%';

-- 確認: 招待コードfif76queの関連データを表示
SELECT 
  p.user_id,
  p.line_bot_id,
  p.add_friend_url,
  sic.invite_code,
  sic.scenario_id
FROM profiles p 
JOIN step_scenarios s ON s.user_id = p.user_id 
JOIN scenario_invite_codes sic ON sic.scenario_id = s.id 
WHERE sic.invite_code = 'fif76que';