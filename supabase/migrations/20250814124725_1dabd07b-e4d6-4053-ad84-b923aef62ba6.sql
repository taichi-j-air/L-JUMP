-- Fix the function search path issue
ALTER FUNCTION public.set_submission_owner() SET search_path TO 'public', 'pg_temp';