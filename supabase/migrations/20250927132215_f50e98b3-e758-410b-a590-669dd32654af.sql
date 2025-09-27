-- member_site_categories テーブルにタグ設定カラムを追加
ALTER TABLE public.member_site_categories
ADD COLUMN allowed_tag_ids text[] DEFAULT '{}'::text[],
ADD COLUMN blocked_tag_ids text[] DEFAULT '{}'::text[];

-- member_site_content テーブルにタグ設定カラムを追加
ALTER TABLE public.member_site_content
ADD COLUMN allowed_tag_ids text[] DEFAULT '{}'::text[],
ADD COLUMN blocked_tag_ids text[] DEFAULT '{}'::text[];