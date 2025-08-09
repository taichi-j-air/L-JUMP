-- Cleanup duplicates and orphan rows, add constraints, indexes, and triggers for reliable step delivery
-- 1) Remove duplicates in step_delivery_tracking keeping earliest per (scenario_id, step_id, friend_id)
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY scenario_id, step_id, friend_id ORDER BY created_at
  ) AS rn
  FROM public.step_delivery_tracking
)
DELETE FROM public.step_delivery_tracking t
USING ranked r
WHERE t.id = r.id AND r.rn > 1;

-- 2) Cleanup orphan rows across related tables
DELETE FROM public.step_delivery_tracking t
WHERE NOT EXISTS (SELECT 1 FROM public.steps s WHERE s.id = t.step_id);

DELETE FROM public.step_delivery_tracking t
WHERE NOT EXISTS (SELECT 1 FROM public.step_scenarios sc WHERE sc.id = t.scenario_id);

DELETE FROM public.step_delivery_tracking t
WHERE NOT EXISTS (SELECT 1 FROM public.line_friends f WHERE f.id = t.friend_id);

DELETE FROM public.step_messages m
WHERE NOT EXISTS (SELECT 1 FROM public.steps s WHERE s.id = m.step_id);

DELETE FROM public.steps s
WHERE NOT EXISTS (SELECT 1 FROM public.step_scenarios sc WHERE sc.id = s.scenario_id);

DELETE FROM public.scenario_transitions tr
WHERE NOT EXISTS (SELECT 1 FROM public.step_scenarios sc WHERE sc.id = tr.from_scenario_id)
   OR NOT EXISTS (SELECT 1 FROM public.step_scenarios sc2 WHERE sc2.id = tr.to_scenario_id);

DELETE FROM public.scenario_invite_codes ic
WHERE NOT EXISTS (SELECT 1 FROM public.step_scenarios sc WHERE sc.id = ic.scenario_id);

DELETE FROM public.scenario_friend_logs l
WHERE NOT EXISTS (SELECT 1 FROM public.step_scenarios sc WHERE sc.id = l.scenario_id)
   OR (l.friend_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.line_friends f WHERE f.id = l.friend_id));

-- 3) Drop any existing FKs on target tables so we can recreate with ON DELETE CASCADE
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT conname, conrelid::regclass AS rel
    FROM pg_constraint
    WHERE contype = 'f'
      AND conrelid::regclass::text IN (
        'public.steps',
        'public.step_messages',
        'public.scenario_transitions',
        'public.scenario_invite_codes',
        'public.scenario_friend_logs',
        'public.step_delivery_tracking'
      )
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT IF EXISTS %I', r.rel, r.conname);
  END LOOP;
END $$;

-- 4) Recreate foreign keys with ON DELETE CASCADE
ALTER TABLE public.steps
  ADD CONSTRAINT fk_steps_scenario
  FOREIGN KEY (scenario_id) REFERENCES public.step_scenarios(id) ON DELETE CASCADE;

ALTER TABLE public.step_messages
  ADD CONSTRAINT fk_step_messages_step
  FOREIGN KEY (step_id) REFERENCES public.steps(id) ON DELETE CASCADE;

ALTER TABLE public.scenario_transitions
  ADD CONSTRAINT fk_scenario_transitions_from
  FOREIGN KEY (from_scenario_id) REFERENCES public.step_scenarios(id) ON DELETE CASCADE;

ALTER TABLE public.scenario_transitions
  ADD CONSTRAINT fk_scenario_transitions_to
  FOREIGN KEY (to_scenario_id) REFERENCES public.step_scenarios(id) ON DELETE CASCADE;

ALTER TABLE public.scenario_invite_codes
  ADD CONSTRAINT fk_invite_codes_scenario
  FOREIGN KEY (scenario_id) REFERENCES public.step_scenarios(id) ON DELETE CASCADE;

ALTER TABLE public.scenario_friend_logs
  ADD CONSTRAINT fk_scenario_friend_logs_scenario
  FOREIGN KEY (scenario_id) REFERENCES public.step_scenarios(id) ON DELETE CASCADE;

ALTER TABLE public.scenario_friend_logs
  ADD CONSTRAINT fk_scenario_friend_logs_friend
  FOREIGN KEY (friend_id) REFERENCES public.line_friends(id) ON DELETE CASCADE;

