-- データベーステーブルに `stripe_events` を作成して Webhook イベントを追跡
CREATE TABLE IF NOT EXISTS public.stripe_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  livemode BOOLEAN NOT NULL DEFAULT false,
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  data JSONB
);

-- Row Level Security を有効にする
ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;

-- ユーザーは自分のイベントのみ参照可能
CREATE POLICY "users_can_view_own_events" ON public.stripe_events
FOR SELECT
USING (user_id = auth.uid());

-- システムがイベントを作成可能
CREATE POLICY "system_can_insert_events" ON public.stripe_events
FOR INSERT
WITH CHECK (true);