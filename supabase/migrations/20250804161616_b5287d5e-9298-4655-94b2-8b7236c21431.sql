-- Check for any remaining SECURITY DEFINER views in the system
SELECT 
    n.nspname as schema_name,
    c.relname as view_name,
    'VIEW' as object_type
FROM pg_class c
JOIN pg_namespace n ON c.relnamespace = n.oid
JOIN pg_rewrite r ON r.ev_class = c.oid
JOIN pg_proc p ON r.ev_action::text LIKE '%' || p.proname || '%'
WHERE c.relkind = 'v'  -- views only
AND n.nspname = 'public'
AND p.prosecdef = true

UNION

-- Check for materialized views with security definer
SELECT 
    schemaname as schema_name,
    matviewname as view_name,
    'MATERIALIZED VIEW' as object_type
FROM pg_matviews
WHERE schemaname = 'public';

-- Also specifically look for the problematic view/function
SELECT 
    viewname,
    definition
FROM pg_views 
WHERE viewname LIKE '%scenario_invite%'
AND schemaname = 'public';