-- Add RLS policies for public access to published member sites
CREATE POLICY "Public can view published member sites" 
ON public.member_sites 
FOR SELECT 
USING (is_published = true);

CREATE POLICY "Public can view categories of published sites" 
ON public.member_site_categories 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.member_sites ms 
  WHERE ms.id = member_site_categories.site_id 
  AND ms.is_published = true
));

CREATE POLICY "Public can view content of published sites" 
ON public.member_site_content 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.member_sites ms 
  WHERE ms.id = member_site_content.site_id 
  AND ms.is_published = true
));