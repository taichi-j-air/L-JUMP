-- Fix sequential delivery scheduling
-- 1) Only set scheduled_delivery_at automatically for the first step of a scenario
CREATE OR REPLACE FUNCTION public.set_scheduled_delivery_time()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
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

-- 2) Data cleanup: clear premature schedules on non-first steps that aren't delivered yet
UPDATE public.step_delivery_tracking AS t
SET 
  scheduled_delivery_at = NULL,
  next_check_at = NULL,
  status = 'waiting',
  updated_at = now()
FROM public.steps s
WHERE s.id = t.step_id
  AND COALESCE(s.step_order, 0) > 0
  AND t.delivered_at IS NULL
  AND t.status IN ('waiting','ready')
  AND t.scheduled_delivery_at IS NOT NULL;