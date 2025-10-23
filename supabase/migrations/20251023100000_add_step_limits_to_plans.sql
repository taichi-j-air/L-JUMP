ALTER TABLE public.plan_configs ADD COLUMN IF NOT EXISTS max_total_steps INTEGER NOT NULL DEFAULT 0;

-- Set default values for existing plans
UPDATE public.plan_configs SET max_total_steps = 20 WHERE plan_type = 'free';
UPDATE public.plan_configs SET max_total_steps = 50 WHERE plan_type = 'basic';
UPDATE public.plan_configs SET max_total_steps = -1 WHERE plan_type = 'premium';
UPDATE public.plan_configs SET max_total_steps = -1 WHERE plan_type = 'developer';