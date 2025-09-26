-- Add require_passcode column to member_sites table
ALTER TABLE public.member_sites 
ADD COLUMN require_passcode boolean NOT NULL DEFAULT false;