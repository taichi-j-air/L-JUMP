-- 既存データを保持しながらcontentカラムをJSONB型に変更
ALTER TABLE public.flex_messages 
ALTER COLUMN content TYPE jsonb 
USING CASE 
  WHEN content::text ~ '^[{\[]' THEN content::jsonb
  ELSE '{}'::jsonb
END;

-- インデックス追加（パフォーマンス向上）
CREATE INDEX IF NOT EXISTS flex_messages_content_gin_idx 
ON public.flex_messages USING gin (content);