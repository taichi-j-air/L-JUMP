-- Create storage bucket for files (images, videos, documents)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES (
  'media-files', 
  'media-files', 
  true, 
  52428800, -- 50MB limit
  ARRAY['image/*', 'video/*', 'application/pdf', 'application/json']
);

-- Create policy to allow authenticated users to upload files
CREATE POLICY "Users can upload their own files" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'media-files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create policy to allow anyone to view public files
CREATE POLICY "Anyone can view files" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'media-files');

-- Create policy to allow users to update their own files
CREATE POLICY "Users can update their own files" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'media-files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create policy to allow users to delete their own files
CREATE POLICY "Users can delete their own files" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'media-files' AND auth.uid()::text = (storage.foldername(name))[1]);