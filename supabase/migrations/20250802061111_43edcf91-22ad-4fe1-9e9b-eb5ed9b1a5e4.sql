-- 不整合なデータを削除してから外部キー制約を追加
DELETE FROM public.scenario_invite_codes 
WHERE scenario_id NOT IN (SELECT id FROM public.step_scenarios);

-- scenario_invite_codes テーブルに外部キー制約を追加
ALTER TABLE public.scenario_invite_codes 
ADD CONSTRAINT scenario_invite_codes_scenario_id_fkey 
FOREIGN KEY (scenario_id) REFERENCES public.step_scenarios(id) ON DELETE CASCADE;

-- LINE友達追加時にシナリオに登録する関数を作成
CREATE OR REPLACE FUNCTION public.register_friend_to_scenario(
  p_line_user_id text,
  p_invite_code text,
  p_display_name text DEFAULT NULL,
  p_picture_url text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invite_data record;
  v_friend_id uuid;
  v_scenario_id uuid;
  v_user_id uuid;
  v_steps record;
BEGIN
  -- 招待コードを検索
  SELECT sic.*, ss.user_id as scenario_user_id
  INTO v_invite_data
  FROM scenario_invite_codes sic
  JOIN step_scenarios ss ON ss.id = sic.scenario_id
  WHERE sic.invite_code = p_invite_code
    AND sic.is_active = true;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Invalid invite code');
  END IF;

  -- 使用制限チェック
  IF v_invite_data.max_usage IS NOT NULL 
     AND v_invite_data.usage_count >= v_invite_data.max_usage THEN
    RETURN json_build_object('success', false, 'error', 'Invite code usage limit reached');
  END IF;

  v_scenario_id := v_invite_data.scenario_id;
  v_user_id := v_invite_data.scenario_user_id;

  -- 既存の友達をチェック
  SELECT id INTO v_friend_id
  FROM line_friends
  WHERE line_user_id = p_line_user_id AND user_id = v_user_id;

  -- 友達が存在しない場合は新規作成
  IF v_friend_id IS NULL THEN
    INSERT INTO line_friends (user_id, line_user_id, display_name, picture_url)
    VALUES (v_user_id, p_line_user_id, p_display_name, p_picture_url)
    RETURNING id INTO v_friend_id;
  END IF;

  -- シナリオ友達ログに記録
  INSERT INTO scenario_friend_logs (scenario_id, friend_id, invite_code, line_user_id)
  VALUES (v_scenario_id, v_friend_id, p_invite_code, p_line_user_id)
  ON CONFLICT DO NOTHING;

  -- 招待コードの使用回数を更新
  UPDATE scenario_invite_codes 
  SET usage_count = usage_count + 1, updated_at = now()
  WHERE id = v_invite_data.id;

  -- シナリオのステップを取得して配信トラッキングを開始
  FOR v_steps IN 
    SELECT id, step_order, delivery_type, delivery_seconds, delivery_minutes, delivery_hours, delivery_days
    FROM steps 
    WHERE scenario_id = v_scenario_id 
    ORDER BY step_order
  LOOP
    -- 各ステップの配信トラッキングを作成
    INSERT INTO step_delivery_tracking (
      scenario_id, 
      step_id, 
      friend_id, 
      status
    )
    VALUES (
      v_scenario_id,
      v_steps.id,
      v_friend_id,
      CASE WHEN v_steps.step_order = 1 THEN 'ready' ELSE 'waiting' END
    )
    ON CONFLICT DO NOTHING;
  END LOOP;

  RETURN json_build_object(
    'success', true, 
    'friend_id', v_friend_id,
    'scenario_id', v_scenario_id,
    'steps_registered', (SELECT count(*) FROM steps WHERE scenario_id = v_scenario_id)
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;