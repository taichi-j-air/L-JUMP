-- 公開フォームのメタ＋LIFF取得（profilesの直接SELECTはしない）
CREATE OR REPLACE FUNCTION public.get_public_form_meta(p_form_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  fields jsonb,
  success_message text,
  is_public boolean,
  user_id uuid,
  require_line_friend boolean,
  prevent_duplicate_per_friend boolean,
  post_submit_scenario_id uuid,
  submit_button_text text,
  submit_button_variant text,
  submit_button_bg_color text,
  submit_button_text_color text,
  accent_color text,
  liff_id text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    f.id,
    f.name,
    f.description,
    f.fields,
    f.success_message,
    f.is_public,
    f.user_id,
    f.require_line_friend,
    f.prevent_duplicate_per_friend,
    f.post_submit_scenario_id,
    f.submit_button_text,
    f.submit_button_variant,
    f.submit_button_bg_color,
    f.submit_button_text_color,
    f.accent_color,
    p.liff_id
  FROM public.forms f
  JOIN public.profiles p ON p.user_id = f.user_id
  WHERE f.id = p_form_id
    AND f.is_public = true;
$$;

-- 既存の挿入ポリシーを全て掃除
DROP POLICY IF EXISTS "insert_public_submissions" ON public.form_submissions;
DROP POLICY IF EXISTS "insert_friend_submissions" ON public.form_submissions;
DROP POLICY IF EXISTS "public_insert_form_submissions" ON public.form_submissions;

-- 公開フォームへの匿名/認証問わずのINSERT許可（友だち限定条件も内包）
CREATE POLICY "unified_insert_form_submissions"
ON public.form_submissions
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.forms f
    WHERE f.id = form_submissions.form_id
      AND f.is_public = true
      AND form_submissions.user_id = f.user_id
      AND (
        -- 友だち限定の場合は friend_id or line_user_id が必要
        f.require_line_friend = false
        OR form_submissions.friend_id IS NOT NULL
        OR form_submissions.line_user_id IS NOT NULL
      )
  )
);

-- 公開フォームは誰でも読める
DROP POLICY IF EXISTS "public_read_forms" ON public.forms;
DROP POLICY IF EXISTS "public_can_view_public_forms" ON public.forms;
CREATE POLICY "unified_public_read_forms"
ON public.forms
FOR SELECT
USING (is_public = true);