-- Create invite_clicks table to track invitation clicks
CREATE TABLE public.invite_clicks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invite_code_id UUID NOT NULL REFERENCES public.scenario_invite_codes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clicked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.invite_clicks ENABLE ROW LEVEL SECURITY;

-- Create indexes for better performance
CREATE INDEX idx_invite_clicks_clicked_at ON public.invite_clicks(clicked_at);
CREATE INDEX idx_invite_clicks_invite_code_id ON public.invite_clicks(invite_code_id);
CREATE INDEX idx_invite_clicks_user_id ON public.invite_clicks(user_id);

-- Create policies for user access
CREATE POLICY "Users can view their own invite clicks" 
ON public.invite_clicks 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own invite clicks" 
ON public.invite_clicks 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Function to clean up old invite clicks (older than 1 day)
CREATE OR REPLACE FUNCTION public.cleanup_old_invite_clicks()
RETURNS void AS $$
BEGIN
  DELETE FROM public.invite_clicks 
  WHERE clicked_at < (now() - interval '1 day');
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled function to clean up old clicks
-- (This would typically be handled by a cron job in production)
CREATE OR REPLACE FUNCTION public.trigger_cleanup_invite_clicks()
RETURNS trigger AS $$
BEGIN
  -- Randomly cleanup old records (1% chance on each insert)
  IF random() < 0.01 THEN
    PERFORM public.cleanup_old_invite_clicks();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic cleanup
CREATE TRIGGER trigger_cleanup_invite_clicks_after_insert
  AFTER INSERT ON public.invite_clicks
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_cleanup_invite_clicks();