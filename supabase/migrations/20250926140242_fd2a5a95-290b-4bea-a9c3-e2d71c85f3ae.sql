-- Fix incorrect public_url for member site
UPDATE member_sites 
SET public_url = 'https://rtjxurmuaawyzjcdkqxt.supabase.co/functions/v1/member-site-view?slug=' || slug || '&uid=' || site_uid
WHERE slug = 'site-17586';