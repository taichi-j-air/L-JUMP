-- Add cascading foreign keys for cleanup on delete and ensure data integrity

-- steps -> step_scenarios
ALTER TABLE public.steps
  ADD CONSTRAINT IF NOT EXISTS fk_steps_scenario
  FOREIGN KEY (scenario_id) REFERENCES public.step_scenarios(id) ON DELETE CASCADE;

-- step_messages -> steps
ALTER TABLE public.step_messages
  ADD CONSTRAINT IF NOT EXISTS fk_step_messages_step
  FOREIGN KEY (step_id) REFERENCES public.steps(id) ON DELETE CASCADE;

-- step_delivery_tracking -> step_scenarios, steps, line_friends
ALTER TABLE public.step_delivery_tracking
  ADD CONSTRAINT IF NOT EXISTS fk_sdt_scenario
  FOREIGN KEY (scenario_id) REFERENCES public.step_scenarios(id) ON DELETE CASCADE;
ALTER TABLE public.step_delivery_tracking
  ADD CONSTRAINT IF NOT EXISTS fk_sdt_step
  FOREIGN KEY (step_id) REFERENCES public.steps(id) ON DELETE CASCADE;
ALTER TABLE public.step_delivery_tracking
  ADD CONSTRAINT IF NOT EXISTS fk_sdt_friend
  FOREIGN KEY (friend_id) REFERENCES public.line_friends(id) ON DELETE CASCADE;

-- scenario_transitions -> step_scenarios (from/to)
ALTER TABLE public.scenario_transitions
  ADD CONSTRAINT IF NOT EXISTS fk_transitions_from
  FOREIGN KEY (from_scenario_id) REFERENCES public.step_scenarios(id) ON DELETE CASCADE;
ALTER TABLE public.scenario_transitions
  ADD CONSTRAINT IF NOT EXISTS fk_transitions_to
  FOREIGN KEY (to_scenario_id) REFERENCES public.step_scenarios(id) ON DELETE CASCADE;

-- scenario_invite_codes -> step_scenarios
ALTER TABLE public.scenario_invite_codes
  ADD CONSTRAINT IF NOT EXISTS fk_invite_codes_scenario
  FOREIGN KEY (scenario_id) REFERENCES public.step_scenarios(id) ON DELETE CASCADE;

-- scenario_friend_logs -> step_scenarios and line_friends
ALTER TABLE public.scenario_friend_logs
  ADD CONSTRAINT IF NOT EXISTS fk_sfl_scenario
  FOREIGN KEY (scenario_id) REFERENCES public.step_scenarios(id) ON DELETE CASCADE;
ALTER TABLE public.scenario_friend_logs
  ADD CONSTRAINT IF NOT EXISTS fk_sfl_friend
  FOREIGN KEY (friend_id) REFERENCES public.line_friends(id) ON DELETE SET NULL;

-- chat_messages -> line_friends
ALTER TABLE public.chat_messages
  ADD CONSTRAINT IF NOT EXISTS fk_chat_messages_friend
  FOREIGN KEY (friend_id) REFERENCES public.line_friends(id) ON DELETE CASCADE;

-- Unique index to avoid duplicate tracking per friend/step/scenario
CREATE UNIQUE INDEX IF NOT EXISTS uniq_sdt_scenario_step_friend 
  ON public.step_delivery_tracking(scenario_id, step_id, friend_id);

-- Triggers for scheduling and next-check logic
DROP TRIGGER IF EXISTS trg_set_scheduled_delivery_time ON public.step_delivery_tracking;
CREATE TRIGGER trg_set_scheduled_delivery_time
  BEFORE INSERT ON public.step_delivery_tracking
  FOR EACH ROW EXECUTE FUNCTION public.set_scheduled_delivery_time();

DROP TRIGGER IF EXISTS trg_update_next_check_time ON public.step_delivery_tracking;
CREATE TRIGGER trg_update_next_check_time
  BEFORE INSERT OR UPDATE ON public.step_delivery_tracking
  FOR EACH ROW EXECUTE FUNCTION public.update_next_check_time();

-- Trigger to mark next step ready when current delivered (safety net)
DROP TRIGGER IF EXISTS trg_schedule_next_step ON public.step_delivery_tracking;
CREATE TRIGGER trg_schedule_next_step
  AFTER UPDATE ON public.step_delivery_tracking
  FOR EACH ROW WHEN (NEW.status = 'delivered' AND COALESCE(OLD.status, '') <> 'delivered')
  EXECUTE FUNCTION public.schedule_next_step();

-- One-time cleanup: remove orphan tracking rows
DELETE FROM public.step_delivery_tracking sdt
WHERE NOT EXISTS (SELECT 1 FROM public.line_friends lf WHERE lf.id = sdt.friend_id)
   OR NOT EXISTS (SELECT 1 FROM public.steps st WHERE st.id = sdt.step_id)
   OR NOT EXISTS (SELECT 1 FROM public.step_scenarios ss WHERE ss.id = sdt.scenario_id);

-- Optional cleanup: remove orphan messages if any
DELETE FROM public.step_messages sm
WHERE NOT EXISTS (SELECT 1 FROM public.steps st WHERE st.id = sm.step_id);
