-- Add new columns to profiles table for enhanced onboarding
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS first_name_kana text,
ADD COLUMN IF NOT EXISTS last_name_kana text,
ADD COLUMN IF NOT EXISTS birth_date date,
ADD COLUMN IF NOT EXISTS is_business boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS has_line_business boolean;