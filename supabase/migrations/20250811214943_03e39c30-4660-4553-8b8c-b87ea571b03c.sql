-- Ensure form_submissions cascades when a form is deleted
DO $$
BEGIN
  -- Create a foreign key if it doesn't exist; if exists without cascade, drop and recreate safely
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'form_submissions'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'form_id'
  ) THEN
    ALTER TABLE public.form_submissions
      ADD CONSTRAINT form_submissions_form_id_fkey
      FOREIGN KEY (form_id)
      REFERENCES public.forms(id)
      ON DELETE CASCADE;
  ELSE
    -- Check if existing FK has cascade; if not, replace it
    PERFORM 1 FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public' AND t.relname = 'form_submissions' AND c.confdeltype = 'c';
    IF NOT FOUND THEN
      -- find existing constraint name
      DECLARE fk_name text;
      BEGIN
        SELECT conname INTO fk_name
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'public' AND t.relname = 'form_submissions' AND c.contype = 'f'
        LIMIT 1;
        IF fk_name IS NOT NULL THEN
          ALTER TABLE public.form_submissions DROP CONSTRAINT IF EXISTS ""||fk_name||"";
        END IF;
        ALTER TABLE public.form_submissions
          ADD CONSTRAINT form_submissions_form_id_fkey
          FOREIGN KEY (form_id)
          REFERENCES public.forms(id)
          ON DELETE CASCADE;
      END;
    END IF;
  END IF;
END$$;