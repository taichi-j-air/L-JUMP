-- 1) 現状確認：既存ポリシーの一覧
-- select polname, cmd, roles, qual, with_check
-- from pg_policies
-- where schemaname='public' and tablename='form_submissions';

-- 2) RLSの設定（INSERT許可 + 所有者表示用SELECT）

-- RLSを有効化（既に有効の場合はスキップ）
ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;

-- 競合を避けるため既存の類似ポリシーを削除
DROP POLICY IF EXISTS insert_public_submissions ON public.form_submissions;
DROP POLICY IF EXISTS owner_selects_submissions ON public.form_submissions;
DROP POLICY IF EXISTS public_can_insert_submissions ON public.form_submissions;
DROP POLICY IF EXISTS owner_can_view_submissions ON public.form_submissions;

-- INSERTポリシー：anon / authenticated を許可
CREATE POLICY insert_public_submissions
ON public.form_submissions
FOR INSERT
TO anon, authenticated
WITH CHECK (
  -- 提出の user_id が対象フォームの所有者と一致
  EXISTS (
    SELECT 1 FROM public.forms f
    WHERE f.id = form_submissions.form_id
      AND f.user_id = form_submissions.user_id
  )
  AND (
    -- 公開フォームならそのままOK
    EXISTS (
      SELECT 1 FROM public.forms f
      WHERE f.id = form_submissions.form_id
        AND COALESCE(f.require_line_friend, false) = false
    )
    -- 友だち限定フォームなら friend_id が所有者配下で一致
    OR EXISTS (
      SELECT 1
      FROM public.forms f
      JOIN public.line_friends lf ON lf.user_id = f.user_id
      WHERE f.id = form_submissions.form_id
        AND form_submissions.friend_id IS NOT NULL
        AND lf.id = form_submissions.friend_id
    )
  )
);

-- SELECTポリシー：所有者は提出を閲覧可（ダッシュボード表示用）
CREATE POLICY owner_selects_submissions
ON public.form_submissions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.forms f
    WHERE f.id = form_submissions.form_id
      AND f.user_id = auth.uid()
  )
);

-- 3) 既存データの復旧（匿名を所有者に紐づけ）
UPDATE public.form_submissions fs
SET user_id = f.user_id
FROM public.forms f
WHERE fs.form_id = f.id
  AND fs.user_id IS NULL;

-- 4) 将来の取りこぼし防止（任意：推奨）
CREATE OR REPLACE FUNCTION public.set_submission_owner()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    SELECT user_id INTO NEW.user_id FROM public.forms WHERE id = NEW.form_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_set_submission_owner ON public.form_submissions;
CREATE TRIGGER trg_set_submission_owner
BEFORE INSERT ON public.form_submissions
FOR EACH ROW EXECUTE FUNCTION public.set_submission_owner();