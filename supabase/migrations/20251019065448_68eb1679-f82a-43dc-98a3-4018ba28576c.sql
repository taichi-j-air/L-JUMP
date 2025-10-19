-- Add RLS policy to allow Service Role to insert chat message history
-- This enables Edge Functions to save Flex message and step delivery history
CREATE POLICY "service_role_can_insert_chat_messages"
ON public.chat_messages
FOR INSERT
TO service_role
WITH CHECK (true);

-- Add comment for documentation
COMMENT ON POLICY "service_role_can_insert_chat_messages" ON public.chat_messages 
IS 'Allows Edge Functions (running as service_role) to insert chat message history for flex messages and step deliveries';