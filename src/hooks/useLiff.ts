import { useState, useEffect, useCallback } from 'react';

declare global {
  interface Window {
    liff: any;
  }
}

interface LiffProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
}

interface LiffContext {
  language: string;
  version: string;
  isInClient: boolean;
  isLoggedIn: boolean;
  os: string;
}

export const useLiff = (liffId?: string) => {
  const [isLiffReady, setIsLiffReady] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [profile, setProfile] = useState<LiffProfile | null>(null);
  const [context, setContext] = useState<LiffContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const initializeLiff = useCallback(async () => {
    if (!liffId) {
      setError('LIFF IDが設定されていません');
      setIsLoading(false);
      return;
    }

    try {
      if (!window.liff) {
        setError('LIFF SDKが読み込まれていません');
        setIsLoading(false);
        return;
      }

      await window.liff.init({ liffId });
      setIsLiffReady(true);

      const loggedIn = window.liff.isLoggedIn();
      setIsLoggedIn(loggedIn);

      if (loggedIn) {
        const userProfile = await window.liff.getProfile();
        setProfile({
          userId: userProfile.userId,
          displayName: userProfile.displayName,
          pictureUrl: userProfile.pictureUrl
        });
      }

      const liffContext = window.liff.getContext();
      setContext(liffContext);

    } catch (err) {
      console.error('LIFF初期化エラー:', err);
      setError('LIFF初期化に失敗しました');
    } finally {
      setIsLoading(false);
    }
  }, [liffId]);

  const login = useCallback(() => {
    if (window.liff && window.liff.login) {
      window.liff.login();
    } else {
      setError('LIFFログイン機能が利用できません');
    }
  }, []);

  const logout = useCallback(() => {
    if (window.liff && window.liff.logout) {
      window.liff.logout();
      setIsLoggedIn(false);
      setProfile(null);
    }
  }, []);

  const closeWindow = useCallback(() => {
    if (window.liff && window.liff.closeWindow) {
      window.liff.closeWindow();
    }
  }, []);

  const openWindow = useCallback((url: string, external = false) => {
    if (window.liff && window.liff.openWindow) {
      window.liff.openWindow({
        url,
        external
      });
    } else {
      window.open(url, external ? '_blank' : '_self');
    }
  }, []);

  const sendMessages = useCallback((messages: any[]) => {
    if (window.liff && window.liff.sendMessages) {
      return window.liff.sendMessages(messages);
    } else {
      return Promise.reject(new Error('LIFF sendMessages機能が利用できません'));
    }
  }, []);

  const isInClient = useCallback(() => {
    return window.liff && window.liff.isInClient ? window.liff.isInClient() : false;
  }, []);

  const getOS = useCallback(() => {
    return window.liff && window.liff.getOS ? window.liff.getOS() : 'web';
  }, []);

  const getVersion = useCallback(() => {
    return window.liff && window.liff.getVersion ? window.liff.getVersion() : '2.0';
  }, []);

  const getLanguage = useCallback(() => {
    return window.liff && window.liff.getLanguage ? window.liff.getLanguage() : 'ja';
  }, []);

  useEffect(() => {
    // LIFF SDKがロードされるまで待つ
    const checkLiffSDK = () => {
      if (window.liff) {
        initializeLiff();
      } else {
        setTimeout(checkLiffSDK, 100);
      }
    };

    checkLiffSDK();
  }, [initializeLiff]);

  return {
    isLiffReady,
    isLoggedIn,
    profile,
    context,
    error,
    isLoading,
    login,
    logout,
    closeWindow,
    openWindow,
    sendMessages,
    isInClient: isInClient(),
    getOS,
    getVersion,
    getLanguage
  };
};