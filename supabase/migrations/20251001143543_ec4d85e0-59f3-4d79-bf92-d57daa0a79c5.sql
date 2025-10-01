-- handle_form_scenario_transitionトリガーを修正して registration_source を設定
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
    -- ログ記録（registration_source を scenario_transition に設定）
    INSERT INTO public.scenario_friend_logs (
      scenario_id, 
      friend_id, 
      line_user_id, 
      invite_code,
      registration_source
    )
    VALUES (
      v_scenario_id, 
      NEW.friend_id, 
      NEW.line_user_id, 
      'form_transition',
      'scenario_transition'
    )
    ON CONFLICT DO NOTHING;

    -- 1. 先に遷移先シナリオの既存トラッキングを削除（影響を受けないように）
    DELETE FROM public.step_delivery_tracking 
    WHERE friend_id = NEW.friend_id 
      AND scenario_id = v_scenario_id;

    -- 2. 解除防止設定を考慮して既存シナリオを停止
    -- CRITICAL FIX: prevent_auto_exit = true のシナリオは絶対に解除しない
    UPDATE public.step_delivery_tracking
       SET status = 'exited', updated_at = now()
     WHERE friend_id = NEW.friend_id
       AND status IN ('waiting','ready','delivered')
       AND scenario_id IN (
         SELECT id FROM step_scenarios 
         WHERE prevent_auto_exit = false OR prevent_auto_exit IS NULL
       );

    -- 3. 新シナリオのトラッキングを作成（適切な配信時刻を設定）
    INSERT INTO public.step_delivery_tracking (
      scenario_id, step_id, friend_id, status, scheduled_delivery_at, created_at, updated_at
    )
    SELECT
      v_scenario_id,
      s.id,
      NEW.friend_id,
      'waiting',
      -- 最初のステップ(step_order=0)は即座に配信、その他はnull
      CASE WHEN s.step_order = 0 THEN now() ELSE NULL END,
      now(),
      now()
    FROM public.steps s
    WHERE s.scenario_id = v_scenario_id
    ORDER BY s.step_order;

    GET DIAGNOSTICS v_steps_registered = ROW_COUNT;

    -- scheduled-step-delivery関数をキック
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
          'line_user_id', (SELECT line_user_id FROM line_friends WHERE id = NEW.friend_id),
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