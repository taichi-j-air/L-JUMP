-- Add tags table for friend tags
CREATE TABLE IF NOT EXISTS public.tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#0cb386',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

-- Create policies for tags
CREATE POLICY "Users can view own tags" ON public.tags
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create own tags" ON public.tags
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own tags" ON public.tags
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own tags" ON public.tags
  FOR DELETE USING (user_id = auth.uid());

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_tags_user_id ON public.tags(user_id);

-- Insert some default tags for existing users
INSERT INTO public.tags (user_id, name, color)
SELECT 
  p.user_id,
  'VIP',
  '#fbbf24'
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.tags t WHERE t.user_id = p.user_id
)
ON CONFLICT DO NOTHING;

INSERT INTO public.tags (user_id, name, color)
SELECT 
  p.user_id,
  '新規',
  '#10b981'
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.tags t WHERE t.user_id = p.user_id AND t.name = '新規'
)
ON CONFLICT DO NOTHING;