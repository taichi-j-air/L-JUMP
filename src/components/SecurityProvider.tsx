/**
 * Enhanced Security Provider Component for application-wide security features
 */
import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  sanitizeTextInput, 
  validateContentSecurityPolicy, 
  rateLimit,
  validateAndSanitizeInput,
  logSecurityEvent 
} from '@/lib/security';
import { useSecurityMonitoring } from '@/hooks/useSecurityMonitoring';

interface SecurityContextType {
  sanitizeInput: (input: string, context?: 'html' | 'text' | 'url' | 'email' | 'phone') => string;
  sanitizeRichInput: (input: string) => string;
  validateContent: (content: string) => boolean;
  checkRateLimit: (key: string, max: number, window: number) => boolean;
  reportSecurityIssue: (issue: string, details?: any) => void;
  securityStatus: {
    isSecure: boolean;
    threats: Array<{
      type: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      message: string;
      timestamp: number;
    }>;
    rateLimit: {
      blocked: boolean;
      attempts: number;
      blockedUntil?: number;
    };
  };
  validateAuthSecurity: () => Promise<boolean>;
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
  const { 
    securityStatus, 
    validateAuthSecurity, 
    reportSuspiciousActivity 
  } = useSecurityMonitoring();

  const sanitizeInput = (input: string, context: 'html' | 'text' | 'url' | 'email' | 'phone' = 'text'): string => {
    const result = validateAndSanitizeInput(input, context);
    
    if (!result.isValid) {
      reportSuspiciousActivity('input_validation_failed', {
        context,
        errors: result.errors,
        originalLength: input?.length || 0
      }, 'medium');
    }
    
    return result.sanitized;
  };

  const sanitizeRichInput = (input: string): string => {
    // Enhanced sanitization for rich content
    if (!input) return '';
    
    const sanitized = input
      .replace(/<script[^>]*>.*?<\/script>/gis, '') // Remove script tags
      .replace(/<iframe[^>]*>.*?<\/iframe>/gis, '') // Remove iframe tags
      .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '') // Remove event handlers
      .replace(/javascript:\s*[^"'\s]*/gi, '') // Remove javascript: URLs
      .replace(/vbscript:\s*[^"'\s]*/gi, '') // Remove vbscript: URLs
      .replace(/data:\s*(?!image\/)[^"'\s]*/gi, '') // Remove non-image data: URLs
      .trim();
    
    // Check if content was modified (potential XSS attempt)
    if (sanitized.length < input.length * 0.9) {
      reportSuspiciousActivity('potential_xss_attempt', {
        originalLength: input.length,
        sanitizedLength: sanitized.length,
        reductionPercentage: ((input.length - sanitized.length) / input.length) * 100
      }, 'high');
    }
    
    return sanitized;
  };

  const validateContent = (content: string): boolean => {
    const isValid = validateContentSecurityPolicy(content);
    
    if (!isValid) {
      reportSuspiciousActivity('csp_violation', {
        contentLength: content.length,
        contentPreview: content.substring(0, 100)
      }, 'high');
    }
    
    return isValid;
  };

  const checkRateLimit = (key: string, max: number, window: number): boolean => {
    return rateLimit.isAllowed(key, max, window);
  };

  const reportSecurityIssue = (issue: string, details?: any) => {
    logSecurityEvent(issue, details, 'medium');
    setSecurityEvents(prev => [...prev.slice(-50), issue]); // Keep last 50 events
    
    // Use the enhanced monitoring system
    reportSuspiciousActivity(issue, details, 'medium');
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
    sanitizeRichInput,
    validateContent,
    checkRateLimit,
    reportSecurityIssue,
    securityStatus,
    validateAuthSecurity
  };

  return (
    <SecurityContext.Provider value={contextValue}>
      {children}
    </SecurityContext.Provider>
  );
}