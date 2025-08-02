-- Add LIFF URL column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN liff_url TEXT;