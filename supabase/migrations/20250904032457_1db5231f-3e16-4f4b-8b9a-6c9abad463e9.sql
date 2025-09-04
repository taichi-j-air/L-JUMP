-- Fix conflicting RLS policies on profiles table for security
-- Remove the redundant "Limited public profile access" policy that has unclear logic
DROP POLICY IF EXISTS "Limited public profile access" ON public.profiles;

-- Keep the clear and secure policies that ensure users can only access their own data
-- The existing policies are already secure:
-- 1. "ユーザーは自分のプロファイルのみ参照可能" - SELECT: auth.uid() = user_id
-- 2. "ユーザーは自分のプロファイルを作成可能" - INSERT: auth.uid() = user_id  
-- 3. "ユーザーは自分のプロファイルを削除可能" - DELETE: auth.uid() = user_id
-- 4. "ユーザーは自分のプロファイルを更新可能" - UPDATE: auth.uid() = user_id

-- Add a comment to document the security model
COMMENT ON TABLE public.profiles IS 'User profile data with RLS ensuring users can only access their own profile information. Contains sensitive PII that must be protected.';