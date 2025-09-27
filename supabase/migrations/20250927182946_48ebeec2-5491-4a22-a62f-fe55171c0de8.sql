-- Create member_site_content_progress table for tracking learning progress
CREATE TABLE public.member_site_content_progress (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id uuid NOT NULL,
    content_id uuid NOT NULL,
    friend_id uuid NOT NULL,
    status text NOT NULL DEFAULT 'incomplete',
    progress_percentage integer NOT NULL DEFAULT 0,
    completed_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    
    -- Ensure one progress record per friend per content
    UNIQUE(content_id, friend_id)
);

-- Enable RLS
ALTER TABLE public.member_site_content_progress ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view progress of their own sites" 
ON public.member_site_content_progress 
FOR SELECT 
USING (EXISTS (
    SELECT 1 FROM public.member_sites ms 
    WHERE ms.id = member_site_content_progress.site_id 
    AND ms.user_id = auth.uid()
));

CREATE POLICY "Users can create progress for their own sites" 
ON public.member_site_content_progress 
FOR INSERT 
WITH CHECK (EXISTS (
    SELECT 1 FROM public.member_sites ms 
    WHERE ms.id = member_site_content_progress.site_id 
    AND ms.user_id = auth.uid()
));

CREATE POLICY "Users can update progress of their own sites" 
ON public.member_site_content_progress 
FOR UPDATE 
USING (EXISTS (
    SELECT 1 FROM public.member_sites ms 
    WHERE ms.id = member_site_content_progress.site_id 
    AND ms.user_id = auth.uid()
));

CREATE POLICY "Service role can manage all progress" 
ON public.member_site_content_progress 
FOR ALL 
USING ((auth.jwt() ->> 'role'::text) = 'service_role'::text);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_member_site_content_progress_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE TRIGGER update_member_site_content_progress_updated_at
  BEFORE UPDATE ON public.member_site_content_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.update_member_site_content_progress_updated_at();