-- Create onboarding videos table for video management
CREATE TABLE public.onboarding_videos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  video_type TEXT NOT NULL, -- 'step4_video', 'channel_id', 'channel_secret', 'line_bot_id', 'channel_access_token'
  video_url TEXT NOT NULL,
  video_duration INTEGER, -- in seconds
  completion_percentage INTEGER DEFAULT 100, -- percentage required to unlock next step
  show_timer BOOLEAN DEFAULT true,
  custom_text TEXT, -- text to display below video
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.onboarding_videos ENABLE ROW LEVEL SECURITY;

-- Only developers can manage videos
CREATE POLICY "Developers can manage onboarding videos" 
ON public.onboarding_videos 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND user_role = 'developer'
  )
);

-- Everyone can view videos
CREATE POLICY "Everyone can view onboarding videos" 
ON public.onboarding_videos 
FOR SELECT 
USING (true);

-- Create video watch progress tracking table
CREATE TABLE public.video_watch_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_type TEXT NOT NULL,
  watch_time INTEGER DEFAULT 0, -- seconds watched
  completion_percentage REAL DEFAULT 0,
  is_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, video_type)
);

-- Enable RLS
ALTER TABLE public.video_watch_progress ENABLE ROW LEVEL SECURITY;

-- Users can only access their own progress
CREATE POLICY "Users can manage their own video progress" 
ON public.video_watch_progress 
FOR ALL 
USING (auth.uid() = user_id);

-- Insert default videos
INSERT INTO public.onboarding_videos (video_type, video_url, video_duration, completion_percentage, show_timer, custom_text) VALUES
('step4_video', 'https://www.youtube.com/embed/dQw4w9WgXcQ', 212, 100, true, 'この動画は必ず視聴してください'),
('channel_id', 'https://www.youtube.com/embed/dQw4w9WgXcQ', 180, 100, false, 'チャネルIDの取得方法を説明します'),
('channel_secret', 'https://www.youtube.com/embed/dQw4w9WgXcQ', 150, 100, false, 'チャネルシークレットの取得方法を説明します'),
('line_bot_id', 'https://www.youtube.com/embed/dQw4w9WgXcQ', 120, 100, false, 'LINEボットIDの取得方法を説明します'),
('channel_access_token', 'https://www.youtube.com/embed/dQw4w9WgXcQ', 200, 100, false, 'チャネルアクセストークンの取得方法を説明します');

-- Create trigger for updated_at
CREATE TRIGGER update_onboarding_videos_updated_at
BEFORE UPDATE ON public.onboarding_videos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_video_watch_progress_updated_at
BEFORE UPDATE ON public.video_watch_progress
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();