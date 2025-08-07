-- 最終手段: 完全削除後に再挿入で修正
DELETE FROM profiles WHERE user_id = 'c986e437-a760-4885-ae25-dd8ae3038516';

INSERT INTO profiles (
  user_id, 
  line_bot_id, 
  add_friend_url,
  display_name,
  webhook_url,
  line_api_status,
  user_role,
  line_channel_id,
  friends_count,
  monthly_message_limit,
  monthly_message_used,
  quota_updated_at,
  current_month,
  current_year
) VALUES (
  'c986e437-a760-4885-ae25-dd8ae3038516',
  '@617apyhj',
  NULL,  -- add_friend_urlをNULLに設定
  '上田太一',
  'https://rtjxurmuaawyzjcdkqxt.supabase.co/functions/v1/line-webhook',
  'not_configured',
  'user',
  '2007835559',
  1,
  200,
  2,
  NOW(),
  EXTRACT(month FROM NOW()),
  EXTRACT(year FROM NOW())
);