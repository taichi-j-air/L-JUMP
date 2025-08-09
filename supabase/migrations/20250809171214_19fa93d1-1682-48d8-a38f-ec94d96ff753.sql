-- Harden functions: set fixed search_path and SECURITY DEFINER per linter
CREATE OR REPLACE FUNCTION public.set_scheduled_delivery_time()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE s RECORD;
BEGIN
  IF NEW.scheduled_delivery_at IS NULL THEN
    SELECT delivery_type, delivery_days, delivery_hours, delivery_minutes, delivery_seconds,
           specific_time, delivery_time_of_day
    INTO s
    FROM public.steps WHERE id = NEW.step_id;

    IF FOUND THEN
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
        NEW.scheduled_delivery_at := (date_trunc('day', now()) + COALESCE(s.delivery_time_of_day, '00:00'::time))::timestamptz;
        IF NEW.scheduled_delivery_at < now() THEN
          NEW.scheduled_delivery_at := NEW.scheduled_delivery_at + interval '1 day';
        END IF;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_next_check_time()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.status = 'waiting' THEN
    NEW.next_check_at := GREATEST(COALESCE(NEW.scheduled_delivery_at - interval '1 minute', now()), now());
  END IF;
  RETURN NEW;
END;
$function$;