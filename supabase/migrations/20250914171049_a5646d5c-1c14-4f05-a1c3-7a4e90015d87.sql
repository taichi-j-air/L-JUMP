-- Create rich_menus table for managing rich menu metadata
CREATE TABLE public.rich_menus (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  name TEXT NOT NULL,
  background_image_url TEXT,
  chat_bar_text TEXT DEFAULT 'メニュー',
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  size TEXT DEFAULT 'full' CHECK (size IN ('full', 'half')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create rich_menu_areas table for tap area definitions
CREATE TABLE public.rich_menu_areas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rich_menu_id UUID NOT NULL REFERENCES public.rich_menus(id) ON DELETE CASCADE,
  x_percent DECIMAL(5,2) NOT NULL CHECK (x_percent >= 0 AND x_percent <= 100),
  y_percent DECIMAL(5,2) NOT NULL CHECK (y_percent >= 0 AND y_percent <= 100),
  width_percent DECIMAL(5,2) NOT NULL CHECK (width_percent > 0 AND width_percent <= 100),
  height_percent DECIMAL(5,2) NOT NULL CHECK (height_percent > 0 AND height_percent <= 100),
  action_type TEXT NOT NULL CHECK (action_type IN ('uri', 'message', 'richmenuswitch')),
  action_value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.rich_menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rich_menu_areas ENABLE ROW LEVEL SECURITY;

-- RLS policies for rich_menus
CREATE POLICY "Users can view their own rich menus" 
ON public.rich_menus 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own rich menus" 
ON public.rich_menus 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own rich menus" 
ON public.rich_menus 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own rich menus" 
ON public.rich_menus 
FOR DELETE 
USING (auth.uid() = user_id);

-- RLS policies for rich_menu_areas  
CREATE POLICY "Users can view their own rich menu areas" 
ON public.rich_menu_areas 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.rich_menus rm 
  WHERE rm.id = rich_menu_areas.rich_menu_id 
  AND rm.user_id = auth.uid()
));

CREATE POLICY "Users can create their own rich menu areas" 
ON public.rich_menu_areas 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.rich_menus rm 
  WHERE rm.id = rich_menu_areas.rich_menu_id 
  AND rm.user_id = auth.uid()
));

CREATE POLICY "Users can update their own rich menu areas" 
ON public.rich_menu_areas 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM public.rich_menus rm 
  WHERE rm.id = rich_menu_areas.rich_menu_id 
  AND rm.user_id = auth.uid()
));

CREATE POLICY "Users can delete their own rich menu areas" 
ON public.rich_menu_areas 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM public.rich_menus rm 
  WHERE rm.id = rich_menu_areas.rich_menu_id 
  AND rm.user_id = auth.uid()
));

-- Add updated_at trigger functions
CREATE OR REPLACE FUNCTION public.update_rich_menus_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION public.update_rich_menu_areas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_rich_menus_updated_at
BEFORE UPDATE ON public.rich_menus
FOR EACH ROW
EXECUTE FUNCTION public.update_rich_menus_updated_at();

CREATE TRIGGER update_rich_menu_areas_updated_at
BEFORE UPDATE ON public.rich_menu_areas
FOR EACH ROW
EXECUTE FUNCTION public.update_rich_menu_areas_updated_at();