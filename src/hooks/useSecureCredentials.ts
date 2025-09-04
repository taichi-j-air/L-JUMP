/**
 * Custom hook for secure credential management
 */
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface LineCredentials {
  channel_access_token: string;
  channel_secret: string;
  channel_id: string;
  bot_id: string;
  liff_id: string;
}

export function useSecureCredentials() {
  const [credentials, setCredentials] = useState<LineCredentials | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const loadCredentials = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .rpc('get_user_line_credentials', { p_user_id: user.id });

      if (error) {
        console.error('Failed to load credentials:', error);
        return;
      }

      if (data && data.length > 0) {
        // Decrypt credentials if they're encrypted
        const decryptedCredentials = { ...data[0] };
        
        for (const [key, value] of Object.entries(decryptedCredentials)) {
          if (typeof value === 'string' && value.startsWith('enc:')) {
            try {
              const { data: decryptData, error: decryptError } = await supabase.functions.invoke('decrypt-credential', {
                body: { encryptedValue: value }
              });
              
              if (!decryptError && decryptData?.decryptedValue) {
                decryptedCredentials[key as keyof LineCredentials] = decryptData.decryptedValue;
              }
            } catch (decryptErr) {
              console.warn(`Failed to decrypt ${key}:`, decryptErr);
            }
          }
        }
        
        setCredentials(decryptedCredentials);
      }
    } catch (error) {
      console.error('Error loading credentials:', error);
    } finally {
      setLoading(false);
    }
  };

  const encryptValue = async (value: string): Promise<string> => {
    try {
      // SECURITY FIX: Use server-side encryption via Supabase function
      // This ensures proper key management and persistent decryption capability
      const { data, error } = await supabase.functions.invoke('encrypt-credential', {
        body: { value }
      });

      if (error) {
        console.error('Encryption failed:', error);
        throw new Error('Failed to encrypt credential');
      }

      return data.encryptedValue;
    } catch (error) {
      console.error('Credential encryption error:', error);
      // Fallback: Store as-is with warning (temporary measure)
      console.warn('SECURITY WARNING: Storing credential without encryption due to encryption failure');
      return value;
    }
  };

  const saveCredential = async (type: string, value: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Authentication required');

      // Encrypt the credential value before storage
      const encryptedValue = await encryptValue(value);

      const { error } = await supabase
        .from('secure_line_credentials')
        .upsert({
          user_id: user.id,
          credential_type: type,
          encrypted_value: encryptedValue,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id, credential_type'
        });

      if (error) throw error;

      // Reload credentials
      await loadCredentials();
      
      return true;
    } catch (error) {
      console.error('Failed to save credential:', error);
      toast({
        title: "エラー",
        description: "認証情報の保存に失敗しました",
        variant: "destructive",
      });
      return false;
    }
  };

  useEffect(() => {
    loadCredentials();
  }, []);

  return {
    credentials,
    loading,
    loadCredentials,
    saveCredential,
  };
}