ALTER TABLE public.step_delivery_tracking
  ADD CONSTRAINT fk_sdt_scenario
  FOREIGN KEY (scenario_id) REFERENCES public.step_scenarios(id) ON DELETE CASCADE;

ALTER TABLE public.step_delivery_tracking
  ADD CONSTRAINT fk_sdt_step
  FOREIGN KEY (step_id) REFERENCES public.steps(id) ON DELETE CASCADE;

ALTER TABLE public.step_delivery_tracking
  ADD CONSTRAINT fk_sdt_friend
  FOREIGN KEY (friend_id) REFERENCES public.line_friends(id) ON DELETE CASCADE;

-- 5) Enforce uniqueness for tracking rows per scenario/step/friend
CREATE UNIQUE INDEX IF NOT EXISTS ux_sdt_scenario_step_friend
  ON public.step_delivery_tracking (scenario_id, step_id, friend_id);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uniq_sdt_scenario_step_friend'
  ) THEN
    ALTER TABLE public.step_delivery_tracking
      ADD CONSTRAINT uniq_sdt_scenario_step_friend UNIQUE USING INDEX ux_sdt_scenario_step_friend;
  END IF;
END $$;

-- 6) Performance indexes for scheduler
CREATE INDEX IF NOT EXISTS idx_sdt_status_sched
  ON public.step_delivery_tracking (status, scheduled_delivery_at);

CREATE INDEX IF NOT EXISTS idx_sdt_next_check_waiting
  ON public.step_delivery_tracking (next_check_at)
  WHERE status = 'waiting';

CREATE INDEX IF NOT EXISTS idx_steps_scenario_order
  ON public.steps (scenario_id, step_order);

CREATE INDEX IF NOT EXISTS idx_sdl_scenario_friend_step
  ON public.step_delivery_logs (scenario_id, friend_id, step_id);

-- 7) Triggers to set scheduled time and next_check_at
CREATE OR REPLACE FUNCTION public.set_scheduled_delivery_time()
RETURNS trigger AS $$
DECLARE s RECORD;
BEGIN
  IF NEW.scheduled_delivery_at IS NULL THEN
    SELECT delivery_type, delivery_days, delivery_hours, delivery_minutes, delivery_seconds,
           specific_time, delivery_time_of_day
    INTO s
    FROM public.steps WHERE id = NEW.step_id;

    IF FOUND THEN
      IF s.delivery_type = 'immediate' THEN
        NEW.scheduled_delivery_at := now();
      ELSIF s.delivery_type = 'relative' THEN
        NEW.scheduled_delivery_at := now()
          + make_interval(
              days  => COALESCE(s.delivery_days, 0),
              hours => COALESCE(s.delivery_hours, 0),
              mins  => COALESCE(s.delivery_minutes, 0),
              secs  => COALESCE(s.delivery_seconds, 0)
            );
      ELSIF s.delivery_type = 'specific' THEN
        NEW.scheduled_delivery_at := s.specific_time;
      ELSIF s.delivery_type = 'time_of_day' THEN
        NEW.scheduled_delivery_at := (date_trunc('day', now()) + COALESCE(s.delivery_time_of_day, '00:00'::time))::timestamptz;
        IF NEW.scheduled_delivery_at < now() THEN
          NEW.scheduled_delivery_at := NEW.scheduled_delivery_at + interval '1 day';
        END IF;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.set_next_check_time()
RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'waiting' THEN
    NEW.next_check_at := GREATEST(COALESCE(NEW.scheduled_delivery_at - interval '1 minute', now()), now());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_scheduled_delivery_time ON public.step_delivery_tracking;
DROP TRIGGER IF EXISTS trg_set_next_check_time ON public.step_delivery_tracking;

CREATE TRIGGER trg_set_scheduled_delivery_time
BEFORE INSERT OR UPDATE OF step_id, status, scheduled_delivery_at ON public.step_delivery_tracking
FOR EACH ROW EXECUTE FUNCTION public.set_scheduled_delivery_time();

CREATE TRIGGER trg_set_next_check_time
BEFORE INSERT OR UPDATE OF status, scheduled_delivery_at ON public.step_delivery_tracking
FOR EACH ROW EXECUTE FUNCTION public.set_next_check_time();