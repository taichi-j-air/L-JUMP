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
    .substring(0, 1000); // Reasonable length limit
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
 * Enhanced rate limiting helper with better security
 */
class SimpleRateLimit {
  private attempts: Map<string, { count: number; resetTime: number; blocked: boolean }> = new Map();
  private readonly MAX_STORAGE_SIZE = 10000; // Prevent memory exhaustion
  
  isAllowed(key: string, maxAttempts: number, windowMs: number): boolean {
    const now = Date.now();
    
    // Clean up old entries periodically to prevent memory leaks
    if (this.attempts.size > this.MAX_STORAGE_SIZE) {
      this.cleanup(now);
    }
    
    const record = this.attempts.get(key);
    
    if (!record || now > record.resetTime) {
      this.attempts.set(key, { count: 1, resetTime: now + windowMs, blocked: false });
      return true;
    }
    
    if (record.blocked || record.count >= maxAttempts) {
      record.blocked = true;
      return false;
    }
    
    record.count++;
    return true;
  }
  
  private cleanup(now: number): void {
    for (const [key, record] of this.attempts.entries()) {
      if (now > record.resetTime) {
        this.attempts.delete(key);
      }
    }
  }
  
  block(key: string): void {
    const record = this.attempts.get(key);
    if (record) {
      record.blocked = true;
    }
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