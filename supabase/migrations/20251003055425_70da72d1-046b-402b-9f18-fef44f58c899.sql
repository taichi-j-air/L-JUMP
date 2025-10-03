-- Complete 0-step scenario transition implementation
-- This migration ensures all components are properly updated

-- 1. Add transition_to_scenario_id column to step_scenarios if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'step_scenarios' AND column_name = 'transition_to_scenario_id'
  ) THEN
    ALTER TABLE public.step_scenarios 
    ADD COLUMN transition_to_scenario_id uuid REFERENCES public.step_scenarios(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 2. Create scenario_transitions table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.scenario_transitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_scenario_id uuid NOT NULL REFERENCES public.step_scenarios(id) ON DELETE CASCADE,
  to_scenario_id uuid NOT NULL REFERENCES public.step_scenarios(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(from_scenario_id, to_scenario_id)
);

-- Enable RLS on scenario_transitions
ALTER TABLE public.scenario_transitions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for scenario_transitions if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'scenario_transitions' AND policyname = 'users_can_view_own_transitions'
  ) THEN
    CREATE POLICY users_can_view_own_transitions ON public.scenario_transitions
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.step_scenarios 
          WHERE id = from_scenario_id AND user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'scenario_transitions' AND policyname = 'users_can_manage_own_transitions'
  ) THEN
    CREATE POLICY users_can_manage_own_transitions ON public.scenario_transitions
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM public.step_scenarios 
          WHERE id = from_scenario_id AND user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- 3. Replace register_friend_to_scenario function with complete 0-step transition logic
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
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_invite_data record;
  v_friend_id uuid;
  v_scenario_id uuid;
  v_user_id uuid;
  v_steps record;
  v_existing_log record;
  v_allow_re_registration boolean;
  v_scenario_prevent_re_registration boolean;
