-- 既存の友だちに対して新しいSTEPの配信追跡を作成
INSERT INTO step_delivery_tracking (
  scenario_id,
  step_id,
  friend_id,
  status,
  scheduled_delivery_at,
  next_check_at
)
SELECT 
  '5bd01ede-b630-415c-9249-d6c6d0c8454b',
  s.id,
  lf.id,
  CASE WHEN s.step_order = 1 THEN 'ready' ELSE 'waiting' END,
  CASE WHEN s.step_order = 1 THEN now() ELSE now() + INTERVAL '1 minute' END,
  CASE WHEN s.step_order = 1 THEN now() ELSE now() + INTERVAL '1 minute' END
FROM steps s
CROSS JOIN line_friends lf
WHERE s.scenario_id = '5bd01ede-b630-415c-9249-d6c6d0c8454b'
  AND lf.line_user_id = 'U71b2a72440b4f65d6590ba0ce185f6fc'
  AND NOT EXISTS (
    SELECT 1 FROM step_delivery_tracking sdt
    WHERE sdt.step_id = s.id AND sdt.friend_id = lf.id
  );