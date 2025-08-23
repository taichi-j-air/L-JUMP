-- Add necessary columns to cms_pages for step delivery timer configuration
ALTER TABLE public.cms_pages 
ADD COLUMN IF NOT EXISTS timer_scenario_id UUID REFERENCES public.step_scenarios(id),
ADD COLUMN IF NOT EXISTS timer_step_id UUID REFERENCES public.steps(id);

-- Ensure friend_page_access table exists for per-friend access control
CREATE TABLE IF NOT EXISTS public.friend_page_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  friend_id UUID NOT NULL,
  page_share_code TEXT NOT NULL,
  scenario_id UUID REFERENCES public.step_scenarios(id),
  step_id UUID REFERENCES public.steps(id),
  access_enabled BOOLEAN NOT NULL DEFAULT true,
  access_source TEXT DEFAULT 'manual',
  first_access_at TIMESTAMP WITH TIME ZONE,
  timer_start_at TIMESTAMP WITH TIME ZONE,
  timer_end_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(friend_id, page_share_code)
);

-- Add RLS policies for friend_page_access if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'friend_page_access' 
    AND policyname = 'users_can_view_own_friend_access'
  ) THEN
    CREATE POLICY "users_can_view_own_friend_access" 
    ON public.friend_page_access 
    FOR SELECT 
    USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'friend_page_access' 
    AND policyname = 'users_can_create_own_friend_access'
  ) THEN
    CREATE POLICY "users_can_create_own_friend_access" 
    ON public.friend_page_access 
    FOR INSERT 
    WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'friend_page_access' 
    AND policyname = 'users_can_update_own_friend_access'
  ) THEN
    CREATE POLICY "users_can_update_own_friend_access" 
    ON public.friend_page_access 
    FOR UPDATE 
    USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'friend_page_access' 
    AND policyname = 'users_can_delete_own_friend_access'
  ) THEN
    CREATE POLICY "users_can_delete_own_friend_access" 
    ON public.friend_page_access 
    FOR DELETE 
    USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'friend_page_access' 
    AND policyname = 'system_can_manage_friend_access'
  ) THEN
    CREATE POLICY "system_can_manage_friend_access" 
    ON public.friend_page_access 
    FOR ALL 
    USING ((auth.jwt() ->> 'role') = 'service_role');
  END IF;
END $$;

-- Enable RLS on friend_page_access
ALTER TABLE public.friend_page_access ENABLE ROW LEVEL SECURITY;