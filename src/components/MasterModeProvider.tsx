import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface MasterModeContextType {
  isActive: boolean;
  targetUserId: string | null;
  targetUserName: string | null;
  getUserData: (userId?: string) => Promise<any>;
  getSupabaseClient: () => typeof supabase;
}

const MasterModeContext = createContext<MasterModeContextType | undefined>(undefined);

export const useMasterMode = () => {
  const context = useContext(MasterModeContext);
  if (!context) {
    throw new Error('useMasterMode must be used within a MasterModeProvider');
  }
  return context;
};

interface MasterModeProviderProps {
  children: React.ReactNode;
}

export const MasterModeProvider: React.FC<MasterModeProviderProps> = ({ children }) => {
  const [isActive, setIsActive] = useState(false);
  const [targetUserId, setTargetUserId] = useState<string | null>(null);
  const [targetUserName, setTargetUserName] = useState<string | null>(null);

  useEffect(() => {
    const checkMasterMode = () => {
      const active = sessionStorage.getItem('masterMode') === 'true';
      const userId = sessionStorage.getItem('masterModeUserId');
      const userName = sessionStorage.getItem('masterModeUserName');

      setIsActive(active);
      setTargetUserId(userId);
      setTargetUserName(userName);
    };

    checkMasterMode();

    const handleStorageChange = () => {
      checkMasterMode();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('masterModeChanged', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('masterModeChanged', handleStorageChange);
    };
  }, []);

  const getUserData = async (userId?: string) => {
    const targetId = userId || targetUserId;
    if (!targetId) return null;

    try {
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
    return supabase;
  };

  return (
    <MasterModeContext.Provider
      value={{
        isActive,
        targetUserId,
        targetUserName,
        getUserData,
        getSupabaseClient,
      }}
    >
      {children}
    </MasterModeContext.Provider>
  );
};