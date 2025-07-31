-- 1. step_messagesテーブルのCHECK制約を確認・修正
-- 既存のCHECK制約を削除（存在する場合）
ALTER TABLE public.step_messages 
DROP CONSTRAINT IF EXISTS step_messages_message_type_check;

-- 新しいCHECK制約を追加（flexを含む）
ALTER TABLE public.step_messages 
ADD CONSTRAINT step_messages_message_type_check 
CHECK (message_type IN ('text', 'media', 'flex'));

-- 2. ENUM型を作成（推奨アプローチ）
CREATE TYPE IF NOT EXISTS public.step_message_type AS ENUM ('text', 'media', 'flex');

-- 3. step_messagesテーブルのmessage_typeカラムをENUM型に変更
ALTER TABLE public.step_messages 
ALTER COLUMN message_type TYPE step_message_type 
USING message_type::step_message_type;

-- 4. 既存データの確認とクリーンアップ
-- 無効なmessage_typeがある場合は修正
UPDATE public.step_messages 
SET message_type = 'text' 
WHERE message_type NOT IN ('text', 'media', 'flex');

-- 5. flex_message_idカラムが存在することを確認（既に存在しているはず）
-- 外部キー制約を追加（存在しない場合）
ALTER TABLE public.step_messages 
ADD CONSTRAINT IF NOT EXISTS fk_step_messages_flex_message_id 
FOREIGN KEY (flex_message_id) REFERENCES public.flex_messages(id);