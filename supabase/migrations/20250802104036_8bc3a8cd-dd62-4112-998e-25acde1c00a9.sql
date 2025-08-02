-- LINE Bot IDからadd_friend_urlを自動生成する関数を更新
CREATE OR REPLACE FUNCTION public.update_add_friend_url()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  -- LINE Bot IDが設定されている場合、友達追加URLを自動生成
  IF NEW.line_bot_id IS NOT NULL AND NEW.line_bot_id != '' THEN
    -- @マークを除去してlin.ee URLを生成
    NEW.add_friend_url = 'https://lin.ee/' || REPLACE(NEW.line_bot_id, '@', '');
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'add friend URL update failed: %', SQLERRM;
END;
$$;

-- 既存のline_bot_idからadd_friend_urlを更新
UPDATE profiles 
SET add_friend_url = 'https://lin.ee/' || REPLACE(line_bot_id, '@', '')
WHERE line_bot_id IS NOT NULL 
  AND line_bot_id != '' 
  AND user_id = 'c986e437-a760-4885-ae25-dd8ae3038516';