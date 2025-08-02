-- LINE公式アカウントの友達追加URLを自動生成・更新する関数を作成
CREATE OR REPLACE FUNCTION public.update_add_friend_url()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- LINE Bot IDが設定されている場合、友達追加URLを自動生成
  IF NEW.line_bot_id IS NOT NULL AND NEW.line_bot_id != '' THEN
    NEW.add_friend_url = 'https://line.me/R/ti/p/' || NEW.line_bot_id;
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'add friend URL update failed: %', SQLERRM;
END;
$$;

-- トリガーを作成（INSERT・UPDATE時に自動実行）
DROP TRIGGER IF EXISTS update_add_friend_url_trigger ON public.profiles;
CREATE TRIGGER update_add_friend_url_trigger
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_add_friend_url();

-- 既存データの友達追加URLを更新
UPDATE public.profiles 
SET add_friend_url = 'https://line.me/R/ti/p/' || line_bot_id
WHERE line_bot_id IS NOT NULL 
  AND line_bot_id != '' 
  AND (add_friend_url IS NULL OR add_friend_url = '');