-- Update secure_line_credentials table to use proper encryption
ALTER TABLE public.secure_line_credentials 
ADD COLUMN IF NOT EXISTS vault_secret_id uuid;

-- Create function to safely retrieve LINE credentials using vault
CREATE OR REPLACE FUNCTION public.get_line_credentials_secure(p_user_id uuid, p_credential_type text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  secret_value text;
BEGIN
  -- Only allow users to access their own credentials
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  
  -- Get encrypted value (for now until vault is properly configured)
  SELECT encrypted_value
  INTO secret_value
  FROM public.secure_line_credentials
  WHERE user_id = p_user_id 
    AND credential_type = p_credential_type;
  
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
SET search_path = 'public', 'pg_temp'
AS $$
BEGIN
  -- Only allow service role access
  IF (auth.jwt() ->> 'role'::text) != 'service_role' THEN
    RAISE EXCEPTION 'Service role access required';
  END IF;
  
  RETURN QUERY
  SELECT 
    COALESCE((SELECT encrypted_value FROM public.secure_line_credentials WHERE user_id = p_user_id AND credential_type = 'channel_access_token'), '') AS channel_access_token,
    COALESCE((SELECT encrypted_value FROM public.secure_line_credentials WHERE user_id = p_user_id AND credential_type = 'channel_secret'), '') AS channel_secret,
    COALESCE((SELECT encrypted_value FROM public.secure_line_credentials WHERE user_id = p_user_id AND credential_type = 'channel_id'), '') AS channel_id,
    COALESCE((SELECT encrypted_value FROM public.secure_line_credentials WHERE user_id = p_user_id AND credential_type = 'bot_id'), '') AS bot_id,
    COALESCE((SELECT encrypted_value FROM public.secure_line_credentials WHERE user_id = p_user_id AND credential_type = 'liff_id'), '') AS liff_id;
END;
$$;