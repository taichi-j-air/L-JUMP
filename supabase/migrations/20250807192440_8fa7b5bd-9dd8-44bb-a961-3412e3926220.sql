-- Fix step delivery: add missing triggers to compute schedule and chain next steps
-- Safe drop existing triggers if any
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'a_set_scheduled_delivery_time') THEN
    DROP TRIGGER a_set_scheduled_delivery_time ON public.step_delivery_tracking;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'b_update_next_check_time_on_insert') THEN
    DROP TRIGGER b_update_next_check_time_on_insert ON public.step_delivery_tracking;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'b_update_next_check_time_on_update') THEN
    DROP TRIGGER b_update_next_check_time_on_update ON public.step_delivery_tracking;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'c_schedule_next_step_after_delivery') THEN
    DROP TRIGGER c_schedule_next_step_after_delivery ON public.step_delivery_tracking;
  END IF;
END $$;

-- Set scheduled_delivery_at when a tracking row is inserted
CREATE TRIGGER a_set_scheduled_delivery_time
BEFORE INSERT ON public.step_delivery_tracking
FOR EACH ROW
EXECUTE FUNCTION public.set_scheduled_delivery_time();

-- Maintain next_check_at on insert
CREATE TRIGGER b_update_next_check_time_on_insert
BEFORE INSERT ON public.step_delivery_tracking
FOR EACH ROW
EXECUTE FUNCTION public.update_next_check_time();

-- Maintain next_check_at whenever scheduled_delivery_at changes
CREATE TRIGGER b_update_next_check_time_on_update
BEFORE UPDATE OF scheduled_delivery_at ON public.step_delivery_tracking
FOR EACH ROW
EXECUTE FUNCTION public.update_next_check_time();

-- When a step is delivered, mark the next step as ready (or schedule it)
CREATE TRIGGER c_schedule_next_step_after_delivery
AFTER UPDATE OF status ON public.step_delivery_tracking
FOR EACH ROW
WHEN (NEW.status = 'delivered' AND (OLD.status IS DISTINCT FROM 'delivered'))
EXECUTE FUNCTION public.schedule_next_step();