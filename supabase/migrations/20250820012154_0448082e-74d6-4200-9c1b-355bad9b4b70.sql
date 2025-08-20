-- Fix security warning: Add search_path to the newly created RPC function
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
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  RETURN QUERY
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
  LEFT JOIN public.profiles p ON p.user_id = f.user_id
  WHERE f.id = p_form_id
    AND f.is_public = true;
END;
$$;