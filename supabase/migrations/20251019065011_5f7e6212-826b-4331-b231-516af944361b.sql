-- Add metadata column to chat_messages table for tracking message sources
ALTER TABLE public.chat_messages 
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT NULL;

-- Add index for efficient filtering by message source
CREATE INDEX IF NOT EXISTS idx_chat_messages_metadata_source 
ON public.chat_messages ((metadata->>'source'));

-- Add comment for documentation
COMMENT ON COLUMN public.chat_messages.metadata IS 'Stores additional metadata including message source (flex_message_designer, step_delivery, etc.)';