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
        setCredentials(data[0]);
      }
    } catch (error) {
      console.error('Error loading credentials:', error);
    } finally {
      setLoading(false);
    }
  };

  const encryptValue = async (value: string): Promise<string> => {
    // Use Web Crypto API for client-side encryption
    const encoder = new TextEncoder();
    const data = encoder.encode(value);
    
    // Generate a random key for encryption
    const key = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );
    
    // Generate random IV
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    // Encrypt the data
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );
    
    // For demo purposes, we'll use base64 encoding with a prefix
    // In production, you'd want to use Supabase Vault or proper key management
    const encryptedArray = new Uint8Array(encrypted);
    const combinedArray = new Uint8Array(iv.length + encryptedArray.length);
    combinedArray.set(iv);
    combinedArray.set(encryptedArray, iv.length);
    
    return 'encrypted:' + btoa(String.fromCharCode(...combinedArray));
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