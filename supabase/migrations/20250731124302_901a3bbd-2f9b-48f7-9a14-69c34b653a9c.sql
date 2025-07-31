-- 1. step_messagesテーブルのCHECK制約を削除（存在する場合）
ALTER TABLE public.step_messages 
DROP CONSTRAINT IF EXISTS step_messages_message_type_check;

-- 2. ENUM型を作成（存在しない場合のみ）
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'step_message_type') THEN
        CREATE TYPE public.step_message_type AS ENUM ('text', 'media', 'flex');
    END IF;
END $$;

-- 3. step_messagesテーブルのmessage_typeカラムをENUM型に変更
ALTER TABLE public.step_messages 
ALTER COLUMN message_type TYPE step_message_type 
USING message_type::step_message_type;

-- 4. flex_message_idカラムに外部キー制約を追加（存在しない場合）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_step_messages_flex_message_id'
    ) THEN
        ALTER TABLE public.step_messages 
        ADD CONSTRAINT fk_step_messages_flex_message_id 
        FOREIGN KEY (flex_message_id) REFERENCES public.flex_messages(id);
    END IF;
END $$;