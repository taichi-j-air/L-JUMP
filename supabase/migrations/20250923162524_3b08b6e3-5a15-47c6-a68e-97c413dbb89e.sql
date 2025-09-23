-- Add UID and public URL fields to member_sites table
ALTER TABLE public.member_sites 
ADD COLUMN site_uid text UNIQUE DEFAULT replace(encode(gen_random_bytes(8), 'hex'), '-', ''),
ADD COLUMN public_url text,
ADD COLUMN published_at timestamp with time zone;

-- Create index for fast UID lookups
CREATE INDEX idx_member_sites_site_uid ON public.member_sites(site_uid);

-- Create function to generate member site UID
CREATE OR REPLACE FUNCTION public.generate_member_site_uid()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    result text;
BEGIN
    -- Generate 12-character URL-safe UID
    SELECT encode(gen_random_bytes(9), 'base64')
    INTO result;
    
    -- Remove URL-unsafe characters
    result := translate(result, '+/=', 'xyz');
    result := substring(result, 1, 12);
    
    -- Ensure uniqueness
    WHILE EXISTS (SELECT 1 FROM public.member_sites WHERE site_uid = result) LOOP
        SELECT encode(gen_random_bytes(9), 'base64')
        INTO result;
        result := translate(result, '+/=', 'xyz');
        result := substring(result, 1, 12);
    END LOOP;
    
    RETURN result;
END;
$$;

-- Trigger to auto-generate UID and public URL
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
        NEW.public_url := 'https://rtjxurmuaawyzjcdkqxt.supabase.co/functions/v1/member-site-view/' || NEW.slug || '?uid=' || NEW.site_uid;
        NEW.published_at := now();
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create trigger
CREATE TRIGGER trigger_set_member_site_uid
    BEFORE INSERT OR UPDATE ON public.member_sites
    FOR EACH ROW
    EXECUTE FUNCTION public.set_member_site_uid();

-- Update existing sites with UIDs
UPDATE public.member_sites 
SET site_uid = public.generate_member_site_uid() 
WHERE site_uid IS NULL;