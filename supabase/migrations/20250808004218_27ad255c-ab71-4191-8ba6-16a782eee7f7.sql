-- Clean up orphaned rows BEFORE adding foreign keys
DELETE FROM public.step_delivery_tracking sdt
WHERE NOT EXISTS (SELECT 1 FROM public.line_friends lf WHERE lf.id = sdt.friend_id)
   OR NOT EXISTS (SELECT 1 FROM public.steps st WHERE st.id = sdt.step_id)
   OR NOT EXISTS (SELECT 1 FROM public.step_scenarios ss WHERE ss.id = sdt.scenario_id);

DELETE FROM public.step_messages sm
WHERE NOT EXISTS (SELECT 1 FROM public.steps st WHERE st.id = sm.step_id);

DELETE FROM public.scenario_transitions tr
WHERE NOT EXISTS (SELECT 1 FROM public.step_scenarios s WHERE s.id = tr.from_scenario_id)
   OR NOT EXISTS (SELECT 1 FROM public.step_scenarios s WHERE s.id = tr.to_scenario_id);

-- Now add cascading foreign keys
DO $$ BEGIN
  ALTER TABLE public.steps
    ADD CONSTRAINT fk_steps_scenario
    FOREIGN KEY (scenario_id) REFERENCES public.step_scenarios(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.step_messages
    ADD CONSTRAINT fk_step_messages_step
    FOREIGN KEY (step_id) REFERENCES public.steps(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.step_delivery_tracking
    ADD CONSTRAINT fk_sdt_scenario
    FOREIGN KEY (scenario_id) REFERENCES public.step_scenarios(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.step_delivery_tracking
    ADD CONSTRAINT fk_sdt_step
    FOREIGN KEY (step_id) REFERENCES public.steps(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.step_delivery_tracking
    ADD CONSTRAINT fk_sdt_friend
    FOREIGN KEY (friend_id) REFERENCES public.line_friends(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.scenario_transitions
    ADD CONSTRAINT fk_transitions_from
    FOREIGN KEY (from_scenario_id) REFERENCES public.step_scenarios(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.scenario_transitions
    ADD CONSTRAINT fk_transitions_to
    FOREIGN KEY (to_scenario_id) REFERENCES public.step_scenarios(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.scenario_invite_codes
    ADD CONSTRAINT fk_invite_codes_scenario
    FOREIGN KEY (scenario_id) REFERENCES public.step_scenarios(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.scenario_friend_logs
    ADD CONSTRAINT fk_sfl_scenario
    FOREIGN KEY (scenario_id) REFERENCES public.step_scenarios(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.scenario_friend_logs
    ADD CONSTRAINT fk_sfl_friend
    FOREIGN KEY (friend_id) REFERENCES public.line_friends(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Unique index to avoid duplicate tracking per friend/step/scenario
CREATE UNIQUE INDEX IF NOT EXISTS uniq_sdt_scenario_step_friend 
  ON public.step_delivery_tracking(scenario_id, step_id, friend_id);

-- Triggers (idempotent)
DROP TRIGGER IF EXISTS trg_set_scheduled_delivery_time ON public.step_delivery_tracking;
CREATE TRIGGER trg_set_scheduled_delivery_time
  BEFORE INSERT ON public.step_delivery_tracking
  FOR EACH ROW EXECUTE FUNCTION public.set_scheduled_delivery_time();

DROP TRIGGER IF EXISTS trg_update_next_check_time ON public.step_delivery_tracking;
CREATE TRIGGER trg_update_next_check_time
  BEFORE INSERT OR UPDATE ON public.step_delivery_tracking
  FOR EACH ROW EXECUTE FUNCTION public.update_next_check_time();

DROP TRIGGER IF EXISTS trg_schedule_next_step ON public.step_delivery_tracking;
CREATE TRIGGER trg_schedule_next_step
  AFTER UPDATE ON public.step_delivery_tracking
  FOR EACH ROW WHEN (NEW.status = 'delivered' AND COALESCE(OLD.status, '') <> 'delivered')
  EXECUTE FUNCTION public.schedule_next_step();
