-- Clean orphan rows referencing non-existing scenarios/friends
DELETE FROM public.scenario_friend_logs sfl
WHERE NOT EXISTS (SELECT 1 FROM public.step_scenarios ss WHERE ss.id = sfl.scenario_id)
   OR (sfl.friend_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.line_friends lf WHERE lf.id = sfl.friend_id));

-- Also ensure invite_clicks refer to existing codes (optional cleanup)
DELETE FROM public.invite_clicks ic
WHERE NOT EXISTS (
  SELECT 1 FROM public.scenario_invite_codes sic WHERE sic.invite_code = ic.invite_code
);

-- Re-run only the failed FK additions
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