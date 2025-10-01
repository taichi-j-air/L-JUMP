-- Fix register_friend_to_scenario to properly handle re-registration prevention
CREATE OR REPLACE FUNCTION public.register_friend_to_scenario(
  p_line_user_id text,
  p_invite_code text,
  p_display_name text DEFAULT NULL::text,
  p_picture_url text DEFAULT NULL::text,
  p_registration_source text DEFAULT 'invite_link'::text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_invite_data record;
  v_friend_id uuid;
  v_scenario_id uuid;
  v_user_id uuid;
  v_steps record;
  v_existing_registration record;
  v_is_re_registration boolean := false;
BEGIN
  RAISE LOG 'register_friend_to_scenario called: line_user_id=%, invite_code=%, registration_source=%', 
    p_line_user_id, p_invite_code, p_registration_source;

  -- 招待コードを検索
  SELECT sic.*, ss.user_id as scenario_user_id
  INTO v_invite_data
  FROM scenario_invite_codes sic
  JOIN step_scenarios ss ON ss.id = sic.scenario_id
  WHERE sic.invite_code = p_invite_code
    AND sic.is_active = true;

  IF NOT FOUND THEN
    RAISE LOG 'Invalid invite code: %', p_invite_code;
    RETURN json_build_object('success', false, 'error', 'Invalid invite code');
  END IF;

  RAISE LOG 'Invite code found: scenario_id=%, allow_re_registration=%, re_registration_action=%',
    v_invite_data.scenario_id, v_invite_data.allow_re_registration, v_invite_data.re_registration_action;

  -- 使用制限チェック
  IF v_invite_data.max_usage IS NOT NULL 
     AND v_invite_data.usage_count >= v_invite_data.max_usage THEN
    RAISE LOG 'Invite code usage limit reached';
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
    RAISE LOG 'New friend created: friend_id=%', v_friend_id;
  ELSE
    RAISE LOG 'Existing friend found: friend_id=%', v_friend_id;
  END IF;

  -- 招待リンク経由の場合のみ、既存登録をチェック
  IF p_registration_source = 'invite_link' THEN
    SELECT *
    INTO v_existing_registration
    FROM scenario_friend_logs
    WHERE scenario_id = v_scenario_id
      AND friend_id = v_friend_id
      AND invite_code = p_invite_code
      AND registration_source = 'invite_link'
    ORDER BY added_at DESC
    LIMIT 1;

    IF FOUND THEN
      v_is_re_registration := true;
      RAISE LOG 'Existing registration found for invite_link: log_id=%, allow_re_registration=%',
        v_existing_registration.id, v_invite_data.allow_re_registration;

      -- 再登録が許可されていない場合
      IF v_invite_data.allow_re_registration IS NOT TRUE THEN
        RAISE LOG 'Re-registration not allowed, returning error';
        RETURN json_build_object(
          'success', false,
          'error', 'already_registered',
          'message', COALESCE(v_invite_data.re_registration_message, 'このシナリオには既に登録済みです。'),
          're_registered', false
        );
      END IF;

      -- 再登録が許可されている場合、既存のトラッキングレコードを削除
      RAISE LOG 'Re-registration allowed, deleting existing tracking records';
      DELETE FROM step_delivery_tracking
      WHERE scenario_id = v_scenario_id AND friend_id = v_friend_id;
    END IF;
  END IF;

  -- シナリオ友達ログに記録（招待リンク経由の場合のみ usage_count を増やす）
  INSERT INTO scenario_friend_logs (
    scenario_id, 
    friend_id, 
    invite_code, 
    line_user_id,
    registration_source
  )
  VALUES (
    v_scenario_id, 
    v_friend_id, 
    p_invite_code, 
    p_line_user_id,
    p_registration_source
  );
  RAISE LOG 'Scenario friend log created';

  -- 招待リンク経由の場合のみ usage_count を更新
  IF p_registration_source = 'invite_link' AND NOT v_is_re_registration THEN
    UPDATE scenario_invite_codes 
    SET usage_count = usage_count + 1, updated_at = now()
    WHERE id = v_invite_data.id;
    RAISE LOG 'Usage count incremented';
  END IF;

  -- シナリオのステップを取得して配信トラッキングを開始
  FOR v_steps IN 
    SELECT id, step_order, delivery_type, delivery_seconds, delivery_minutes, delivery_hours, delivery_days
    FROM steps 
    WHERE scenario_id = v_scenario_id 
    ORDER BY step_order
  LOOP
    INSERT INTO step_delivery_tracking (
      scenario_id, 
      step_id, 
      friend_id, 
      status,
      registration_source
    )
    VALUES (
      v_scenario_id,
      v_steps.id,
      v_friend_id,
      CASE WHEN v_steps.step_order = 0 THEN 'ready' ELSE 'waiting' END,
      p_registration_source
    )
    ON CONFLICT (scenario_id, step_id, friend_id) DO NOTHING;
  END LOOP;
  RAISE LOG 'Step delivery tracking created';

  RETURN json_build_object(
    'success', true, 
    'friend_id', v_friend_id,
    'scenario_id', v_scenario_id,
    'steps_registered', (SELECT count(*) FROM steps WHERE scenario_id = v_scenario_id),
    're_registered', v_is_re_registration
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error in register_friend_to_scenario: %', SQLERRM;
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$;