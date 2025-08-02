-- まず、残りの関数のsearch_pathを修正
CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN encode(gen_random_bytes(8), 'hex');
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  webhook_base_url text := 'https://rtjxurmuaawyzjcdkqxt.supabase.co/functions/v1/line-webhook';
BEGIN
  INSERT INTO public.profiles (user_id, display_name, webhook_url, line_api_status, user_role)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', 'ユーザー'),
    webhook_base_url,
    'not_configured',
    'user'
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.reset_monthly_quota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 月が変わった場合にカウンターリセット
  IF NEW.current_month != EXTRACT(MONTH FROM now()) 
     OR NEW.current_year != EXTRACT(YEAR FROM now()) THEN
    NEW.monthly_message_used = 0;
    NEW.current_month = EXTRACT(MONTH FROM now());
    NEW.current_year = EXTRACT(YEAR FROM now());
  END IF;
  RETURN NEW;
END;
$$;

-- SECURITY DEFINER viewを確認して削除
-- scenario_invite_statsビューをSECURITY DEFINERではないものに変更
DROP VIEW IF EXISTS public.scenario_invite_stats;

CREATE VIEW public.scenario_invite_stats AS
SELECT 
    sic.invite_code,
    sic.scenario_id,
    COALESCE(COUNT(DISTINCT ic.id), 0) as clicks,
    COALESCE(COUNT(DISTINCT sfl.id), 0) as friends,
    COALESCE(COUNT(DISTINCT sfl.id), 0) as total_added
FROM scenario_invite_codes sic
LEFT JOIN invite_clicks ic ON ic.invite_code = sic.invite_code
LEFT JOIN scenario_friend_logs sfl ON sfl.invite_code = sic.invite_code
GROUP BY sic.invite_code, sic.scenario_id;