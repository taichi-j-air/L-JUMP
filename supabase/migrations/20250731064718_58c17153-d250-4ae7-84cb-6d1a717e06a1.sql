-- ENUM型を作成
CREATE TYPE public.message_kind AS ENUM ('incoming','outgoing');

-- デフォルト値を削除してからENUM移行
ALTER TABLE public.chat_messages ALTER COLUMN message_type DROP DEFAULT;

-- 安全なENUM移行
ALTER TABLE public.chat_messages 
  ALTER COLUMN message_type TYPE message_kind 
  USING CASE 
    WHEN message_type IN ('incoming', 'outgoing') THEN message_type::message_kind
    ELSE 'outgoing'::message_kind
  END;

-- ENUMのデフォルト値を再設定
ALTER TABLE public.chat_messages ALTER COLUMN message_type SET DEFAULT 'outgoing'::message_kind;

-- RLSポリシー再作成（WITH CHECK追加）
DROP POLICY IF EXISTS "ユーザーは自分のチャットメッセージを更新可能" ON public.chat_messages;
DROP POLICY IF EXISTS "ユーザーは自分のチャットメッセージを作成可能" ON public.chat_messages;

CREATE POLICY "ユーザーは自分のチャットメッセージを作成可能" 
  ON public.chat_messages FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ユーザーは自分のチャットメッセージを更新可能" 
  ON public.chat_messages FOR UPDATE 
  USING (auth.uid() = user_id) 
  WITH CHECK (auth.uid() = user_id);

-- パフォーマンス向上用インデックス
CREATE INDEX IF NOT EXISTS chat_messages_friend_sent_idx
  ON public.chat_messages(friend_id, sent_at);

-- データ整合性確保用制約
ALTER TABLE public.chat_messages
  ADD CONSTRAINT chat_messages_user_check
  CHECK (user_id IS NOT NULL);

-- updated_at自動更新関数の保証
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- プロファイルテーブル拡張
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS monthly_message_limit INTEGER DEFAULT 200,
ADD COLUMN IF NOT EXISTS monthly_message_used INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS quota_updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
ADD COLUMN IF NOT EXISTS current_month INTEGER DEFAULT EXTRACT(MONTH FROM now()),
ADD COLUMN IF NOT EXISTS current_year INTEGER DEFAULT EXTRACT(YEAR FROM now());

-- 月次リセット用のトリガー関数
CREATE OR REPLACE FUNCTION public.reset_monthly_quota()
RETURNS TRIGGER AS $$
BEGIN
  -- 月が変わった場合にカウンターリセット
  IF NEW.current_month != EXTRACT(MONTH FROM now()) 
     OR NEW.current_year != EXTRACT(YEAR FROM now()) THEN
    NEW.monthly_message_used = 0;
    NEW.current_month = EXTRACT(MONTH FROM now());
    NEW.current_year = EXTRACT(YEAR FROM now());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER reset_quota_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.reset_monthly_quota();