-- STEP 1: 強制的に無効URLを削除
UPDATE profiles 
SET add_friend_url = NULL 
WHERE user_id = 'c986e437-a760-4885-ae25-dd8ae3038516'
  AND add_friend_url IS NOT NULL;

-- STEP 2: 既存の招待コードを無効化
UPDATE scenario_invite_codes 
SET is_active = false 
WHERE invite_code = 'fif76que';

-- STEP 3: 確認
SELECT 
  p.line_bot_id,
  p.add_friend_url,
  'データベース修正完了' as status
FROM profiles p 
WHERE p.user_id = 'c986e437-a760-4885-ae25-dd8ae3038516';