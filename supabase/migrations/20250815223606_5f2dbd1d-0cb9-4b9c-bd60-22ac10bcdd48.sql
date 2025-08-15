-- フォームシナリオ移行の配信問題修正
-- 解除するシナリオが無い状態でもステップが確実に配信されるように修正

CREATE OR REPLACE FUNCTION public.handle_form_scenario_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_scenario_id uuid;
  v_user_id     uuid;
  v_steps_registered integer := 0;
  v_headers jsonb;
  v_auth text;
BEGIN
  -- フォーム設定の取得
  SELECT post_submit_scenario_id, user_id
    INTO v_scenario_id, v_user_id
  FROM public.forms
  WHERE id = NEW.form_id;

  IF v_scenario_id IS NOT NULL AND NEW.friend_id IS NOT NULL THEN
    -- ログ記録
    INSERT INTO public.scenario_friend_logs (scenario_id, friend_id, line_user_id, invite_code)
    VALUES (v_scenario_id, NEW.friend_id, NEW.line_user_id, 'form_transition')
    ON CONFLICT DO NOTHING;

    -- 1. 先に遷移先シナリオの既存トラッキングを削除（影響を受けないように）
    DELETE FROM public.step_delivery_tracking 
    WHERE friend_id = NEW.friend_id 
      AND scenario_id = v_scenario_id;

    -- 2. その後で他の進行中シナリオを停止
    UPDATE public.step_delivery_tracking
       SET status = 'exited', updated_at = now()
     WHERE friend_id = NEW.friend_id
       AND status IN ('waiting','ready','delivered');

    -- 3. 新シナリオのトラッキングを作成（waitingステータスで正確な配信時間計算を使用）
    INSERT INTO public.step_delivery_tracking (
      scenario_id, step_id, friend_id, status,
      scheduled_delivery_at, created_at, updated_at
    )
    SELECT
      v_scenario_id,
      s.id,
      NEW.friend_id,
      'waiting',  -- 全てwaitingステータスに設定
      public.calculate_scheduled_delivery_time(
        p_friend_added_at      := now(),
        p_delivery_type        := s.delivery_type,
        p_delivery_seconds     := s.delivery_seconds,
        p_delivery_minutes     := COALESCE(s.delivery_minutes, 0),
        p_delivery_hours       := COALESCE(s.delivery_hours, 0),
        p_delivery_days        := COALESCE(s.delivery_days, 0),
        p_specific_time        := s.specific_time,
        p_previous_step_delivered_at := NULL,
        p_delivery_time_of_day := s.delivery_time_of_day
      ),
      now(),
      now()
    FROM public.steps s
    WHERE s.scenario_id = v_scenario_id
    ORDER BY s.step_order;

    GET DIAGNOSTICS v_steps_registered = ROW_COUNT;

    -- 最初のステップをreadyに更新（配信準備完了）
    UPDATE public.step_delivery_tracking
    SET status = 'ready', updated_at = now()
    WHERE scenario_id = v_scenario_id 
      AND friend_id = NEW.friend_id
      AND step_id = (
        SELECT id FROM public.steps 
        WHERE scenario_id = v_scenario_id 
        ORDER BY step_order 
        LIMIT 1
      );

    -- HTTP 呼び出し
    BEGIN
      v_auth := COALESCE(current_setting('supabase.service_role_key', true), NULL);
      v_headers := jsonb_build_object('Content-Type','application/json');

      IF v_auth IS NOT NULL THEN
        v_headers := v_headers || jsonb_build_object('Authorization', 'Bearer ' || v_auth);
      END IF;

      PERFORM net.http_post(
        url     := 'https://rtjxurmuaawyzjcdkqxt.supabase.co/functions/v1/scheduled-step-delivery',
        headers := v_headers,
        body    := jsonb_build_object(
          'friend_id', NEW.friend_id,
          'scenario_id', v_scenario_id,
          'trigger_source', 'form_scenario_transition'
        )
      );
    EXCEPTION WHEN OTHERS THEN
      BEGIN
        PERFORM public.log_security_event(
          p_user_id := NEW.user_id,
          p_action := 'scheduled-step-delivery:http_post_failed',
          p_details := jsonb_build_object(
            'error', SQLERRM, 
            'form_id', NEW.form_id, 
            'friend_id', NEW.friend_id
          ),
          p_success := false
        );
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END;
  END IF;

  RETURN NEW;
END;
$function$;