-- Fix security issue: Update function with proper search path
CREATE OR REPLACE FUNCTION public.update_category_content_count()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  -- Update content count for old category
  IF OLD.category_id IS NOT NULL THEN
    UPDATE public.member_site_categories 
    SET content_count = (
      SELECT COUNT(*) FROM public.member_site_content 
      WHERE category_id = OLD.category_id
    )
    WHERE id = OLD.category_id;
  END IF;
  
  -- Update content count for new category
  IF NEW.category_id IS NOT NULL THEN
    UPDATE public.member_site_categories 
    SET content_count = (
      SELECT COUNT(*) FROM public.member_site_content 
      WHERE category_id = NEW.category_id
    )
    WHERE id = NEW.category_id;
  END IF;
  
  RETURN NEW;
END;
$$;