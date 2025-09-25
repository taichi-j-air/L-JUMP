-- Add tag and passcode access control fields to member_sites
ALTER TABLE public.member_sites 
ADD COLUMN allowed_tag_ids uuid[] DEFAULT ARRAY[]::uuid[],
ADD COLUMN blocked_tag_ids uuid[] DEFAULT ARRAY[]::uuid[],
ADD COLUMN passcode text DEFAULT NULL;