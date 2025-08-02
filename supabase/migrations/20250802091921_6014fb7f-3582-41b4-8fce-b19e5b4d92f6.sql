-- step_scenarios → profiles間の外部キー追加
ALTER TABLE public.step_scenarios
ADD CONSTRAINT fk_step_scenarios_user_id
FOREIGN KEY (user_id)
REFERENCES public.profiles (user_id)
ON UPDATE CASCADE
ON DELETE CASCADE;