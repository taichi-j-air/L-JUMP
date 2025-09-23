-- Create member_site_categories table
CREATE TABLE public.member_site_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  content_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add category_id to member_site_content table
ALTER TABLE public.member_site_content 
ADD COLUMN category_id UUID REFERENCES public.member_site_categories(id) ON DELETE SET NULL;

-- Enable RLS on member_site_categories
ALTER TABLE public.member_site_categories ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for member_site_categories
CREATE POLICY "Users can view categories of their own sites" 
ON public.member_site_categories 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM member_sites ms 
  WHERE ms.id = member_site_categories.site_id 
  AND ms.user_id = auth.uid()
));

CREATE POLICY "Users can create categories for their own sites" 
ON public.member_site_categories 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM member_sites ms 
  WHERE ms.id = member_site_categories.site_id 
  AND ms.user_id = auth.uid()
));

CREATE POLICY "Users can update categories of their own sites" 
ON public.member_site_categories 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM member_sites ms 
  WHERE ms.id = member_site_categories.site_id 
  AND ms.user_id = auth.uid()
));

CREATE POLICY "Users can delete categories of their own sites" 
ON public.member_site_categories 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM member_sites ms 
  WHERE ms.id = member_site_categories.site_id 
  AND ms.user_id = auth.uid()
));

-- Create function to update category content count
CREATE OR REPLACE FUNCTION public.update_category_content_count()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for content count updates
CREATE TRIGGER update_category_content_count_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.member_site_content
  FOR EACH ROW EXECUTE FUNCTION public.update_category_content_count();