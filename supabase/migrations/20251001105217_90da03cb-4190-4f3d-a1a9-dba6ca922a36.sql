-- Fix set_scheduled_delivery_time trigger to handle all delivery_type variations
CREATE OR REPLACE FUNCTION public.set_scheduled_delivery_time()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
        -- Handle various delivery_type values with better logging
        IF s.delivery_type IN ('immediate', 'immediately') THEN
          NEW.scheduled_delivery_at := now();
          RAISE LOG 'Step scheduled immediately: %', NEW.step_id;
        ELSIF s.delivery_type IN ('relative', 'relative_to_previous') THEN
          NEW.scheduled_delivery_at := now()
            + make_interval(
                days  => COALESCE(s.delivery_days, 0),
                hours => COALESCE(s.delivery_hours, 0),
                mins  => COALESCE(s.delivery_minutes, 0),
                secs  => COALESCE(s.delivery_seconds, 0)
              );
          RAISE LOG 'Step scheduled relative: % at %', NEW.step_id, NEW.scheduled_delivery_at;
        ELSIF s.delivery_type IN ('specific', 'specific_time') THEN
          NEW.scheduled_delivery_at := s.specific_time;
          RAISE LOG 'Step scheduled at specific time: % at %', NEW.step_id, NEW.scheduled_delivery_at;
        ELSIF s.delivery_type = 'time_of_day' THEN
          -- schedule for the next occurrence of time_of_day
          IF s.delivery_time_of_day IS NOT NULL THEN
            tod_h := split_part(s.delivery_time_of_day::text, ':', 1)::int;
            tod_m := split_part(s.delivery_time_of_day::text, ':', 2)::int;
            NEW.scheduled_delivery_at := date_trunc('day', now()) + make_interval(hours => tod_h, mins => tod_m);
            IF NEW.scheduled_delivery_at < now() THEN
              NEW.scheduled_delivery_at := NEW.scheduled_delivery_at + interval '1 day';
            END IF;
            RAISE LOG 'Step scheduled at time of day: % at %', NEW.step_id, NEW.scheduled_delivery_at;
          ELSE
            NEW.scheduled_delivery_at := now();
            RAISE LOG 'Step scheduled immediately (no time_of_day): %', NEW.step_id;
          END IF;
        ELSE
          -- default fallback for unknown types
          NEW.scheduled_delivery_at := now();
          RAISE LOG 'Step scheduled immediately (unknown type %): %', s.delivery_type, NEW.step_id;
        END IF;
        
        -- Ensure scheduled time is never null for first step
        IF NEW.scheduled_delivery_at IS NULL THEN
          NEW.scheduled_delivery_at := now();
          RAISE WARNING 'Forced scheduled_delivery_at to now() for step %', NEW.step_id;
        END IF;
      ELSE
        -- Non-first steps are left unscheduled; they'll be set after previous step delivery
        NEW.scheduled_delivery_at := NULL;
        RAISE LOG 'Non-first step left unscheduled: % (order: %)', NEW.step_id, s.step_order;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the insert
    RAISE WARNING 'Error in set_scheduled_delivery_time for step %: %', NEW.step_id, SQLERRM;
    -- Ensure we have a scheduled time even on error
    IF NEW.scheduled_delivery_at IS NULL AND COALESCE((SELECT step_order FROM steps WHERE id = NEW.step_id), 0) = 0 THEN
      NEW.scheduled_delivery_at := now();
    END IF;
    RETURN NEW;
END;
$function$;