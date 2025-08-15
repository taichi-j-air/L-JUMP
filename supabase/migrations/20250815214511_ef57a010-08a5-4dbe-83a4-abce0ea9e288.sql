-- search_path未設定の関数を修正（セキュリティ警告解決）

CREATE OR REPLACE FUNCTION public.update_success_templates_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;