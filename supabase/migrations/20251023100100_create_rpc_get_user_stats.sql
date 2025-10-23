CREATE OR REPLACE FUNCTION get_user_plan_and_step_stats(p_user_id UUID)
RETURNS TABLE(
    plan_name TEXT,
    current_steps BIGINT,
    max_steps INTEGER
) AS $$
DECLARE
    v_plan_type TEXT;
BEGIN
    -- Get user's active plan
    SELECT plan_type INTO v_plan_type
    FROM public.user_plans
    WHERE user_id = p_user_id AND is_active = true
    LIMIT 1;

    -- If no active plan, assume free
    IF v_plan_type IS NULL THEN
        v_plan_type := 'free';
    END IF;

    -- Return the stats
    RETURN QUERY
    SELECT
        pc.name AS plan_name,
        (
            SELECT COUNT(*)
            FROM public.steps s
            JOIN public.step_scenarios ss ON s.scenario_id = ss.id
            WHERE ss.user_id = p_user_id
        ) AS current_steps,
        pc.max_total_steps AS max_steps
    FROM public.plan_configs pc
    WHERE pc.plan_type = v_plan_type;
END;
$$ LANGUAGE plpgsql;
