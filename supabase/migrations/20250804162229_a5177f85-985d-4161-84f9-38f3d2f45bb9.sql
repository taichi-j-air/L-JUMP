-- 現在のシステムでSECURITY DEFINERビューを検索
SELECT 
    schemaname,
    viewname,
    definition
FROM pg_views 
WHERE schemaname = 'public'
AND viewname LIKE '%scenario_invite%'
ORDER BY viewname;

-- pg_class から直接SECURITY DEFINERビューを探す
SELECT 
    n.nspname as schema_name,
    c.relname as view_name,
    pg_get_viewdef(c.oid) as definition
FROM pg_class c
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE c.relkind = 'v'  -- ビューのみ
AND n.nspname = 'public'
AND c.relname LIKE '%scenario_invite%';

-- すべてのビューの詳細情報
SELECT 
    viewname,
    viewowner,
    definition
FROM pg_views 
WHERE schemaname = 'public'
ORDER BY viewname;