DO $$ 
BEGIN
  ALTER TABLE public.chat_messages 
    ADD COLUMN metadata jsonb;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS chat_messages_metadata_idx 
  ON public.chat_messages 
  USING gin (metadata);
