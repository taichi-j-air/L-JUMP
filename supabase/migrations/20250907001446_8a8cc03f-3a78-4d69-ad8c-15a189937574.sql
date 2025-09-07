-- Update friend_page_access table to ensure timer_start_at is properly set
-- This migration fixes issues with null timer_start_at values

-- First, update existing records where timer_start_at is null
UPDATE public.friend_page_access 
SET timer_start_at = COALESCE(first_access_at, created_at, now())
WHERE timer_start_at IS NULL;

-- Create a trigger to automatically set timer_start_at on insert if not provided
CREATE OR REPLACE FUNCTION public.set_timer_start_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
BEGIN
  -- Set timer_start_at if not provided
  IF NEW.timer_start_at IS NULL THEN
    NEW.timer_start_at := COALESCE(NEW.first_access_at, NEW.created_at, now());
  END IF;
  
  -- Set first_access_at if not provided
  IF NEW.first_access_at IS NULL THEN
    NEW.first_access_at := NEW.created_at;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for new inserts
DROP TRIGGER IF EXISTS trigger_set_timer_start_at ON public.friend_page_access;
CREATE TRIGGER trigger_set_timer_start_at
  BEFORE INSERT ON public.friend_page_access
  FOR EACH ROW
  EXECUTE FUNCTION public.set_timer_start_at();

-- Create trigger for updates to ensure consistency
DROP TRIGGER IF EXISTS trigger_update_timer_start_at ON public.friend_page_access;
CREATE TRIGGER trigger_update_timer_start_at
  BEFORE UPDATE ON public.friend_page_access
  FOR EACH ROW
  EXECUTE FUNCTION public.set_timer_start_at();