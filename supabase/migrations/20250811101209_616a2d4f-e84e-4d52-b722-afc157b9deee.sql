-- Update calculate_scheduled_delivery_time to ensure future times for time_of_day and relative_to_previous
CREATE OR REPLACE FUNCTION public.calculate_scheduled_delivery_time(
  p_friend_added_at timestamp with time zone,
  p_delivery_type text,
  p_delivery_seconds integer,
  p_delivery_minutes integer,
  p_delivery_hours integer,
  p_delivery_days integer,
  p_specific_time timestamp with time zone DEFAULT NULL,
  p_previous_step_delivered_at timestamp with time zone DEFAULT NULL,
  p_delivery_time_of_day time without time zone DEFAULT NULL
)
RETURNS timestamp with time zone
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  base_time timestamptz;
  target_date date;
  final_timestamp timestamptz;
  now_ts timestamptz := now();
BEGIN
  -- Immediately: use the provided base time (usually registration time)
  IF p_delivery_type = 'immediately' THEN
    RETURN COALESCE(p_friend_added_at, now_ts);
  END IF;

  -- Specific time: return as-is
  IF p_delivery_type = 'specific_time' AND p_specific_time IS NOT NULL THEN
    RETURN p_specific_time;
  END IF;

  -- Relative to registration (or provided base)
  IF p_delivery_type = 'relative' THEN
    final_timestamp := COALESCE(p_friend_added_at, now_ts)
      + make_interval(
          days  => COALESCE(p_delivery_days, 0),
          hours => COALESCE(p_delivery_hours, 0),
          mins  => COALESCE(p_delivery_minutes, 0),
          secs  => COALESCE(p_delivery_seconds, 0)
        );
    -- Ensure not in the past
    IF final_timestamp <= now_ts THEN
      final_timestamp := now_ts + interval '1 second';
    END IF;
    RETURN final_timestamp;
  END IF;

  -- Relative to previous step delivery
  IF p_delivery_type = 'relative_to_previous' THEN
    base_time := COALESCE(p_previous_step_delivered_at, p_friend_added_at, now_ts);

    IF p_delivery_time_of_day IS NOT NULL THEN
      -- Use target date with specified time of day
      target_date := (base_time + make_interval(days => COALESCE(p_delivery_days, 0)))::date;
      final_timestamp := target_date + p_delivery_time_of_day;
      -- If computed time is not in the future, move to next day
      IF final_timestamp <= now_ts THEN
        final_timestamp := (target_date + 1) + p_delivery_time_of_day;
      END IF;
      RETURN final_timestamp;
    ELSE
      final_timestamp := base_time
        + make_interval(
            days  => COALESCE(p_delivery_days, 0),
            hours => COALESCE(p_delivery_hours, 0),
            mins  => COALESCE(p_delivery_minutes, 0),
            secs  => COALESCE(p_delivery_seconds, 0)
          );
      IF final_timestamp <= now_ts THEN
        final_timestamp := now_ts + interval '1 second';
      END IF;
      RETURN final_timestamp;
    END IF;
  END IF;

  -- Default: return provided base or now
  RETURN COALESCE(p_friend_added_at, now_ts);
END;
$function$;