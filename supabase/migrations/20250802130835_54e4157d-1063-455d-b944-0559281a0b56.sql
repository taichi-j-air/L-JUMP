-- Add LIFF ID column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN liff_id TEXT;