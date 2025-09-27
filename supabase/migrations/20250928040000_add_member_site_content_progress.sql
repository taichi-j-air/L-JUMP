-- Create table to track member site content completion per friend
CREATE TABLE public.member_site_content_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id UUID NOT NULL REFERENCES public.member_sites(id) ON DELETE CASCADE,
  content_id UUID NOT NULL REFERENCES public.member_site_content(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES public.line_friends(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT ''incomplete'',
  progress_percentage INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT member_site_content_progress_unique UNIQUE (content_id, friend_id)
);

-- Enable Row Level Security
ALTER TABLE public.member_site_content_progress ENABLE ROW LEVEL SECURITY;

-- Basic policies for site owners (service role calls bypass RLS but keep policies for completeness)
CREATE POLICY "Site owners can view progress" ON public.member_site_content_progress
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.member_sites ms
    WHERE ms.id = member_site_content_progress.site_id
      AND ms.user_id = auth.uid()
  )
);

CREATE POLICY "Site owners can manage progress" ON public.member_site_content_progress
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.member_sites ms
    WHERE ms.id = member_site_content_progress.site_id
      AND ms.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.member_sites ms
    WHERE ms.id = member_site_content_progress.site_id
      AND ms.user_id = auth.uid()
  )
);

-- Maintain updated_at automatically
CREATE TRIGGER update_member_site_content_progress_updated_at
  BEFORE UPDATE ON public.member_site_content_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Helpful indexes
CREATE INDEX member_site_content_progress_friend_idx ON public.member_site_content_progress(friend_id);
CREATE INDEX member_site_content_progress_content_idx ON public.member_site_content_progress(content_id);
CREATE INDEX member_site_content_progress_site_idx ON public.member_site_content_progress(site_id);
