import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface MasterModeState {
  isActive: boolean;
  targetUserId: string | null;
  targetUserName: string | null;
}

export const useMasterMode = () => {
  const [masterMode, setMasterMode] = useState<MasterModeState>({
    isActive: false,
    targetUserId: null,
    targetUserName: null,
  });

  useEffect(() => {
    // Check if master mode is active on component mount
    const checkMasterMode = () => {
      const isActive = sessionStorage.getItem('masterMode') === 'true';
      const targetUserId = sessionStorage.getItem('masterModeUserId');
      const targetUserName = sessionStorage.getItem('masterModeUserName');

      setMasterMode({
        isActive,
        targetUserId,
        targetUserName,
      });
    };

    checkMasterMode();

    // Listen for storage changes
    const handleStorageChange = () => {
      checkMasterMode();
    };

    window.addEventListener('storage', handleStorageChange);
    
    // Also listen for custom events from within the same tab
    window.addEventListener('masterModeChanged', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('masterModeChanged', handleStorageChange);
    };
  }, []);

  const getUserData = async (userId?: string) => {
    const targetId = userId || masterMode.targetUserId;
    if (!targetId) return null;

    try {
      // Get user profile data
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', targetId)
        .single();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
        return null;
      }

      return profile;
    } catch (error) {
      console.error('Error in getUserData:', error);
      return null;
    }
  };

  const getSupabaseClient = () => {
    // In master mode, we might need to create a service role client
    // or modify queries to bypass RLS for the target user
    return supabase;
  };

  return {
    ...masterMode,
    getUserData,
    getSupabaseClient,
  };
};