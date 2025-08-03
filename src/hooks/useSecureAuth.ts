/**
 * Secure authentication hook with enhanced security features
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { validateAuthToken } from '@/lib/security';
import type { User } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  isValidSession: boolean;
}

export function useSecureAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
    isValidSession: false
  });

  useEffect(() => {
    let mounted = true;

    const validateSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Session validation error:', error);
          if (mounted) {
            setAuthState({
              user: null,
              loading: false,
              error: error.message,
              isValidSession: false
            });
          }
          return;
        }

        const isValid = session?.access_token ? validateAuthToken(session.access_token) : false;
        
        if (mounted) {
          setAuthState({
            user: session?.user || null,
            loading: false,
            error: null,
            isValidSession: isValid && !!session
          });
        }
      } catch (err) {
        console.error('Auth validation error:', err);
        if (mounted) {
          setAuthState({
            user: null,
            loading: false,
            error: 'Authentication validation failed',
            isValidSession: false
          });
        }
      }
    };

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event);
        
        const isValid = session?.access_token ? validateAuthToken(session.access_token) : false;
        
        if (mounted) {
          setAuthState({
            user: session?.user || null,
            loading: false,
            error: null,
            isValidSession: isValid && !!session
          });
        }

        // Log security events
        if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
          console.log(`Security event: ${event}`);
        }
      }
    );

    validateSession();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        setAuthState(prev => ({ ...prev, error: error.message }));
      }
    } catch (err) {
      console.error('Sign out error:', err);
      setAuthState(prev => ({ ...prev, error: 'Sign out failed' }));
    }
  };

  return {
    ...authState,
    signOut
  };
}