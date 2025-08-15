-- 友だち限定フォーム安全化：広いanonポリシー削除
-- 理由：INSERT一発方式＋トリガー解決でフロントからの直接SELECT不要

-- 既存の広いanonポリシーを削除
DROP POLICY IF EXISTS "allow_anonymous_uid_lookup" ON public.line_friends;

-- Optional: 将来的な友だち検索用RPC（必要時に使用）
CREATE OR REPLACE FUNCTION public.lookup_friend_by_uid(
  p_form_id uuid,
  p_uid text
)
RETURNS TABLE(friend_id uuid, line_user_id text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  -- 正規化とセキュリティチェック
  IF p_uid IS NULL OR length(trim(p_uid)) = 0 THEN
    RETURN;
  END IF;
  
  p_uid := upper(trim(p_uid));
  
  RETURN QUERY
  SELECT lf.id, lf.line_user_id
  FROM public.forms f
  JOIN public.line_friends lf ON lf.user_id = f.user_id 
    AND lf.short_uid_ci = p_uid
  WHERE f.id = p_form_id
    AND f.is_public = true
  LIMIT 1;
END;
$$;