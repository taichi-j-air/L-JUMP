-- 1) Clean duplicates in step_delivery_tracking before adding constraints
WITH ranked AS (
  SELECT 
    id,
    scenario_id,
    step_id,
    friend_id,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY scenario_id, step_id, friend_id 
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM step_delivery_tracking
)
DELETE FROM step_delivery_tracking d
USING ranked r
WHERE d.id = r.id AND r.rn > 1;

-- 2) Ensure unique tracking per (scenario, step, friend)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uniq_sdt_scenario_step_friend'
  ) THEN
    ALTER TABLE step_delivery_tracking
    ADD CONSTRAINT uniq_sdt_scenario_step_friend
    UNIQUE (scenario_id, step_id, friend_id);
  END IF;
END $$;

-- 3) Add/replace FKs with ON DELETE CASCADE to keep data clean when scenarios/steps are deleted
-- Steps -> Scenarios
ALTER TABLE steps DROP CONSTRAINT IF EXISTS steps_scenario_id_fkey;
ALTER TABLE steps
  ADD CONSTRAINT steps_scenario_id_fkey
  FOREIGN KEY (scenario_id) REFERENCES step_scenarios(id) ON DELETE CASCADE;

-- Step messages -> Steps
ALTER TABLE step_messages DROP CONSTRAINT IF EXISTS step_messages_step_id_fkey;
ALTER TABLE step_messages
  ADD CONSTRAINT step_messages_step_id_fkey
  FOREIGN KEY (step_id) REFERENCES steps(id) ON DELETE CASCADE;

-- Transitions -> Scenarios
ALTER TABLE scenario_transitions DROP CONSTRAINT IF EXISTS scenario_transitions_from_fkey;
ALTER TABLE scenario_transitions DROP CONSTRAINT IF EXISTS scenario_transitions_to_fkey;
ALTER TABLE scenario_transitions
  ADD CONSTRAINT scenario_transitions_from_fkey
  FOREIGN KEY (from_scenario_id) REFERENCES step_scenarios(id) ON DELETE CASCADE;
ALTER TABLE scenario_transitions
  ADD CONSTRAINT scenario_transitions_to_fkey
  FOREIGN KEY (to_scenario_id) REFERENCES step_scenarios(id) ON DELETE CASCADE;

-- Invite codes -> Scenarios
ALTER TABLE scenario_invite_codes DROP CONSTRAINT IF EXISTS scenario_invite_codes_scenario_id_fkey;
ALTER TABLE scenario_invite_codes
  ADD CONSTRAINT scenario_invite_codes_scenario_id_fkey
  FOREIGN KEY (scenario_id) REFERENCES step_scenarios(id) ON DELETE CASCADE;

-- Scenario friend logs -> Scenarios and Friends
ALTER TABLE scenario_friend_logs DROP CONSTRAINT IF EXISTS scenario_friend_logs_scenario_id_fkey;
ALTER TABLE scenario_friend_logs DROP CONSTRAINT IF EXISTS scenario_friend_logs_friend_id_fkey;
ALTER TABLE scenario_friend_logs
  ADD CONSTRAINT scenario_friend_logs_scenario_id_fkey
  FOREIGN KEY (scenario_id) REFERENCES step_scenarios(id) ON DELETE CASCADE;
ALTER TABLE scenario_friend_logs
  ADD CONSTRAINT scenario_friend_logs_friend_id_fkey
  FOREIGN KEY (friend_id) REFERENCES line_friends(id) ON DELETE CASCADE;

-- Tracking -> Scenarios, Steps, Friends
ALTER TABLE step_delivery_tracking DROP CONSTRAINT IF EXISTS step_delivery_tracking_scenario_id_fkey;
ALTER TABLE step_delivery_tracking DROP CONSTRAINT IF EXISTS step_delivery_tracking_step_id_fkey;
ALTER TABLE step_delivery_tracking DROP CONSTRAINT IF EXISTS step_delivery_tracking_friend_id_fkey;
ALTER TABLE step_delivery_tracking
  ADD CONSTRAINT step_delivery_tracking_scenario_id_fkey
  FOREIGN KEY (scenario_id) REFERENCES step_scenarios(id) ON DELETE CASCADE;
ALTER TABLE step_delivery_tracking
  ADD CONSTRAINT step_delivery_tracking_step_id_fkey
  FOREIGN KEY (step_id) REFERENCES steps(id) ON DELETE CASCADE;
ALTER TABLE step_delivery_tracking
  ADD CONSTRAINT step_delivery_tracking_friend_id_fkey
  FOREIGN KEY (friend_id) REFERENCES line_friends(id) ON DELETE CASCADE;

-- 4) Helpful indexes for scheduler performance
CREATE INDEX IF NOT EXISTS idx_sdt_status_schedule ON step_delivery_tracking(status, scheduled_delivery_at);
CREATE INDEX IF NOT EXISTS idx_sdt_next_check ON step_delivery_tracking(next_check_at);

-- 5) Triggers to auto-calc schedule and next_check
DROP TRIGGER IF EXISTS trg_set_scheduled_delivery_time ON step_delivery_tracking;
CREATE TRIGGER trg_set_scheduled_delivery_time
BEFORE INSERT ON step_delivery_tracking
FOR EACH ROW
EXECUTE FUNCTION set_scheduled_delivery_time();

DROP TRIGGER IF EXISTS trg_update_next_check_time ON step_delivery_tracking;
CREATE TRIGGER trg_update_next_check_time
BEFORE INSERT OR UPDATE ON step_delivery_tracking
FOR EACH ROW
EXECUTE FUNCTION update_next_check_time();
