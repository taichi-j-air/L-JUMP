-- Fix member site URL generation and update existing URLs
-- Update the trigger function to generate correct public URLs
CREATE OR REPLACE FUNCTION public.set_member_site_uid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- Generate UID if not provided
    IF NEW.site_uid IS NULL OR NEW.site_uid = '' THEN
        NEW.site_uid := public.generate_member_site_uid();
    END IF;
    
    -- Generate public URL when published
    IF NEW.is_published = true AND OLD.is_published IS DISTINCT FROM NEW.is_published THEN
        NEW.public_url := 'https://rtjxurmuaawyzjcdkqxt.supabase.co/functions/v1/member-site-view?slug=' || NEW.slug || '&uid=' || NEW.site_uid;
        NEW.published_at := now();
    END IF;
    
    RETURN NEW;
END;
$$;

-- Update existing published sites with correct URLs
UPDATE public.member_sites 
SET public_url = 'https://rtjxurmuaawyzjcdkqxt.supabase.co/functions/v1/member-site-view?slug=' || slug || '&uid=' || site_uid
WHERE is_published = true AND site_uid IS NOT NULL;