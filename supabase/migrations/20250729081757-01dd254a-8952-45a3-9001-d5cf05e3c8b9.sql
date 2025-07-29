-- Add Channel ID and LINE ID columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN line_channel_id text,
ADD COLUMN line_bot_id text;