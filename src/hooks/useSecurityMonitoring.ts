/**
 * Security monitoring hook for tracking and responding to security events
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  rateLimit, 
  logSecurityEvent, 
  getSecurityEvents, 
  clearSecurityEvents,
  validateAuthToken 
} from '@/lib/security';
import { useToast } from '@/hooks/use-toast';

interface SecurityStatus {
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
}

export function useSecurityMonitoring() {
  const [securityStatus, setSecurityStatus] = useState<SecurityStatus>({
    isSecure: true,
    threats: [],
    rateLimit: { blocked: false, attempts: 0 }
  });
  const { toast } = useToast();

  // Monitor security events
  const updateSecurityStatus = useCallback(() => {
    const events = getSecurityEvents();
    const clientId = getClientIdentifier();
    const rateLimitStatus = rateLimit.getStatus(clientId);
    
    // Analyze recent threats (last 24 hours)
    const recentThreats = events
      .filter(event => Date.now() - event.timestamp < 24 * 60 * 60 * 1000)
      .map(event => ({
        type: event.type,
        severity: event.severity as 'low' | 'medium' | 'high' | 'critical',
        message: getThreatMessage(event.type, event.details),
        timestamp: event.timestamp
      }));

    const isSecure = !recentThreats.some(threat => 
      threat.severity === 'critical' || threat.severity === 'high'
    ) && !rateLimitStatus.blocked;

    setSecurityStatus({
      isSecure,
      threats: recentThreats,
      rateLimit: rateLimitStatus
    });
  }, []);

  // Validate authentication security
  const validateAuthSecurity = useCallback(async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        logSecurityEvent('auth_validation_error', { error: error.message }, 'high');
        return false;
      }

      if (session?.access_token) {
        const isValidToken = validateAuthToken(session.access_token);
        if (!isValidToken) {
          logSecurityEvent('invalid_auth_token', { 
            tokenLength: session.access_token.length 
          }, 'critical');
          return false;
        }
      }

      return true;
    } catch (error: any) {
      logSecurityEvent('auth_security_check_failed', { 
        error: error.message 
      }, 'high');
      return false;
    }
  }, []);

  // Check for rate limiting
  const checkRateLimit = useCallback((action: string, maxAttempts: number = 10): boolean => {
    const clientId = getClientIdentifier();
    const key = `${clientId}:${action}`;
    const isAllowed = rateLimit.isAllowed(key, maxAttempts, 60000); // 1 minute window

    if (!isAllowed) {
      logSecurityEvent('rate_limit_exceeded', { 
        action,
        clientId: clientId.substring(0, 8) + '...' // Partial ID for privacy
      }, 'medium');
      
      toast({
        title: "Rate limit exceeded",
        description: "Too many attempts. Please wait before trying again.",
        variant: "destructive",
      });
    }

    return isAllowed;
  }, [toast]);

  // Log suspicious activity
  const reportSuspiciousActivity = useCallback((
    activityType: string,
    details: Record<string, any> = {},
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ) => {
    logSecurityEvent(activityType, {
      ...details,
      userAgent: navigator.userAgent,
      timestamp: Date.now(),
      url: window.location.href
    }, severity);

    if (severity === 'critical' || severity === 'high') {
      toast({
        title: "Security Alert",
        description: "Suspicious activity detected. Please contact support if you believe this is an error.",
        variant: "destructive",
      });
    }

    updateSecurityStatus();
  }, [toast, updateSecurityStatus]);

  // Clear security events
  const clearSecurityHistory = useCallback(() => {
    clearSecurityEvents();
    updateSecurityStatus();
    toast({
      title: "Security History Cleared",
      description: "All security events have been cleared.",
    });
  }, [updateSecurityStatus, toast]);

  // Auto-update security status
  useEffect(() => {
    updateSecurityStatus();
    
    // Update every 30 seconds
    const interval = setInterval(updateSecurityStatus, 30000);
    
    return () => clearInterval(interval);
  }, [updateSecurityStatus]);

  // Monitor for suspicious browser behavior
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        logSecurityEvent('page_hidden', { timestamp: Date.now() }, 'low');
      }
    };

    const handleBeforeUnload = () => {
      logSecurityEvent('page_unload', { timestamp: Date.now() }, 'low');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  return {
    securityStatus,
    validateAuthSecurity,
    checkRateLimit,
    reportSuspiciousActivity,
    clearSecurityHistory,
    updateSecurityStatus
  };
}

// Helper functions
function getClientIdentifier(): string {
  // Create a consistent client identifier without using permanent tracking
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('Security fingerprint', 2, 2);
    return canvas.toDataURL().substring(0, 32);
  }
  
  // Fallback to a combination of screen and browser info
  return btoa(
    navigator.userAgent.substring(0, 20) +
    screen.width +
    screen.height +
    new Date().getTimezoneOffset()
  ).substring(0, 32);
}

function getThreatMessage(type: string, details: Record<string, any>): string {
  const messages: Record<string, string> = {
    'rate_limit_exceeded': 'Too many requests detected',
    'invalid_auth_token': 'Invalid authentication token detected',
    'suspicious_form_submission': 'Suspicious form submission blocked',
    'xss_attempt': 'Cross-site scripting attempt blocked',
    'auth_validation_error': 'Authentication validation failed',
    'unauthorized_access_attempt': 'Unauthorized access attempt',
    'credential_access': 'Credential access logged',
    'data_exposure_attempt': 'Potential data exposure blocked'
  };
  
  return messages[type] || `Security event: ${type}`;
}