-- STEP 1: 現在のユーザーのシナリオとプロファイルの関係を確認・修復
-- profiles テーブルが削除されたため、step_scenarios との関係が切れている可能性

-- プロファイルの存在確認
SELECT 'Profile exists' as status, user_id, line_bot_id 
FROM profiles 
WHERE user_id = 'c986e437-a760-4885-ae25-dd8ae3038516';

-- このユーザーのシナリオ確認
SELECT 'Scenarios exist' as status, id, name, user_id 
FROM step_scenarios 
WHERE user_id = 'c986e437-a760-4885-ae25-dd8ae3038516';

-- 既存の招待コード確認
SELECT 'Invite codes exist' as status, invite_code, scenario_id, is_active
FROM scenario_invite_codes sic
JOIN step_scenarios ss ON ss.id = sic.scenario_id
WHERE ss.user_id = 'c986e437-a760-4885-ae25-dd8ae3038516';