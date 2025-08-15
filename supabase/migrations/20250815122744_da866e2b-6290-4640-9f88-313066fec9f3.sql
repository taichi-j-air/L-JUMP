-- 重複回答チェック機能の修正（LIFF認証を考慮）
CREATE OR REPLACE FUNCTION public.check_duplicate_submission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  form_prevents_duplicates boolean;
  existing_submission_id uuid;
BEGIN
  -- Only check for duplicates if friend_id is not null
  IF NEW.friend_id IS NOT NULL THEN
    -- Get the form's duplicate prevention setting
    SELECT prevent_duplicate_per_friend INTO form_prevents_duplicates
    FROM public.forms 
    WHERE id = NEW.form_id;
    
    -- If form prevents duplicates, check for existing submission
    IF form_prevents_duplicates = true THEN
      -- Check for existing submission by friend_id
      SELECT id INTO existing_submission_id
      FROM public.form_submissions 
      WHERE form_id = NEW.form_id 
        AND friend_id = NEW.friend_id
        AND id != NEW.id
      LIMIT 1;
      
      IF existing_submission_id IS NOT NULL THEN
        RAISE EXCEPTION 'この友だちは既にこのフォームに回答済みです。'
          USING ERRCODE = '23505';
      END IF;
    END IF;
  ELSIF NEW.line_user_id IS NOT NULL THEN
    -- LIFF認証の場合、line_user_idで重複チェック
    SELECT prevent_duplicate_per_friend INTO form_prevents_duplicates
    FROM public.forms 
    WHERE id = NEW.form_id;
    
    IF form_prevents_duplicates = true THEN
      SELECT id INTO existing_submission_id
      FROM public.form_submissions 
      WHERE form_id = NEW.form_id 
        AND line_user_id = NEW.line_user_id
        AND id != NEW.id
      LIMIT 1;
      
      IF existing_submission_id IS NOT NULL THEN
        RAISE EXCEPTION 'この友だちは既にこのフォームに回答済みです。'
          USING ERRCODE = '23505';
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- フォーム回答後のシナリオ遷移機能修正（正常に既存シナリオを解除して新シナリオに移行）
CREATE OR REPLACE FUNCTION public.handle_form_scenario_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_scenario_id uuid;
  v_user_id uuid;
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
    ON CONFLICT (scenario_id, step_id, friend_id) 
    DO UPDATE SET 
      status = EXCLUDED.status,
      scheduled_delivery_at = EXCLUDED.scheduled_delivery_at,
      updated_at = now();

  END IF;

  RETURN NEW;
END;
$function$;