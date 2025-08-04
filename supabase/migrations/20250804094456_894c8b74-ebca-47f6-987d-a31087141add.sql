-- Fix function search path for security
ALTER FUNCTION calculate_scheduled_delivery_time(timestamp with time zone, text, integer, integer, integer, integer, timestamp with time zone)
SET search_path = 'public', 'pg_temp';

ALTER FUNCTION set_scheduled_delivery_time()
SET search_path = 'public', 'pg_temp';