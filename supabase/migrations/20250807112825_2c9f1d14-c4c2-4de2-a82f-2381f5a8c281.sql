-- シナリオ用のSTEPを作成
INSERT INTO steps (id, scenario_id, name, step_order, delivery_type, delivery_days, delivery_hours, delivery_minutes, delivery_seconds)
VALUES (
  '00000000-0000-4000-8000-000000000001',
  '5bd01ede-b630-415c-9249-d6c6d0c8454b',
  'ステップ1：ウェルカムメッセージ',
  1,
  'immediate',
  0,
  0,
  0,
  0
);

INSERT INTO steps (id, scenario_id, name, step_order, delivery_type, delivery_days, delivery_hours, delivery_minutes, delivery_seconds)
VALUES (
  '00000000-0000-4000-8000-000000000002',
  '5bd01ede-b630-415c-9249-d6c6d0c8454b',
  'ステップ2：フォローアップメッセージ',
  2,
  'relative',
  0,
  0,
  1,
  0
);

-- STEP1のメッセージを作成
INSERT INTO step_messages (step_id, message_type, content, message_order)
VALUES (
  '00000000-0000-4000-8000-000000000001',
  'text',
  'こんにちは！友だち追加ありがとうございます🎉\nテストシナリオを開始します。',
  1
);

-- STEP2のメッセージを作成  
INSERT INTO step_messages (step_id, message_type, content, message_order)
VALUES (
  '00000000-0000-4000-8000-000000000002',
  'text',
  'フォローアップメッセージです。\nシナリオ配信が正常に動作しています✨',
  1
);

-- 確認用クエリ
SELECT 
  ss.name as scenario_name,
  s.name as step_name,
  s.step_order,
  sm.content,
  sm.message_order
FROM step_scenarios ss
JOIN steps s ON s.scenario_id = ss.id
JOIN step_messages sm ON sm.step_id = s.id
WHERE ss.id = '5bd01ede-b630-415c-9249-d6c6d0c8454b'
ORDER BY s.step_order, sm.message_order;