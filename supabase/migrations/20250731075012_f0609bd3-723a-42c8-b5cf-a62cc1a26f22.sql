-- Delete test users from line_friends table
DELETE FROM public.line_friends 
WHERE line_user_id LIKE 'test_user_%';