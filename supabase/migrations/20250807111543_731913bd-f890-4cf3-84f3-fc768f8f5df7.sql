-- STEP 1: 失われたシナリオデータを復旧
-- テスト用のシナリオを作成
INSERT INTO step_scenarios (id, name, user_id, description, is_active, scenario_order) 
VALUES (
  '5bd01ede-b630-415c-9249-d6c6d0c8454b',
  'テストシナリオ', 
  'c986e437-a760-4885-ae25-dd8ae3038516',
  'LINE友だち追加テスト用シナリオ',
  true,
  1
);

-- STEP 2: 新しい招待コードを作成
INSERT INTO scenario_invite_codes (invite_code, scenario_id, user_id, is_active, max_usage, usage_count)
VALUES (
  'newtest001',
  '5bd01ede-b630-415c-9249-d6c6d0c8454b',
  'c986e437-a760-4885-ae25-dd8ae3038516', 
  true,
  NULL,
  0
);

-- STEP 3: 確認
SELECT 
  'データ復旧完了' as status,
  sic.invite_code,
  ss.name as scenario_name,
  p.line_bot_id
FROM scenario_invite_codes sic
JOIN step_scenarios ss ON ss.id = sic.scenario_id  
JOIN profiles p ON p.user_id = ss.user_id
WHERE sic.invite_code = 'newtest001';