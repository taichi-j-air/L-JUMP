-- Add user_suspended column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN user_suspended boolean NOT NULL DEFAULT false;