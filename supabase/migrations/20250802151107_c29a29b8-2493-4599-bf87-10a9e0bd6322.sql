CREATE OR REPLACE FUNCTION public.register_friend_to_scenario(
  p_line_user_id TEXT,
  p_invite_code  TEXT,
  p_display_name TEXT DEFAULT NULL,
  p_picture_url  TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
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
    SELECT id, step_order, delivery_type, delivery_seconds, delivery_minutes, delivery_hours, delivery_days, specific_time, delivery_time_of_day, delivery_relative_to_previous
    FROM steps 
    WHERE scenario_id = v_scenario_id 
    ORDER BY step_order
  LOOP
    -- 各ステップの配信予定時刻を計算
    DECLARE
      v_scheduled_at timestamptz;
      v_status TEXT;
      v_now timestamptz := now();
      v_effective_type TEXT;
      v_has_offset BOOLEAN;
    BEGIN
      v_effective_type := v_steps.delivery_type;
      IF v_effective_type = 'immediate' THEN v_effective_type := 'immediately'; END IF;
      IF v_effective_type = 'specific' THEN v_effective_type := 'specific_time'; END IF;
      
      v_has_offset := (COALESCE(v_steps.delivery_seconds, 0) + COALESCE(v_steps.delivery_minutes, 0) + COALESCE(v_steps.delivery_hours, 0) + COALESCE(v_steps.delivery_days, 0)) > 0;

      IF v_effective_type = 'relative' AND (v_steps.delivery_relative_to_previous OR v_steps.step_order > 0) THEN
        v_effective_type := 'relative_to_previous';
      END IF;

      -- 最初のステップの基準時刻は登録時(now)
      -- 2番目以降のステップは、この時点では正確な配信時刻を計算できない（前のステップの配信時刻が不明なため）ので、NULLにしておく
      -- 2番目以降は、前のステップ配信完了時に `markStepAsDelivered` によって正しい時刻が設定される
      IF v_steps.step_order = 0 THEN
        v_scheduled_at := public.calculate_scheduled_delivery_time(
          p_friend_added_at := v_now,
          p_delivery_type := v_effective_type,
          p_delivery_seconds := v_steps.delivery_seconds,
          p_delivery_minutes := v_steps.delivery_minutes,
          p_delivery_hours := v_steps.delivery_hours,
          p_delivery_days := v_steps.delivery_days,
          p_specific_time := v_steps.specific_time,
          p_previous_step_delivered_at := v_now, -- 最初のステップなので登録時を基準
          p_delivery_time_of_day := v_steps.delivery_time_of_day
        );
      ELSE
        v_scheduled_at := NULL;
      END IF;

      -- ステータスを決定
      IF v_steps.step_order = 0 THEN
        IF v_scheduled_at IS NOT NULL AND v_scheduled_at <= v_now THEN
          v_status := 'ready';
          v_scheduled_at := v_now; -- 過去の時刻になっていたら現在時刻に設定
        ELSE
          v_status := 'waiting';
        END IF;
      ELSE
        v_status := 'waiting';
      END IF;

      -- 各ステップの配信トラッキングを作成
      INSERT INTO step_delivery_tracking (
        scenario_id, 
        step_id, 
        friend_id, 
        status,
        scheduled_delivery_at,
        created_at,
        updated_at
      )
      VALUES (
        v_scenario_id,
        v_steps.id,
        v_friend_id,
        v_status,
        v_scheduled_at,
        v_now,
        v_now
      )
      ON CONFLICT (scenario_id, step_id, friend_id) DO NOTHING;
    END;
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