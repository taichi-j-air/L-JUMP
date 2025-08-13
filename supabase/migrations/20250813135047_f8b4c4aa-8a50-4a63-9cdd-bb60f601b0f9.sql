-- line_friendsテーブルに短縮UIDカラムを追加
ALTER TABLE public.line_friends 
ADD COLUMN short_uid text UNIQUE;

-- 短縮UID生成関数
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
$function$;

-- 既存の友達レコードに短縮UIDを付与
UPDATE public.line_friends 
SET short_uid = public.generate_short_uid()
WHERE short_uid IS NULL;

-- 新規友達登録時に短縮UIDを自動生成するトリガー関数
CREATE OR REPLACE FUNCTION public.set_short_uid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
    IF NEW.short_uid IS NULL THEN
        NEW.short_uid := public.generate_short_uid();
    END IF;
    RETURN NEW;
END;
$function$;

-- トリガーを作成
CREATE TRIGGER trigger_set_short_uid
    BEFORE INSERT ON public.line_friends
    FOR EACH ROW
    EXECUTE FUNCTION public.set_short_uid();