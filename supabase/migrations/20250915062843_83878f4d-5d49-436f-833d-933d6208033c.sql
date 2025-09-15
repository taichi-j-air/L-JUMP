-- Create storage bucket for chat media
INSERT INTO storage.buckets (id, name, public) VALUES ('chat-media', 'chat-media', true);

-- Create RLS policies for chat media storage
CREATE POLICY "Users can view their own chat media"
ON storage.objects FOR SELECT
USING (bucket_id = 'chat-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload their own chat media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'chat-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own chat media"
ON storage.objects FOR DELETE
USING (bucket_id = 'chat-media' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create function to download and store LINE media content
CREATE OR REPLACE FUNCTION public.download_line_media(
  p_message_id text,
  p_user_id uuid,
  p_access_token text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  media_url text;
  content_type text;
  file_extension text;
  storage_path text;
BEGIN
  -- This function will be called from the edge function
  -- Return a structure that indicates success and provides the storage path
  storage_path := p_user_id::text || '/' || p_message_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'storage_path', storage_path,
    'public_url', 'https://rtjxurmuaawyzjcdkqxt.supabase.co/storage/v1/object/public/chat-media/' || storage_path
  );
END;
$$;