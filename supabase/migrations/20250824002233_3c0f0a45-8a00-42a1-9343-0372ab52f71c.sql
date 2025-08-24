-- Add restore_access to step_message_type enum if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'restore_access' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'step_message_type')) THEN
        ALTER TYPE step_message_type ADD VALUE 'restore_access';
    END IF;
END $$;

-- Alter step_messages table to add restore_config column for restoration button configuration
ALTER TABLE step_messages 
ADD COLUMN IF NOT EXISTS restore_config jsonb;