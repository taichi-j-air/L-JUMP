-- Add new delivery type for relative timing from previous step
ALTER TABLE steps 
ADD COLUMN delivery_relative_to_previous boolean DEFAULT false,
ADD COLUMN delivery_time_of_day time DEFAULT NULL;

-- Update delivery type to include the new option
-- Current delivery_type values: 'immediately', 'relative', 'specific_time'
-- Adding: 'relative_to_previous' for the new functionality

-- Add comments for clarity
COMMENT ON COLUMN steps.delivery_relative_to_previous IS 'When true, delivery time is calculated relative to previous step completion';
COMMENT ON COLUMN steps.delivery_time_of_day IS 'Specific time of day for relative delivery (HH:MM format)';

-- Update the calculate_scheduled_delivery_time function to handle the new delivery type
CREATE OR REPLACE FUNCTION public.calculate_scheduled_delivery_time(
  p_friend_added_at timestamp with time zone, 
  p_delivery_type text, 
  p_delivery_seconds integer, 
  p_delivery_minutes integer, 
  p_delivery_hours integer, 
  p_delivery_days integer, 
  p_specific_time timestamp with time zone DEFAULT NULL,
  p_previous_step_delivered_at timestamp with time zone DEFAULT NULL,
  p_delivery_time_of_day time DEFAULT NULL
)
RETURNS timestamp with time zone
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  base_time timestamp with time zone;
  target_date date;
  final_timestamp timestamp with time zone;
BEGIN
  -- For immediate delivery
  IF p_delivery_type = 'immediately' THEN
    RETURN p_friend_added_at;
  END IF;
  
  -- For specific time delivery
  IF p_delivery_type = 'specific_time' AND p_specific_time IS NOT NULL THEN
    RETURN p_specific_time;
  END IF;
  
  -- For relative time delivery (after friend addition)
  IF p_delivery_type = 'relative' THEN
    RETURN p_friend_added_at + 
           INTERVAL '1 day' * COALESCE(p_delivery_days, 0) +
           INTERVAL '1 hour' * COALESCE(p_delivery_hours, 0) +
           INTERVAL '1 minute' * COALESCE(p_delivery_minutes, 0) +
           INTERVAL '1 second' * COALESCE(p_delivery_seconds, 0);
  END IF;
  
  -- For relative to previous step delivery
  IF p_delivery_type = 'relative_to_previous' THEN
    -- Use previous step delivery time as base, or friend added time for first step
    base_time := COALESCE(p_previous_step_delivered_at, p_friend_added_at);
    
    -- Calculate target date by adding days
    target_date := (base_time + INTERVAL '1 day' * COALESCE(p_delivery_days, 0))::date;
    
    -- If specific time of day is provided, use it; otherwise use the same time as base
    IF p_delivery_time_of_day IS NOT NULL THEN
      final_timestamp := target_date + p_delivery_time_of_day;
    ELSE
      final_timestamp := base_time + 
                        INTERVAL '1 day' * COALESCE(p_delivery_days, 0) +
                        INTERVAL '1 hour' * COALESCE(p_delivery_hours, 0) +
                        INTERVAL '1 minute' * COALESCE(p_delivery_minutes, 0) +
                        INTERVAL '1 second' * COALESCE(p_delivery_seconds, 0);
    END IF;
    
    RETURN final_timestamp;
  END IF;
  
  -- Default to immediate if no valid type
  RETURN p_friend_added_at;
END;
$function$;

-- Update the trigger function to handle the new delivery type
CREATE OR REPLACE FUNCTION public.set_scheduled_delivery_time()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  previous_step_delivery_time timestamp with time zone;
BEGIN
  -- For relative_to_previous delivery type, get the previous step's delivery time
  IF (SELECT delivery_type FROM steps WHERE id = NEW.step_id) = 'relative_to_previous' THEN
    -- Get the delivery time of the previous step
    SELECT sdt.delivered_at INTO previous_step_delivery_time
    FROM step_delivery_tracking sdt
    JOIN steps s ON s.id = sdt.step_id
    WHERE sdt.scenario_id = NEW.scenario_id 
      AND sdt.friend_id = NEW.friend_id
      AND s.step_order < (SELECT step_order FROM steps WHERE id = NEW.step_id)
      AND sdt.delivered_at IS NOT NULL
    ORDER BY s.step_order DESC
    LIMIT 1;
  END IF;

  -- Calculate scheduled delivery time based on step settings
  SELECT calculate_scheduled_delivery_time(
    (SELECT added_at FROM line_friends WHERE id = NEW.friend_id),
    s.delivery_type,
    s.delivery_seconds,
    s.delivery_minutes,
    s.delivery_hours,
    s.delivery_days,
    s.specific_time,
    previous_step_delivery_time,
    s.delivery_time_of_day
  )
  INTO NEW.scheduled_delivery_at
  FROM steps s
  WHERE s.id = NEW.step_id;
  
  RETURN NEW;
END;
$function$;