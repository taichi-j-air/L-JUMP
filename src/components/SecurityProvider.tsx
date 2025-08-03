/**
 * Security Provider Component for application-wide security features
 */
import React, { createContext, useContext, useEffect, useState } from 'react';
import { sanitizeTextInput, validateContentSecurityPolicy, rateLimit } from '@/lib/security';

interface SecurityContextType {
  sanitizeInput: (input: string) => string;
  validateContent: (content: string) => boolean;
  checkRateLimit: (key: string, max: number, window: number) => boolean;
  reportSecurityIssue: (issue: string, details?: any) => void;
}

const SecurityContext = createContext<SecurityContextType | null>(null);

export function useSecurityContext() {
  const context = useContext(SecurityContext);
  if (!context) {
    throw new Error('useSecurityContext must be used within SecurityProvider');
  }
  return context;
}

interface SecurityProviderProps {
  children: React.ReactNode;
}

export function SecurityProvider({ children }: SecurityProviderProps) {
  const [securityEvents, setSecurityEvents] = useState<string[]>([]);

  const sanitizeInput = (input: string): string => {
    return sanitizeTextInput(input);
  };

  const validateContent = (content: string): boolean => {
    return validateContentSecurityPolicy(content);
  };

  const checkRateLimit = (key: string, max: number, window: number): boolean => {
    return rateLimit.isAllowed(key, max, window);
  };

  const reportSecurityIssue = (issue: string, details?: any) => {
    console.warn('Security Issue:', issue, details);
    setSecurityEvents(prev => [...prev.slice(-50), issue]); // Keep last 50 events
    
    // In production, you might want to send this to a security monitoring service
  };

  // Set up Content Security Policy
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.httpEquiv = 'Content-Security-Policy';
    meta.content = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com https://esm.sh https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://rtjxurmuaawyzjcdkqxt.supabase.co wss://rtjxurmuaawyzjcdkqxt.supabase.co;";
    document.head.appendChild(meta);

    return () => {
      document.head.removeChild(meta);
    };
  }, []);

  // Monitor for potential XSS attempts
  useEffect(() => {
    const handleDOMChange = (mutations: MutationRecord[]) => {
      mutations.forEach(mutation => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element;
              if (element.tagName === 'SCRIPT' && !element.getAttribute('data-approved')) {
                reportSecurityIssue('Unauthorized script injection detected', {
                  tag: element.tagName,
                  src: element.getAttribute('src'),
                  content: element.textContent?.substring(0, 100)
                });
              }
            }
          });
        }
      });
    };

    const observer = new MutationObserver(handleDOMChange);
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    return () => observer.disconnect();
  }, []);

  const contextValue: SecurityContextType = {
    sanitizeInput,
    validateContent,
    checkRateLimit,
    reportSecurityIssue
  };

  return (
    <SecurityContext.Provider value={contextValue}>
      {children}
    </SecurityContext.Provider>
  );
}