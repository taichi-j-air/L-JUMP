-- Enable Supabase Vault for secure credential encryption
-- Add vault schema access if not already enabled
SELECT vault.create_secret('example_secret', 'example_value', 'Example secret');
DELETE FROM vault.secrets WHERE name = 'example_secret';

-- Update secure_line_credentials table to use proper encryption
ALTER TABLE public.secure_line_credentials 
ADD COLUMN IF NOT EXISTS vault_secret_id uuid REFERENCES vault.secrets(id) ON DELETE SET NULL;

-- Create function to safely retrieve LINE credentials using vault
CREATE OR REPLACE FUNCTION public.get_line_credentials_secure(p_user_id uuid, p_credential_type text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'vault', 'pg_temp'
AS $$
DECLARE
  secret_value text;
BEGIN
  -- Only allow users to access their own credentials
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  
  -- Try to get from vault first
  SELECT vault.decrypted_secret
  INTO secret_value
  FROM public.secure_line_credentials slc
  JOIN vault.secrets vs ON vs.id = slc.vault_secret_id
  WHERE slc.user_id = p_user_id 
    AND slc.credential_type = p_credential_type;
  
  -- Fallback to encrypted_value if vault_secret_id is null
  IF secret_value IS NULL THEN
    SELECT encrypted_value
    INTO secret_value
    FROM public.secure_line_credentials
    WHERE user_id = p_user_id 
      AND credential_type = p_credential_type;
  END IF;
  
  RETURN secret_value;
END;
$$;

-- Function for edge functions to get credentials (service role only)
CREATE OR REPLACE FUNCTION public.get_line_credentials_for_user(p_user_id uuid)
RETURNS TABLE(
  channel_access_token text,
  channel_secret text,
  channel_id text,
  bot_id text,
  liff_id text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'vault', 'pg_temp'
AS $$
BEGIN
  -- Only allow service role access
  IF (auth.jwt() ->> 'role'::text) != 'service_role' THEN
    RAISE EXCEPTION 'Service role access required';
  END IF;
  
  RETURN QUERY
  SELECT 
    COALESCE(public.get_line_credentials_secure(p_user_id, 'channel_access_token'), '') AS channel_access_token,
    COALESCE(public.get_line_credentials_secure(p_user_id, 'channel_secret'), '') AS channel_secret,
    COALESCE(public.get_line_credentials_secure(p_user_id, 'channel_id'), '') AS channel_id,
    COALESCE(public.get_line_credentials_secure(p_user_id, 'bot_id'), '') AS bot_id,
    COALESCE(public.get_line_credentials_secure(p_user_id, 'liff_id'), '') AS liff_id;
END;
$$;

-- Enhance auth configuration security
UPDATE auth.config SET 
  password_min_length = 12,
  password_requirements = 'MIXED_CASE NUMBERS SPECIAL_CHARS',
  jwt_aud_claim = 'authenticated',
  jwt_default_group_name = 'authenticated'
WHERE TRUE;

-- Create secure credential migration function
CREATE OR REPLACE FUNCTION public.migrate_credentials_to_vault()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'vault', 'pg_temp'
AS $$
DECLARE
  cred_record RECORD;
  secret_id uuid;
BEGIN
  -- Only allow developers to run this
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND user_role = 'developer'
  ) THEN
    RAISE EXCEPTION 'Access denied: Developer role required';
  END IF;
  
  -- Migrate existing credentials to vault
  FOR cred_record IN 
    SELECT * FROM public.secure_line_credentials 
    WHERE vault_secret_id IS NULL AND encrypted_value IS NOT NULL
  LOOP
    -- Create vault secret
    SELECT vault.create_secret(
      concat('line_', cred_record.credential_type, '_', cred_record.user_id),
      cred_record.encrypted_value,
      concat('LINE ', cred_record.credential_type, ' for user ', cred_record.user_id)
    ) INTO secret_id;
    
    -- Update record with vault secret ID
    UPDATE public.secure_line_credentials
    SET vault_secret_id = secret_id,
        encrypted_value = NULL -- Clear plain text after vault migration
    WHERE id = cred_record.id;
  END LOOP;
  
  PERFORM public.log_security_event_enhanced(
    p_action := 'credentials_migrated_to_vault',
    p_severity := 'info'
  );
END;
$$;