BEGIN
  RAISE LOG 'register_friend_to_scenario called: line_user_id=%, invite_code=%, registration_source=%', 
    p_line_user_id, p_invite_code, p_registration_source;

  -- 招待コードを検索（シナリオの再登録設定も取得）
  SELECT 
    sic.*,
    ss.user_id as scenario_user_id,
    ss.prevent_re_registration as scenario_prevent_re_registration
  INTO v_invite_data
  FROM scenario_invite_codes sic
  JOIN step_scenarios ss ON ss.id = sic.scenario_id
  WHERE sic.invite_code = p_invite_code
    AND sic.is_active = true;

  IF NOT FOUND THEN
    RAISE LOG 'Invite code not found or inactive: %', p_invite_code;
    RETURN json_build_object('success', false, 'error', 'Invalid invite code');
  END IF;

  RAISE LOG 'Invite code found: scenario_id=%, allow_re_registration=%, scenario_prevent_re_registration=%', 
    v_invite_data.scenario_id, v_invite_data.allow_re_registration, v_invite_data.scenario_prevent_re_registration;

  -- 使用制限チェック
  IF v_invite_data.max_usage IS NOT NULL 
     AND v_invite_data.usage_count >= v_invite_data.max_usage THEN
    RAISE LOG 'Invite code usage limit reached: usage_count=%, max_usage=%', 
      v_invite_data.usage_count, v_invite_data.max_usage;
    RETURN json_build_object('success', false, 'error', 'Invite code usage limit reached');
  END IF;

  v_scenario_id := v_invite_data.scenario_id;
  v_user_id := v_invite_data.scenario_user_id;
  v_scenario_prevent_re_registration := v_invite_data.scenario_prevent_re_registration;

  -- 階層的な再登録制御の決定
  IF v_invite_data.allow_re_registration IS NOT NULL THEN
    v_allow_re_registration := v_invite_data.allow_re_registration;
    RAISE LOG 'Using invite code re-registration setting: %', v_allow_re_registration;
  ELSE
    v_allow_re_registration := NOT v_scenario_prevent_re_registration;
    RAISE LOG 'Using scenario re-registration setting: prevent=%, allow=%', 
      v_scenario_prevent_re_registration, v_allow_re_registration;
  END IF;

  -- 既存の友達をチェック
  SELECT id INTO v_friend_id
  FROM line_friends
  WHERE line_user_id = p_line_user_id AND user_id = v_user_id;

  RAISE LOG 'Existing friend found: friend_id=%', v_friend_id;

  -- 友達が存在しない場合は新規作成
  IF v_friend_id IS NULL THEN
    INSERT INTO line_friends (user_id, line_user_id, display_name, picture_url)
    VALUES (v_user_id, p_line_user_id, p_display_name, p_picture_url)
    RETURNING id INTO v_friend_id;
    RAISE LOG 'New friend created: friend_id=%', v_friend_id;
  END IF;

  -- 既存登録をシナリオ単位で確認（招待コード一致を優先）
  v_existing_log := NULL;

  IF p_invite_code IS NOT NULL THEN
    SELECT *
    INTO v_existing_log
    FROM scenario_friend_logs
    WHERE scenario_id = v_scenario_id
      AND friend_id = v_friend_id
      AND invite_code = p_invite_code
      AND (p_registration_source IS NULL OR registration_source = p_registration_source)
    ORDER BY added_at DESC
    LIMIT 1;
  END IF;

  IF v_existing_log IS NULL THEN
    SELECT *
    INTO v_existing_log
    FROM scenario_friend_logs
    WHERE scenario_id = v_scenario_id
      AND friend_id = v_friend_id
    ORDER BY added_at DESC
    LIMIT 1;
  END IF;

  IF v_existing_log IS NOT NULL THEN
    RAISE LOG 'Existing registration detected: log_id=%, source=%, allow_re_registration=%',
      v_existing_log.id, COALESCE(v_existing_log.registration_source, 'unknown'), v_allow_re_registration;

    IF NOT v_allow_re_registration THEN
      RAISE LOG 'Re-registration not allowed, returning error';
      RETURN json_build_object(
        'success', false, 
        'error', COALESCE(v_invite_data.re_registration_message, 'このシナリオには既に登録済みです。'),
        'already_registered', true
      );
    ELSE
      RAISE LOG 'Re-registration allowed, deleting existing tracking records';
      DELETE FROM step_delivery_tracking
      WHERE scenario_id = v_scenario_id AND friend_id = v_friend_id;

      DELETE FROM step_delivery_tracking
      WHERE friend_id = v_friend_id
        AND scenario_id IN (
          SELECT st.to_scenario_id
          FROM scenario_transitions st
          WHERE st.from_scenario_id = v_scenario_id
        );

      DELETE FROM scenario_friend_logs
      WHERE scenario_id = v_scenario_id
        AND friend_id = v_friend_id;

      DELETE FROM scenario_friend_logs
      WHERE friend_id = v_friend_id
        AND scenario_id IN (
          SELECT st.to_scenario_id
          FROM scenario_transitions st
          WHERE st.from_scenario_id = v_scenario_id
        )
        AND invite_code = 'system_transition';
    END IF;
  END IF;

  -- シナリオ友達ログに記録
  INSERT INTO scenario_friend_logs (scenario_id, friend_id, invite_code, line_user_id, registration_source)
  VALUES (v_scenario_id, v_friend_id, p_invite_code, p_line_user_id, p_registration_source)
  ON CONFLICT DO NOTHING;

  -- 招待コードの使用回数を更新（invite_linkの新規登録時のみ）
  IF p_registration_source = 'invite_link' THEN
    UPDATE scenario_invite_codes 
    SET usage_count = usage_count + 1, updated_at = now()
    WHERE id = v_invite_data.id;
    RAISE LOG 'Invite code usage_count incremented';
  END IF;

  -- シナリオのステップ数をチェックし、0ステップなら遷移、そうでなければトラッキングを開始
  DECLARE
    v_step_count integer;
    v_to_scenario_id uuid;
  BEGIN
    SELECT count(*) INTO v_step_count FROM steps WHERE scenario_id = v_scenario_id;

    IF v_step_count > 0 THEN
      -- ステップがある場合：通常のトラッキング開始処理
      RAISE LOG 'Scenario % has % steps, starting tracking.', v_scenario_id, v_step_count;
      FOR v_steps IN 
        SELECT id, step_order FROM steps 
        WHERE scenario_id = v_scenario_id 
        ORDER BY step_order
      LOOP
        INSERT INTO step_delivery_tracking (scenario_id, step_id, friend_id, status)
        VALUES (v_scenario_id, v_steps.id, v_friend_id, CASE WHEN v_steps.step_order = 0 THEN 'ready' ELSE 'waiting' END)
        ON CONFLICT DO NOTHING;
      END LOOP;
    ELSE
      -- 0-step scenario: attempt transition to next scenario
      RAISE LOG 'Scenario % has 0 steps, checking for transition.', v_scenario_id;
      
      SELECT to_scenario_id INTO v_to_scenario_id
      FROM scenario_transitions
      WHERE from_scenario_id = v_scenario_id
      ORDER BY created_at
      LIMIT 1;

      IF FOUND AND v_to_scenario_id IS NOT NULL THEN
        RAISE LOG 'Transition found for 0-step scenario: from % to %', v_scenario_id, v_to_scenario_id;

        DELETE FROM step_delivery_tracking
        WHERE friend_id = v_friend_id
          AND scenario_id = v_to_scenario_id;

        DELETE FROM scenario_friend_logs
        WHERE friend_id = v_friend_id
          AND scenario_id = v_to_scenario_id
          AND invite_code = 'system_transition';

        FOR v_steps IN
          SELECT id, step_order
          FROM steps
          WHERE scenario_id = v_to_scenario_id
          ORDER BY step_order
        LOOP
          INSERT INTO step_delivery_tracking (scenario_id, step_id, friend_id, status)
          VALUES (
            v_to_scenario_id,
            v_steps.id,
            v_friend_id,
            CASE WHEN v_steps.step_order = 0 THEN 'ready' ELSE 'waiting' END
          )
          ON CONFLICT DO NOTHING;
        END LOOP;

        INSERT INTO scenario_friend_logs (scenario_id, friend_id, invite_code, line_user_id, registration_source)
        VALUES (v_to_scenario_id, v_friend_id, 'system_transition', p_line_user_id, 'system_transition')
        ON CONFLICT DO NOTHING;

        -- CRITICAL: Update v_scenario_id to the transition target
        v_scenario_id := v_to_scenario_id;
      ELSE
        RAISE LOG '0-step scenario % has no transition configured. No action taken.', v_scenario_id;
      END IF;
    END IF;
  END;

  RAISE LOG 'Scenario registration completed successfully';

  RETURN json_build_object(
    'success', true, 
    'friend_id', v_friend_id,
    'scenario_id', v_scenario_id,
    'steps_registered', (SELECT count(*) FROM steps WHERE scenario_id = v_scenario_id),
    're_registration_allowed', v_allow_re_registration
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error in register_friend_to_scenario: %', SQLERRM;
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$;