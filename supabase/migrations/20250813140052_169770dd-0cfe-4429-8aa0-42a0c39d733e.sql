-- Update short UID generation to use alphanumeric characters
CREATE OR REPLACE FUNCTION public.generate_short_uid()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    result text;
    chars text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    i integer;
BEGIN
    -- 6文字のランダム文字列を生成
    result := '';
    FOR i IN 1..6 LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;
    
    -- 重複チェック（万が一の場合）
    WHILE EXISTS (SELECT 1 FROM public.line_friends WHERE short_uid = result) LOOP
        result := '';
        FOR i IN 1..6 LOOP
            result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
        END LOOP;
    END LOOP;
    
    RETURN result;
END;
$function$