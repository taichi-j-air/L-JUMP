-- ステップ配信シナリオのテーブル
CREATE TABLE public.step_scenarios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ステップのテーブル
CREATE TABLE public.steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scenario_id UUID NOT NULL REFERENCES public.step_scenarios(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  step_order INTEGER NOT NULL,
  delivery_type TEXT NOT NULL CHECK (delivery_type IN ('after_registration', 'specific_time')),
  delivery_days INTEGER DEFAULT 0,
  delivery_hours INTEGER DEFAULT 0,
  delivery_minutes INTEGER DEFAULT 0,
  specific_time TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ステップメッセージのテーブル
CREATE TABLE public.step_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  step_id UUID NOT NULL REFERENCES public.steps(id) ON DELETE CASCADE,
  message_order INTEGER NOT NULL,
  message_type TEXT NOT NULL CHECK (message_type IN ('text', 'media')),
  content TEXT NOT NULL,
  media_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- シナリオ間移動設定のテーブル
CREATE TABLE public.scenario_transitions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  from_scenario_id UUID NOT NULL REFERENCES public.step_scenarios(id) ON DELETE CASCADE,
  to_scenario_id UUID NOT NULL REFERENCES public.step_scenarios(id) ON DELETE CASCADE,
  condition_type TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ROW LEVEL SECURITY を有効化
ALTER TABLE public.step_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.step_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scenario_transitions ENABLE ROW LEVEL SECURITY;

-- RLS ポリシー for step_scenarios
CREATE POLICY "ユーザーは自分のステップシナリオのみ参照可能"
ON public.step_scenarios FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "ユーザーは自分のステップシナリオを作成可能"
ON public.step_scenarios FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ユーザーは自分のステップシナリオを更新可能"
ON public.step_scenarios FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ユーザーは自分のステップシナリオを削除可能"
ON public.step_scenarios FOR DELETE
USING (auth.uid() = user_id);

-- RLS ポリシー for steps
CREATE POLICY "ユーザーは自分のステップのみ参照可能"
ON public.steps FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.step_scenarios s 
  WHERE s.id = steps.scenario_id AND s.user_id = auth.uid()
));

CREATE POLICY "ユーザーは自分のステップを作成可能"
ON public.steps FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.step_scenarios s 
  WHERE s.id = steps.scenario_id AND s.user_id = auth.uid()
));

CREATE POLICY "ユーザーは自分のステップを更新可能"
ON public.steps FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.step_scenarios s 
  WHERE s.id = steps.scenario_id AND s.user_id = auth.uid()
));

CREATE POLICY "ユーザーは自分のステップを削除可能"
ON public.steps FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.step_scenarios s 
  WHERE s.id = steps.scenario_id AND s.user_id = auth.uid()
));

-- RLS ポリシー for step_messages
CREATE POLICY "ユーザーは自分のステップメッセージのみ参照可能"
ON public.step_messages FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.steps st
  JOIN public.step_scenarios s ON s.id = st.scenario_id
  WHERE st.id = step_messages.step_id AND s.user_id = auth.uid()
));

CREATE POLICY "ユーザーは自分のステップメッセージを作成可能"
ON public.step_messages FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.steps st
  JOIN public.step_scenarios s ON s.id = st.scenario_id
  WHERE st.id = step_messages.step_id AND s.user_id = auth.uid()
));

CREATE POLICY "ユーザーは自分のステップメッセージを更新可能"
ON public.step_messages FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.steps st
  JOIN public.step_scenarios s ON s.id = st.scenario_id
  WHERE st.id = step_messages.step_id AND s.user_id = auth.uid()
));

CREATE POLICY "ユーザーは自分のステップメッセージを削除可能"
ON public.step_messages FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.steps st
  JOIN public.step_scenarios s ON s.id = st.scenario_id
  WHERE st.id = step_messages.step_id AND s.user_id = auth.uid()
));

-- RLS ポリシー for scenario_transitions
CREATE POLICY "ユーザーは自分のシナリオ移動設定のみ参照可能"
ON public.scenario_transitions FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.step_scenarios s 
  WHERE s.id = scenario_transitions.from_scenario_id AND s.user_id = auth.uid()
));

CREATE POLICY "ユーザーは自分のシナリオ移動設定を作成可能"
ON public.scenario_transitions FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.step_scenarios s 
  WHERE s.id = scenario_transitions.from_scenario_id AND s.user_id = auth.uid()
));

CREATE POLICY "ユーザーは自分のシナリオ移動設定を更新可能"
ON public.scenario_transitions FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.step_scenarios s 
  WHERE s.id = scenario_transitions.from_scenario_id AND s.user_id = auth.uid()
));

CREATE POLICY "ユーザーは自分のシナリオ移動設定を削除可能"
ON public.scenario_transitions FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.step_scenarios s 
  WHERE s.id = scenario_transitions.from_scenario_id AND s.user_id = auth.uid()
));

-- トリガー用の関数を作成（既にある場合はスキップ）
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- updated_at フィールド自動更新のトリガー
CREATE TRIGGER update_step_scenarios_updated_at
  BEFORE UPDATE ON public.step_scenarios
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_steps_updated_at
  BEFORE UPDATE ON public.steps
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_step_messages_updated_at
  BEFORE UPDATE ON public.step_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_scenario_transitions_updated_at
  BEFORE UPDATE ON public.scenario_transitions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- インデックスの作成
CREATE INDEX idx_steps_scenario_id ON public.steps(scenario_id);
CREATE INDEX idx_steps_order ON public.steps(scenario_id, step_order);
CREATE INDEX idx_step_messages_step_id ON public.step_messages(step_id);
CREATE INDEX idx_step_messages_order ON public.step_messages(step_id, message_order);
CREATE INDEX idx_scenario_transitions_from ON public.scenario_transitions(from_scenario_id);