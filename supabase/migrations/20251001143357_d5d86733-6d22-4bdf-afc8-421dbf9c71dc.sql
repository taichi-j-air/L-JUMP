-- scenario_invite_codesテーブルに再登録制御カラムを追加
ALTER TABLE public.scenario_invite_codes
ADD COLUMN IF NOT EXISTS allow_re_registration boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS re_registration_message text,
ADD COLUMN IF NOT EXISTS re_registration_action text DEFAULT 'block';

COMMENT ON COLUMN public.scenario_invite_codes.allow_re_registration IS '再登録を許可するか（デフォルト: false）';
COMMENT ON COLUMN public.scenario_invite_codes.re_registration_message IS '既に登録済みの場合に表示するカスタムメッセージ';
COMMENT ON COLUMN public.scenario_invite_codes.re_registration_action IS '再登録時の動作（block/allow/redirect）';

-- scenario_friend_logsテーブルに登録元を識別するカラムを追加
ALTER TABLE public.scenario_friend_logs
ADD COLUMN IF NOT EXISTS registration_source text DEFAULT 'invite_link',
ADD COLUMN IF NOT EXISTS exit_reason text,
ADD COLUMN IF NOT EXISTS exited_at timestamp with time zone;

COMMENT ON COLUMN public.scenario_friend_logs.registration_source IS '登録元（invite_link/scenario_transition/manual_admin）';
COMMENT ON COLUMN public.scenario_friend_logs.exit_reason IS 'シナリオ終了理由（completed/manual_transition/manual_exit）';
COMMENT ON COLUMN public.scenario_friend_logs.exited_at IS 'シナリオ終了日時';

-- register_friend_to_scenario関数を再登録チェック対応版に更新
CREATE OR REPLACE FUNCTION public.register_friend_to_scenario(
  p_line_user_id text,
  p_invite_code text,
  p_display_name text DEFAULT NULL,
  p_picture_url text DEFAULT NULL,
  p_registration_source text DEFAULT 'invite_link'
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
  v_existing_log record;
  v_active_tracking_count integer;
BEGIN
  -- 招待コード情報を取得（再登録設定含む）
  SELECT 
    sic.*,
    ss.user_id as scenario_user_id
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

  -- 既存の登録履歴をチェック（招待リンク経由の場合のみ）
  IF p_registration_source = 'invite_link' THEN
    SELECT * INTO v_existing_log
    FROM scenario_friend_logs
    WHERE scenario_id = v_scenario_id 
      AND friend_id = v_friend_id
      AND registration_source = 'invite_link'
    ORDER BY created_at DESC
    LIMIT 1;

    -- アクティブな配信トラッキングをチェック
    SELECT COUNT(*) INTO v_active_tracking_count
    FROM step_delivery_tracking
    WHERE scenario_id = v_scenario_id
      AND friend_id = v_friend_id
      AND status IN ('waiting', 'ready', 'delivered');

    -- 既に登録済みで、再登録が許可されていない場合
    IF v_existing_log.id IS NOT NULL AND v_invite_data.allow_re_registration = false THEN
      RETURN json_build_object(
        'success', false,
        'error', 'already_registered',
        'message', COALESCE(v_invite_data.re_registration_message, 'このシナリオには既に登録済みです'),
        'action', COALESCE(v_invite_data.re_registration_action, 'block'),
        'friend_id', v_friend_id,
        'scenario_id', v_scenario_id,
        'has_active_tracking', v_active_tracking_count > 0
      );
    END IF;
  END IF;

  -- シナリオ友達ログに記録（登録元を含む）
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
  )
  ON CONFLICT DO NOTHING;

  -- 招待リンク経由の場合のみ使用回数を更新
  IF p_registration_source = 'invite_link' THEN
    UPDATE scenario_invite_codes 
    SET usage_count = usage_count + 1, updated_at = now()
    WHERE id = v_invite_data.id;
  END IF;

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
    ON CONFLICT (scenario_id, step_id, friend_id) DO NOTHING;
  END LOOP;

  RETURN json_build_object(
    'success', true, 
    'friend_id', v_friend_id,
    'scenario_id', v_scenario_id,
    'registration_source', p_registration_source,
    'steps_registered', (SELECT count(*) FROM steps WHERE scenario_id = v_scenario_id)
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$;