-- シナリオ別の友達追加コード管理用テーブル
CREATE TABLE public.scenario_invite_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scenario_id UUID NOT NULL,
  user_id UUID NOT NULL,
  invite_code TEXT NOT NULL UNIQUE,
  usage_count INTEGER NOT NULL DEFAULT 0,
  max_usage INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- インデックス
CREATE INDEX idx_scenario_invite_codes_scenario_id ON public.scenario_invite_codes(scenario_id);
CREATE INDEX idx_scenario_invite_codes_user_id ON public.scenario_invite_codes(user_id);
CREATE INDEX idx_scenario_invite_codes_invite_code ON public.scenario_invite_codes(invite_code);

-- RLSを有効化
ALTER TABLE public.scenario_invite_codes ENABLE ROW LEVEL SECURITY;

-- RLSポリシー
CREATE POLICY "ユーザーは自分の招待コードのみ参照可能" 
ON public.scenario_invite_codes 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "ユーザーは自分の招待コードを作成可能" 
ON public.scenario_invite_codes 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ユーザーは自分の招待コードを更新可能" 
ON public.scenario_invite_codes 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "ユーザーは自分の招待コードを削除可能" 
ON public.scenario_invite_codes 
FOR DELETE 
USING (auth.uid() = user_id);

-- updated_atを自動更新するトリガー
CREATE TRIGGER update_scenario_invite_codes_updated_at
BEFORE UPDATE ON public.scenario_invite_codes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- シナリオごとの友達追加ログ用テーブル
CREATE TABLE public.scenario_friend_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scenario_id UUID NOT NULL,
  invite_code TEXT NOT NULL,
  friend_id UUID,
  line_user_id TEXT,
  added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- インデックス
CREATE INDEX idx_scenario_friend_logs_scenario_id ON public.scenario_friend_logs(scenario_id);
CREATE INDEX idx_scenario_friend_logs_invite_code ON public.scenario_friend_logs(invite_code);

-- RLSを有効化
ALTER TABLE public.scenario_friend_logs ENABLE ROW LEVEL SECURITY;

-- RLSポリシー（ログは参照のみ）
CREATE POLICY "ユーザーは自分のシナリオのログのみ参照可能" 
ON public.scenario_friend_logs 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.step_scenarios s 
  WHERE s.id = scenario_friend_logs.scenario_id 
  AND s.user_id = auth.uid()
));

CREATE POLICY "システムがログを作成可能" 
ON public.scenario_friend_logs 
FOR INSERT 
WITH CHECK (true);

-- 招待コードを自動生成する関数
CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS TEXT AS $$
BEGIN
  RETURN encode(gen_random_bytes(8), 'hex');
END;
$$ LANGUAGE plpgsql;