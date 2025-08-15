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
    -- 進行中のトラッキングを停止
    UPDATE public.step_delivery_tracking
       SET status = 'exited', updated_at = now()
     WHERE friend_id = NEW.friend_id
       AND status IN ('waiting','ready','delivered');

    -- ログ
    INSERT INTO public.scenario_friend_logs (scenario_id, friend_id, line_user_id, invite_code)
    VALUES (v_scenario_id, NEW.friend_id, NEW.line_user_id, 'form_transition')
    ON CONFLICT DO NOTHING;

    -- 遷移先シナリオの既存トラッキングを削除（完全に新規作成するため）
    DELETE FROM public.step_delivery_tracking 
    WHERE friend_id = NEW.friend_id 
      AND scenario_id = v_scenario_id;

    -- 新シナリオのトラッキングを作成
    INSERT INTO public.step_delivery_tracking (
      scenario_id, step_id, friend_id, status,
      scheduled_delivery_at, created_at, updated_at
    )
    SELECT
      v_scenario_id,
      s.id,
      NEW.friend_id,
      CASE WHEN s.step_order = 0 THEN 'ready' ELSE 'waiting' END,
      CASE
        WHEN s.step_order = 0 THEN public.calculate_scheduled_delivery_time(
          p_friend_added_at      := now(),
          p_delivery_type        := s.delivery_type,
          p_delivery_seconds     := s.delivery_seconds,
          p_delivery_minutes     := COALESCE(s.delivery_minutes, 0),
          p_delivery_hours       := COALESCE(s.delivery_hours, 0),
          p_delivery_days        := COALESCE(s.delivery_days, 0),
          p_specific_time        := s.specific_time,
          p_previous_step_delivered_at := NULL,
          p_delivery_time_of_day := s.delivery_time_of_day
        )
        ELSE NULL
      END,
      now(),
      now()
    FROM public.steps s
    WHERE s.scenario_id = v_scenario_id
    ORDER BY s.step_order;

    GET DIAGNOSTICS v_steps_registered = ROW_COUNT;

    -- HTTP 呼び出しは失敗してもロールバックさせない
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
      -- セキュリティログ関数を正しい型で呼び出し
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
        -- ログ失敗も無視
        NULL;
      END;
    END;
  END IF;

  RETURN NEW;
END;
$function$