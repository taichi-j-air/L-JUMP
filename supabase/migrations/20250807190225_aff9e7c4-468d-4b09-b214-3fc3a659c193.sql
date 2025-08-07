-- Create necessary triggers for step scheduling and progression if they don't exist
DO $$ BEGIN
  -- Trigger: set scheduled_delivery_at on insert
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_scheduled_delivery_time_before_insert'
  ) THEN
    CREATE TRIGGER set_scheduled_delivery_time_before_insert
    BEFORE INSERT ON public.step_delivery_tracking
    FOR EACH ROW
    EXECUTE FUNCTION public.set_scheduled_delivery_time();
  END IF;
END $$;

DO $$ BEGIN
  -- Trigger: update next_check_at on insert
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_next_check_time_before_insert'
  ) THEN
    CREATE TRIGGER update_next_check_time_before_insert
    BEFORE INSERT ON public.step_delivery_tracking
    FOR EACH ROW
    EXECUTE FUNCTION public.update_next_check_time();
  END IF;
END $$;

DO $$ BEGIN
  -- Trigger: update next_check_at when scheduled_delivery_at changes
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_next_check_time_before_update'
  ) THEN
    CREATE TRIGGER update_next_check_time_before_update
    BEFORE UPDATE OF scheduled_delivery_at ON public.step_delivery_tracking
    FOR EACH ROW
    EXECUTE FUNCTION public.update_next_check_time();
  END IF;
END $$;

DO $$ BEGIN
  -- Trigger: when a step is delivered, prepare the next step
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'schedule_next_step_after_update'
  ) THEN
    CREATE TRIGGER schedule_next_step_after_update
    AFTER UPDATE ON public.step_delivery_tracking
    FOR EACH ROW
    EXECUTE FUNCTION public.schedule_next_step();
  END IF;
END $$;
