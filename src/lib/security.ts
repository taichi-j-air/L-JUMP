/**
 * Security utilities for input validation and XSS prevention
 */

/**
 * Sanitizes text input to prevent XSS attacks
 */
export function sanitizeTextInput(input: string | null | undefined): string {
  if (!input) return '';
  
  return input
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: URLs
    .replace(/data:/gi, '') // Remove data: URLs
    .replace(/vbscript:/gi, '') // Remove vbscript: URLs
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
 * Rate limiting helper (simple in-memory implementation)
 */
class SimpleRateLimit {
  private attempts: Map<string, { count: number; resetTime: number }> = new Map();
  
  isAllowed(key: string, maxAttempts: number, windowMs: number): boolean {
    const now = Date.now();
    const record = this.attempts.get(key);
    
    if (!record || now > record.resetTime) {
      this.attempts.set(key, { count: 1, resetTime: now + windowMs });
      return true;
    }
    
    if (record.count >= maxAttempts) {
      return false;
    }
    
    record.count++;
    return true;
  }
}

export const rateLimit = new SimpleRateLimit();