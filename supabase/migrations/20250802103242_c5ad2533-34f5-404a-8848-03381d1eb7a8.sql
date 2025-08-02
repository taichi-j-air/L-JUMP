-- lin.ee直リンク経由でのシナリオ開始用トリガー配信機能
CREATE OR REPLACE FUNCTION public.trigger_scenario_delivery_for_friend(
  p_line_user_id text,
  p_scenario_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_friend_record record;
  v_ready_steps_count integer;
  v_delivered_count integer;
BEGIN
  -- 友だち情報を取得
  SELECT f.*, p.user_id 
  INTO v_friend_record
  FROM line_friends f
  JOIN profiles p ON f.user_id = p.user_id
  WHERE f.line_user_id = p_line_user_id
    AND EXISTS (
      SELECT 1 FROM scenario_friend_logs sfl 
      WHERE sfl.line_user_id = p_line_user_id 
        AND sfl.scenario_id = p_scenario_id
    );

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Friend not found or not registered to scenario'
    );
  END IF;

  -- ready状態のステップ数を確認
  SELECT COUNT(*) INTO v_ready_steps_count
  FROM step_delivery_tracking
  WHERE friend_id = v_friend_record.id
    AND scenario_id = p_scenario_id
    AND status = 'ready'
    AND delivered_at IS NULL;

  -- ready状態のステップの配信を開始
  UPDATE step_delivery_tracking
  SET 
    status = 'delivered',
    delivered_at = now(),
    updated_at = now()
  WHERE friend_id = v_friend_record.id
    AND scenario_id = p_scenario_id  
    AND status = 'ready'
    AND delivered_at IS NULL;

  GET DIAGNOSTICS v_delivered_count = ROW_COUNT;

  RETURN json_build_object(
    'success', true,
    'friend_id', v_friend_record.id,
    'line_user_id', p_line_user_id,
    'scenario_id', p_scenario_id,
    'ready_steps_found', v_ready_steps_count,
    'steps_triggered', v_delivered_count
  );
END;
$$;