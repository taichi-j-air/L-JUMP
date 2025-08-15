-- フォーム回答後のシナリオ遷移機能追加
CREATE OR REPLACE FUNCTION public.handle_form_scenario_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_scenario_id uuid;
  v_friend_id uuid;
  v_user_id uuid;
BEGIN
  -- フォーム回答後シナリオが設定されているかチェック
  SELECT post_submit_scenario_id, user_id 
  INTO v_scenario_id, v_user_id
  FROM public.forms 
  WHERE id = NEW.form_id;

  -- シナリオ設定があり、友だちIDが存在する場合のみ処理
  IF v_scenario_id IS NOT NULL AND NEW.friend_id IS NOT NULL THEN
    -- 既存のシナリオトラッキングを全て exited にマーク
    UPDATE public.step_delivery_tracking 
    SET status = 'exited', updated_at = now()
    WHERE friend_id = NEW.friend_id 
      AND status IN ('waiting', 'ready');

    -- シナリオ友だちログに記録
    INSERT INTO public.scenario_friend_logs (scenario_id, friend_id, line_user_id, invite_code)
    VALUES (v_scenario_id, NEW.friend_id, NEW.line_user_id, 'form_transition')
    ON CONFLICT DO NOTHING;

    -- 新しいシナリオのステップ配信トラッキングを作成
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
    ON CONFLICT (scenario_id, step_id, friend_id) DO NOTHING;

  END IF;

  RETURN NEW;
END;
$function$;

-- フォーム送信時のトリガー作成
DROP TRIGGER IF EXISTS form_scenario_transition_trigger ON public.form_submissions;
CREATE TRIGGER form_scenario_transition_trigger
  AFTER INSERT ON public.form_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_form_scenario_transition();