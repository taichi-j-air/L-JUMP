-- フォーム回答後のシナリオ遷移処理を改良
-- 解除するシナリオが無い場合や既にそのシナリオにいる場合でも確実にステップ配信
CREATE OR REPLACE FUNCTION public.handle_form_scenario_transition()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_scenario_id uuid;
  v_user_id uuid;
  v_steps_registered integer := 0;
BEGIN
  -- フォーム回答後シナリオが設定されているかチェック
  SELECT post_submit_scenario_id, user_id 
  INTO v_scenario_id, v_user_id
  FROM public.forms 
  WHERE id = NEW.form_id;

  -- シナリオ設定があり、友だちIDが存在する場合のみ処理
  IF v_scenario_id IS NOT NULL AND NEW.friend_id IS NOT NULL THEN
    -- 既存のシナリオトラッキングを全て exited にマーク（進行中のものを停止）
    UPDATE public.step_delivery_tracking 
    SET status = 'exited', updated_at = now()
    WHERE friend_id = NEW.friend_id 
      AND status IN ('waiting', 'ready', 'delivered');

    -- シナリオ友だちログに記録
    INSERT INTO public.scenario_friend_logs (scenario_id, friend_id, line_user_id, invite_code)
    VALUES (v_scenario_id, NEW.friend_id, NEW.line_user_id, 'form_transition')
    ON CONFLICT DO NOTHING;

    -- 新しいシナリオのステップ配信トラッキングを作成/更新
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
        WHEN s.step_order = 0 THEN 
          public.calculate_scheduled_delivery_time(
            now(), 
            s.delivery_type, 
            s.delivery_seconds, 
            s.delivery_minutes, 
            s.delivery_hours, 
            s.delivery_days, 
            s.specific_time,
            NULL,
            s.delivery_time_of_day
          )
        ELSE NULL
      END,
      now(),
      now()
    FROM public.steps s
    WHERE s.scenario_id = v_scenario_id
    ORDER BY s.step_order
    ON CONFLICT (scenario_id, step_id, friend_id) 
    DO UPDATE SET 
      status = EXCLUDED.status,
      scheduled_delivery_at = EXCLUDED.scheduled_delivery_at,
      updated_at = now();

    -- 作成されたステップ数を取得
    GET DIAGNOSTICS v_steps_registered = ROW_COUNT;

    -- scheduled-step-deliveryエッジ関数を呼び出して即座に配信処理を実行
    PERFORM net.http_post(
      url := 'https://rtjxurmuaawyzjcdkqxt.supabase.co/functions/v1/scheduled-step-delivery',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('supabase.service_role_key', true) || '"}'::jsonb,
      body := json_build_object(
        'friend_id', NEW.friend_id,
        'scenario_id', v_scenario_id,
        'trigger_source', 'form_scenario_transition'
      )::jsonb
    );

  END IF;

  RETURN NEW;
END;
$function$;