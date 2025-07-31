-- ステップ配信追跡用のテーブルを作成
CREATE TABLE IF NOT EXISTS public.step_delivery_tracking (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scenario_id UUID NOT NULL,
  step_id UUID NOT NULL,
  friend_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting', -- waiting, delivered, exited
  delivered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.step_delivery_tracking ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "ユーザーは自分のシナリオの配信追跡のみ参照可能" 
ON public.step_delivery_tracking 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM step_scenarios s 
  WHERE s.id = step_delivery_tracking.scenario_id 
  AND s.user_id = auth.uid()
));

CREATE POLICY "システムが配信追跡を作成可能" 
ON public.step_delivery_tracking 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "システムが配信追跡を更新可能" 
ON public.step_delivery_tracking 
FOR UPDATE 
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_step_delivery_tracking_updated_at
BEFORE UPDATE ON public.step_delivery_tracking
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();