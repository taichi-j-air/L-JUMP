-- Fix remaining security warnings

-- Fix Function Search Path warnings for remaining functions
-- Update all functions that don't have proper search_path set

-- Fix update_orders_updated_at function
CREATE OR REPLACE FUNCTION public.update_orders_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Fix update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Fix handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
BEGIN
  INSERT INTO public.profiles (
    user_id,
    first_name,
    last_name,
    display_name,
    avatar_url,
    provider,
    google_id
  )
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'first_name', new.raw_user_meta_data->>'given_name'),
    COALESCE(new.raw_user_meta_data->>'last_name', new.raw_user_meta_data->>'family_name'),
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'picture',
    COALESCE(new.raw_user_meta_data->>'provider', 'google'),
    new.raw_user_meta_data->>'sub'
  );
  RETURN new;
EXCEPTION
  WHEN others THEN
    -- Log the error but don't block user creation
    RAISE LOG 'Profile creation error for user %: %', new.id, SQLERRM;
    RETURN new;
END;
$$;

-- Add security definer and search path to other functions that might be missing it
CREATE OR REPLACE FUNCTION public.ensure_single_active_line_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
BEGIN
  IF NEW.is_active THEN
    UPDATE public.line_accounts
    SET is_active = false, updated_at = now()
    WHERE user_id = NEW.user_id AND id <> NEW.id AND is_active = true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_submission_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    SELECT user_id INTO NEW.user_id FROM public.forms WHERE id = NEW.form_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_next_check_time()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
BEGIN
  IF NEW.status = 'waiting' THEN
    NEW.next_check_at := GREATEST(COALESCE(NEW.scheduled_delivery_at - interval '1 minute', now()), now());
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.reset_monthly_quota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
BEGIN
  -- 月が変わった場合にカウンターリセット
  IF NEW.current_month != EXTRACT(MONTH FROM now()) 
     OR NEW.current_year != EXTRACT(YEAR FROM now()) THEN
    NEW.monthly_message_used = 0;
    NEW.current_month = EXTRACT(MONTH FROM now());
    NEW.current_year = EXTRACT(YEAR FROM now());
  END IF;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'quota reset failed: %', SQLERRM;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_short_uid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
BEGIN
    IF NEW.short_uid IS NULL THEN
        NEW.short_uid := public.generate_short_uid();
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_scheduled_delivery_time()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  s RECORD;
  tod_h int;
  tod_m int;
BEGIN
  -- Only compute when not already provided
  IF NEW.scheduled_delivery_at IS NULL THEN
    SELECT 
      step_order,
      delivery_type,
      delivery_days,
      delivery_hours,
      delivery_minutes,
      delivery_seconds,
      specific_time,
      delivery_time_of_day
    INTO s
    FROM public.steps 
    WHERE id = NEW.step_id;

    IF FOUND THEN
      -- Only auto-schedule for the FIRST step in the scenario (step_order = 0)
      IF COALESCE(s.step_order, 0) = 0 THEN
        IF s.delivery_type = 'immediate' THEN
          NEW.scheduled_delivery_at := now();
        ELSIF s.delivery_type = 'relative' THEN
          NEW.scheduled_delivery_at := now()
            + make_interval(
                days  => COALESCE(s.delivery_days, 0),
                hours => COALESCE(s.delivery_hours, 0),
                mins  => COALESCE(s.delivery_minutes, 0),
                secs  => COALESCE(s.delivery_seconds, 0)
              );
        ELSIF s.delivery_type = 'specific' THEN
          NEW.scheduled_delivery_at := s.specific_time;
        ELSIF s.delivery_type = 'time_of_day' THEN
          -- schedule for the next occurrence of time_of_day
          IF s.delivery_time_of_day IS NOT NULL THEN
            tod_h := split_part(s.delivery_time_of_day::text, ':', 1)::int;
            tod_m := split_part(s.delivery_time_of_day::text, ':', 2)::int;
            NEW.scheduled_delivery_at := date_trunc('day', now()) + make_interval(hours => tod_h, mins => tod_m);
            IF NEW.scheduled_delivery_at < now() THEN
              NEW.scheduled_delivery_at := NEW.scheduled_delivery_at + interval '1 day';
            END IF;
          ELSE
            NEW.scheduled_delivery_at := now();
          END IF;
        ELSE
          -- default fallback
          NEW.scheduled_delivery_at := now();
        END IF;
      ELSE
        -- Non-first steps are left unscheduled; they'll be set after previous step delivery
        NEW.scheduled_delivery_at := NULL;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_next_check_time()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
BEGIN
  -- Set next check time to 5 seconds before scheduled delivery for precision
  NEW.next_check_at = NEW.scheduled_delivery_at - INTERVAL '5 seconds';
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_success_templates_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_add_friend_url()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
BEGIN
  -- LINE Bot IDが設定されている場合、友達追加URLを自動生成
  IF NEW.line_bot_id IS NOT NULL AND NEW.line_bot_id != '' THEN
    -- @マークを除去してlin.ee URLを生成
    NEW.add_friend_url = 'https://lin.ee/' || REPLACE(NEW.line_bot_id, '@', '');
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'add friend URL update failed: %', SQLERRM;
END;
$$;

CREATE OR REPLACE FUNCTION public.schedule_next_step()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
BEGIN
  -- When a step is delivered, schedule the next step
  IF NEW.status = 'delivered' AND OLD.status != 'delivered' THEN
    -- Mark next step as ready if exists
    UPDATE step_delivery_tracking
    SET status = 'ready'
    WHERE scenario_id = NEW.scenario_id
      AND friend_id = NEW.friend_id
      AND step_id = (
        SELECT s2.id FROM steps s1
        JOIN steps s2 ON s2.scenario_id = s1.scenario_id 
          AND s2.step_order = s1.step_order + 1
        WHERE s1.id = NEW.step_id
      );
  END IF;
  
  RETURN NEW;
END;
$$;