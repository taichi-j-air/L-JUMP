-- Stripe eventsテーブルを作成（user_id を削除）
CREATE TABLE IF NOT EXISTS public.stripe_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  livemode BOOLEAN NOT NULL DEFAULT false,
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  data JSONB
);

-- Row Level Security を有効にする
ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;

-- システムがイベントを作成・参照可能
CREATE POLICY "system_can_manage_events" ON public.stripe_events
FOR ALL
WITH CHECK (true);