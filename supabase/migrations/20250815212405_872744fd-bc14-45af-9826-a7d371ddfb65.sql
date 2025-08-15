-- 公開フォーム送信の認証問題を完全に修正

-- 1. 公開フォーム用のRLSポリシーを認証なしでも送信可能に修正
DROP POLICY IF EXISTS "insert_public_submissions" ON public.form_submissions;

CREATE POLICY "insert_public_submissions" 
ON public.form_submissions 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM forms f 
    WHERE f.id = form_submissions.form_id 
      AND f.is_public = true
      AND (
        -- 認証済みユーザーの場合：フォーム所有者またはフォーム所有者IDと一致
        (auth.uid() IS NOT NULL AND (auth.uid() = f.user_id OR form_submissions.user_id = f.user_id))
        OR
        -- 未認証ユーザーの場合：フォーム所有者IDと一致すればOK
        (auth.uid() IS NULL AND form_submissions.user_id = f.user_id)
      )
  )
);

-- 2. 友だち限定フォーム用の別ポリシーを追加
CREATE POLICY "insert_friend_submissions" 
ON public.form_submissions 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM forms f 
    WHERE f.id = form_submissions.form_id 
      AND f.is_public = true
      AND f.require_line_friend = true
      AND form_submissions.user_id = f.user_id
      AND (form_submissions.friend_id IS NOT NULL OR form_submissions.line_user_id IS NOT NULL)
  )
);