-- セキュリティ修正：search_pathの設定
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

CREATE OR REPLACE FUNCTION public.reset_monthly_quota()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';