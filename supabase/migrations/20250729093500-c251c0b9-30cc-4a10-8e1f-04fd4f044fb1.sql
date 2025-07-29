-- Flexメッセージを保存するテーブルを作成
CREATE TABLE public.flex_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  content JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Row Level Security (RLS) を有効化
ALTER TABLE public.flex_messages ENABLE ROW LEVEL SECURITY;

-- ユーザーは自分のFlexメッセージのみ参照可能
CREATE POLICY "ユーザーは自分のFlexメッセージのみ参照可能" 
ON public.flex_messages 
FOR SELECT 
USING (auth.uid() = user_id);

-- ユーザーは自分のFlexメッセージを作成可能
CREATE POLICY "ユーザーは自分のFlexメッセージを作成可能" 
ON public.flex_messages 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- ユーザーは自分のFlexメッセージを更新可能
CREATE POLICY "ユーザーは自分のFlexメッセージを更新可能" 
ON public.flex_messages 
FOR UPDATE 
USING (auth.uid() = user_id);

-- ユーザーは自分のFlexメッセージを削除可能
CREATE POLICY "ユーザーは自分のFlexメッセージを削除可能" 
ON public.flex_messages 
FOR DELETE 
USING (auth.uid() = user_id);

-- updated_atカラムの自動更新トリガーを作成
CREATE TRIGGER update_flex_messages_updated_at
BEFORE UPDATE ON public.flex_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();