-- Add triggers for scheduling and next-check times on step_delivery_tracking
-- Note: We intentionally do NOT attach schedule_next_step because our Edge Function handles precise scheduling of the next step including scheduled_delivery_at.

-- Create trigger to set next_check_at anytime scheduled_delivery_at is set/changed
DROP TRIGGER IF EXISTS trg_step_tracking_next_check_insert ON public.step_delivery_tracking;
DROP TRIGGER IF EXISTS trg_step_tracking_next_check_update ON public.step_delivery_tracking;

CREATE TRIGGER trg_step_tracking_next_check_insert
BEFORE INSERT ON public.step_delivery_tracking
FOR EACH ROW
EXECUTE FUNCTION public.update_next_check_time();

CREATE TRIGGER trg_step_tracking_next_check_update
BEFORE UPDATE OF scheduled_delivery_at ON public.step_delivery_tracking
FOR EACH ROW
EXECUTE FUNCTION public.update_next_check_time();