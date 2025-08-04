-- Check what views exist that might be causing the SECURITY DEFINER issue
SELECT schemaname, viewname, definition 
FROM pg_views 
WHERE schemaname = 'public' 
AND viewname = 'scenario_invite_stats';

-- Also check for any security definer functions that might be the issue
SELECT n.nspname as schema_name,
       p.proname as function_name,
       case when p.prosecdef then 'SECURITY DEFINER' else 'SECURITY INVOKER' end as security_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.prosecdef = true;