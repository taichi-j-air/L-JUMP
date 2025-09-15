-- Add media support columns to chat_messages
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS media_kind text, -- image | video | file | sticker
  ADD COLUMN IF NOT EXISTS content_type text,
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS thumbnail_url text,
  ADD COLUMN IF NOT EXISTS file_name text,
  ADD COLUMN IF NOT EXISTS file_size integer,
  ADD COLUMN IF NOT EXISTS sticker_id text,
  ADD COLUMN IF NOT EXISTS sticker_package_id text;

-- Ensure realtime works reliably
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;
DO $$ BEGIN
  -- Add to realtime publication if not already
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'chat_messages'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages';
  END IF;
END $$;

-- Create a public storage bucket for chat media
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-media', 'chat-media', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read for chat-media objects
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public read for chat-media'
  ) THEN
    CREATE POLICY "Public read for chat-media"
    ON storage.objects
    FOR SELECT
    USING (bucket_id = 'chat-media');
  END IF;
END $$;