import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSecureAuth } from './useSecureAuth';

export const useLiffValidation = () => {
  const { user } = useSecureAuth();
  const [hasLiffConfig, setHasLiffConfig] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkLiffConfig = async () => {
      if (!user) {
        setHasLiffConfig(null);
        setLoading(false);
        return;
      }

      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('liff_id, line_login_channel_id')
          .eq('user_id', user.id)
          .maybeSingle();

        const hasConfig = !!(profile?.liff_id && profile?.line_login_channel_id);
        setHasLiffConfig(hasConfig);
      } catch (error) {
        console.error('LIFF設定確認エラー:', error);
        setHasLiffConfig(false);
      } finally {
        setLoading(false);
      }
    };

    checkLiffConfig();
  }, [user]);

  return { hasLiffConfig, loading };
};