/**
 * Enhanced security utilities for input validation and XSS prevention
 */

/**
 * Sanitizes text input to prevent XSS attacks with enhanced protection
 */
export function sanitizeTextInput(input: string | null | undefined): string {
  if (!input) return '';
  
  return input
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: URLs
    .replace(/data:/gi, '') // Remove data: URLs
    .replace(/vbscript:/gi, '') // Remove vbscript: URLs
    .replace(/on\w+\s*=/gi, '') // Remove event handlers like onclick=
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width characters
    .trim()
    .substring(0, 10000); // Increased length limit for legitimate use cases
}

/**
 * Enhanced XSS prevention for rich content
 */
export function sanitizeRichContent(content: string | null | undefined): string {
  if (!content) return '';
  
  // Allow safe HTML tags but remove dangerous attributes and scripts
  return content
    .replace(/<script[^>]*>.*?<\/script>/gis, '') // Remove script tags
    .replace(/<iframe[^>]*>.*?<\/iframe>/gis, '') // Remove iframe tags
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '') // Remove event handlers
    .replace(/javascript:\s*[^"'\s]*/gi, '') // Remove javascript: URLs
    .replace(/vbscript:\s*[^"'\s]*/gi, '') // Remove vbscript: URLs
    .replace(/data:\s*(?!image\/)[^"'\s]*/gi, '') // Remove non-image data: URLs
    .trim();
}

/**
 * Validates display name format
 */
export function validateDisplayName(name: string | null | undefined): boolean {
  if (!name) return false;
  
  const sanitized = sanitizeTextInput(name);
  return sanitized.length >= 1 && sanitized.length <= 100;
}

/**
 * Validates invite code format
 */
export function validateInviteCode(code: string | null | undefined): boolean {
  if (!code) return false;
  
  return /^[a-zA-Z0-9]{8,32}$/.test(code);
}

/**
 * Validates LINE user ID format
 */
export function validateLineUserId(userId: string | null | undefined): boolean {
  if (!userId) return false;
  
  return /^U[0-9a-fA-F]{32}$/.test(userId);
}

/**
 * Validates email format
 */
export function validateEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

/**
 * Validates URL format (for picture URLs, etc.)
 */
export function validateUrl(url: string | null | undefined): boolean {
  if (!url) return true; // URLs are often optional
  
  try {
    new URL(url);
    return url.startsWith('https://') && url.length <= 2048;
  } catch {
    return false;
  }
}

/**
 * Enhanced rate limiting helper with better security and persistence
 */
class SimpleRateLimit {
  private attempts: Map<string, { count: number; resetTime: number; blocked: boolean; blockedUntil?: number }> = new Map();
  private readonly MAX_STORAGE_SIZE = 10000; // Prevent memory exhaustion
  private readonly PROGRESSIVE_BACKOFF = [1000, 5000, 15000, 60000, 300000]; // Progressive timeouts in ms
  
  isAllowed(key: string, maxAttempts: number, windowMs: number): boolean {
    const now = Date.now();
    
    // Clean up old entries periodically to prevent memory leaks
    if (this.attempts.size > this.MAX_STORAGE_SIZE) {
      this.cleanup(now);
    }
    
    const record = this.attempts.get(key);
    
    // Check if still blocked from progressive backoff
    if (record?.blockedUntil && now < record.blockedUntil) {
      return false;
    }
    
    if (!record || now > record.resetTime) {
      this.attempts.set(key, { count: 1, resetTime: now + windowMs, blocked: false });
      return true;
    }
    
    if (record.blocked || record.count >= maxAttempts) {
      // Apply progressive backoff
      const backoffIndex = Math.min(record.count - maxAttempts, this.PROGRESSIVE_BACKOFF.length - 1);
      const backoffTime = this.PROGRESSIVE_BACKOFF[backoffIndex] || 300000; // Default 5 minutes
      
      record.blocked = true;
      record.blockedUntil = now + backoffTime;
      
      // Log security event for potential attacks
      this.logSecurityEvent(key, record.count, backoffTime);
      return false;
    }
    
    record.count++;
    return true;
  }
  
  private cleanup(now: number): void {
    for (const [key, record] of this.attempts.entries()) {
      if (now > record.resetTime && (!record.blockedUntil || now > record.blockedUntil)) {
        this.attempts.delete(key);
      }
    }
  }
  
  private logSecurityEvent(key: string, attempts: number, backoffTime: number): void {
    // Log to console for now, could be extended to send to monitoring service
    console.warn(`Rate limit exceeded for ${key}: ${attempts} attempts, blocked for ${backoffTime}ms`);
    
    // Store in localStorage for client-side monitoring (optional)
    try {
      const events = JSON.parse(localStorage.getItem('security_events') || '[]');
      events.push({
        type: 'rate_limit_exceeded',
        key,
        attempts,
        timestamp: Date.now(),
        backoffTime
      });
      
      // Keep only last 100 events
      if (events.length > 100) {
        events.splice(0, events.length - 100);
      }
      
      localStorage.setItem('security_events', JSON.stringify(events));
    } catch (error) {
      // Ignore localStorage errors
    }
  }
  
  block(key: string, duration: number = 300000): void {
    const now = Date.now();
    const record = this.attempts.get(key) || { count: 0, resetTime: now, blocked: false };
    record.blocked = true;
    record.blockedUntil = now + duration;
    this.attempts.set(key, record);
  }
  
  unblock(key: string): void {
    const record = this.attempts.get(key);
    if (record) {
      record.blocked = false;
      record.blockedUntil = undefined;
    }
  }
  
  getStatus(key: string): { blocked: boolean; attempts: number; blockedUntil?: number } {
    const record = this.attempts.get(key);
    return {
      blocked: record?.blocked || false,
      attempts: record?.count || 0,
      blockedUntil: record?.blockedUntil
    };
  }
}

export const rateLimit = new SimpleRateLimit();

/**
 * Enhanced content security policy validation
 */
export function validateContentSecurityPolicy(content: string): boolean {
  const dangerousPatterns = [
    /javascript:/gi,
    /data:(?!image\/)/gi, // Allow data: URLs only for images
    /vbscript:/gi,
    /on\w+\s*=/gi,
    /<script/gi,
    /<iframe/gi,
    /<object/gi,
    /<embed/gi,
    /<link/gi,
    /<meta/gi,
    /eval\s*\(/gi,
    /Function\s*\(/gi,
    /setTimeout\s*\(/gi,
    /setInterval\s*\(/gi
  ];
  
  return !dangerousPatterns.some(pattern => pattern.test(content));
}

/**
 * Secure token validation for client-side use
 */
export function validateAuthToken(token: string | null | undefined): boolean {
  if (!token) return false;
  
  // Basic JWT format validation
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  
  try {
    // Validate base64 encoding of header and payload
    atob(parts[0]);
    atob(parts[1]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Advanced input validation with context-aware sanitization
 */
export function validateAndSanitizeInput(
  input: string | null | undefined,
  context: 'html' | 'text' | 'url' | 'email' | 'phone' = 'text',
  maxLength: number = 1000
): { isValid: boolean; sanitized: string; errors: string[] } {
  const errors: string[] = [];
  
  if (!input) {
    return { isValid: false, sanitized: '', errors: ['Input is required'] };
  }
  
  let sanitized = input.trim();
  
  // Context-specific validation and sanitization
  switch (context) {
    case 'html':
      sanitized = sanitizeRichContent(sanitized);
      if (!validateContentSecurityPolicy(sanitized)) {
        errors.push('Content contains dangerous patterns');
      }
      break;
      
    case 'url':
      if (!validateUrl(sanitized)) {
        errors.push('Invalid URL format');
      }
      break;
      
    case 'email':
      if (!validateEmail(sanitized)) {
        errors.push('Invalid email format');
      }
      break;
      
    case 'phone':
      // Basic phone number validation
      sanitized = sanitized.replace(/[^0-9+\-\s()]/g, '');
      if (sanitized.length < 10 || sanitized.length > 20) {
        errors.push('Invalid phone number format');
      }
      break;
      
    default:
      sanitized = sanitizeTextInput(sanitized);
  }
  
  // Length validation
  if (sanitized.length > maxLength) {
    errors.push(`Input exceeds maximum length of ${maxLength} characters`);
    sanitized = sanitized.substring(0, maxLength);
  }
  
  return {
    isValid: errors.length === 0,
    sanitized,
    errors
  };
}

/**
 * Security event logger for client-side monitoring
 */
export function logSecurityEvent(
  eventType: string,
  details: Record<string, any> = {},
  severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
): void {
  const event = {
    type: eventType,
    details,
    severity,
    timestamp: Date.now(),
    url: window.location.href,
    userAgent: navigator.userAgent
  };
  
  // Log to console with appropriate level
  const logLevel = severity === 'critical' || severity === 'high' ? 'error' : 'warn';
  console[logLevel](`Security Event [${severity.toUpperCase()}]:`, event);
  
  // Store in localStorage for monitoring
  try {
    const events = JSON.parse(localStorage.getItem('security_events') || '[]');
    events.push(event);
    
    // Keep only last 50 events to prevent storage bloat
    if (events.length > 50) {
      events.splice(0, events.length - 50);
    }
    
    localStorage.setItem('security_events', JSON.stringify(events));
  } catch (error) {
    console.warn('Failed to store security event:', error);
  }
  
  // For critical events, consider sending to monitoring service
  if (severity === 'critical') {
    // This could be extended to send to external monitoring
    console.error('CRITICAL SECURITY EVENT:', event);
  }
}

/**
 * Get security event history for monitoring dashboard
 */
export function getSecurityEvents(): Array<{
  type: string;
  details: Record<string, any>;
  severity: string;
  timestamp: number;
  url: string;
  userAgent: string;
}> {
  try {
    return JSON.parse(localStorage.getItem('security_events') || '[]');
  } catch {
    return [];
  }
}

/**
 * Clear security event history
 */
export function clearSecurityEvents(): void {
  try {
    localStorage.removeItem('security_events');
  } catch (error) {
    console.warn('Failed to clear security events:', error);
  }
}