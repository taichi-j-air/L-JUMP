-- Add read_at column to chat_messages table if it doesn't exist
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITH TIME ZONE;