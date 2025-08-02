-- profiles.user_idの重複チェック
WITH dups AS (
  SELECT user_id, COUNT(*) AS cnt
  FROM public.profiles
  GROUP BY user_id
  HAVING COUNT(*) > 1
)
SELECT user_id, cnt FROM dups;