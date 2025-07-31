-- Add delivery_seconds column to steps table
ALTER TABLE public.steps ADD COLUMN delivery_seconds integer NOT NULL DEFAULT 0;