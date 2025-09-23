-- Update existing member sites to generate public_url for published sites
UPDATE public.member_sites 
SET public_url = 'https://rtjxurmuaawyzjcdkqxt.supabase.co/functions/v1/member-site-view/' || slug || '?uid=' || site_uid
WHERE is_published = true AND public_url IS NULL AND site_uid IS NOT NULL;

-- Insert test content for existing member sites
INSERT INTO public.member_site_content (site_id, title, slug, content, content_blocks, is_published, sort_order, access_level, page_type)
SELECT 
  ms.id,
  'ウェルカムページ',
  'welcome',
  'このサイトへようこそ！会員限定のコンテンツをお楽しみください。',
  jsonb_build_array(
    jsonb_build_object(
      'id', gen_random_uuid()::text,
      'type', 'heading',
      'content', jsonb_build_object('text', 'ウェルカムページ', 'level', 1)
    ),
    jsonb_build_object(
      'id', gen_random_uuid()::text,
      'type', 'paragraph', 
      'content', jsonb_build_object('text', 'このサイトへようこそ！会員限定のコンテンツをお楽しみください。')
    ),
    jsonb_build_object(
      'id', gen_random_uuid()::text,
      'type', 'paragraph',
      'content', jsonb_build_object('text', 'ここに会員向けの価値あるコンテンツを配信していきます。')
    )
  ),
  true,
  0,
  'member',
  'page'
FROM public.member_sites ms
WHERE NOT EXISTS (
  SELECT 1 FROM public.member_site_content msc 
  WHERE msc.site_id = ms.id
)
ON CONFLICT DO NOTHING;