-- 重複トリガーの解消とlog_security_event関数の作成
-- 古いトリガーを削除して新しいものだけ残す

DROP TRIGGER IF EXISTS form_scenario_transition_trigger ON public.form_submissions;
DROP TRIGGER IF EXISTS trg_resolve_friend_on_insert ON public.form_submissions;

-- log_security_event関数が存在するかチェックして、存在しない場合は作成
CREATE OR REPLACE FUNCTION public.log_security_event(
  p_user_id uuid DEFAULT auth.uid(), 
  p_action text DEFAULT ''::text, 
  p_details jsonb DEFAULT '{}'::jsonb, 
  p_ip_address text DEFAULT ''::text, 
  p_user_agent text DEFAULT ''::text, 
  p_success boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  INSERT INTO public.security_audit_log (
    user_id, action, details, ip_address, user_agent, success
  ) VALUES (
    p_user_id, p_action, p_details, p_ip_address, p_user_agent, p_success
  );
EXCEPTION
  WHEN OTHERS THEN
    -- Don't fail the main operation if logging fails
    NULL;
END;
$$;