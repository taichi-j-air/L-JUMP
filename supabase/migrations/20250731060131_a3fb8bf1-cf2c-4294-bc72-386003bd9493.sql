-- 友達情報を保存するテーブルを作成
CREATE TABLE public.line_friends (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  line_user_id TEXT NOT NULL,
  display_name TEXT,
  picture_url TEXT,
  added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, line_user_id)
);

-- RLSを有効化
ALTER TABLE public.line_friends ENABLE ROW LEVEL SECURITY;

-- RLSポリシーを作成
CREATE POLICY "ユーザーは自分の友達のみ参照可能" 
ON public.line_friends 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "ユーザーは自分の友達を作成可能" 
ON public.line_friends 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ユーザーは自分の友達を更新可能" 
ON public.line_friends 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "ユーザーは自分の友達を削除可能" 
ON public.line_friends 
FOR DELETE 
USING (auth.uid() = user_id);

-- 更新日時の自動更新トリガーを作成
CREATE TRIGGER update_line_friends_updated_at
BEFORE UPDATE ON public.line_friends
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- profilesテーブルに配信関連の情報を追加
ALTER TABLE public.profiles 
ADD COLUMN delivery_limit INTEGER DEFAULT 1000,
ADD COLUMN delivery_count INTEGER DEFAULT 0,
ADD COLUMN friends_count INTEGER DEFAULT 0;