-- Remove legacy overloaded functions to eliminate ambiguity in PostgREST
-- Keep ONLY the 6-argument version: (text, text, text, text, text, uuid)

DO $$ BEGIN
  -- Drop 4-argument version if it exists
  EXECUTE 'DROP FUNCTION IF EXISTS public.register_friend_to_scenario(text, text, text, text)';
  
  -- Drop 5-argument version if it exists
  EXECUTE 'DROP FUNCTION IF EXISTS public.register_friend_to_scenario(text, text, text, text, text)';
END $$;