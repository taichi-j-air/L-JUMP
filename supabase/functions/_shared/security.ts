/**
 * Shared security utilities for Supabase Edge Functions
 * Provides input validation, sanitization, and rate limiting
 */

// Input validation utilities
export function validateLineUserId(userId: string | null | undefined): boolean {
  if (!userId) return false;
  return /^U[0-9a-fA-F]{32}$/.test(userId);
}

export function validateInviteCode(code: string | null | undefined): boolean {
  if (!code) return false;
  return /^[a-zA-Z0-9]{8,32}$/.test(code);
}

export function validateEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

export function validateUrl(url: string | null | undefined): boolean {
  if (!url) return true; // URLs are often optional
  
  try {
    new URL(url);
    return url.startsWith('https://') && url.length <= 2048;
  } catch {
    return false;
  }
}

// Text sanitization
export function sanitizeTextInput(input: string | null | undefined): string {
  if (!input) return '';
  
  return input
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: URLs
    .replace(/data:/gi, '') // Remove data: URLs
    .replace(/vbscript:/gi, '') // Remove vbscript: URLs
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim()
    .substring(0, 1000); // Reasonable length limit
}

export function validateDisplayName(name: string | null | undefined): boolean {
  if (!name) return false;
  
  const sanitized = sanitizeTextInput(name);
  return sanitized.length >= 1 && sanitized.length <= 100;
}

// Rate limiting using Deno KV (when available) or in-memory fallback
class RateLimiter {
  private memoryStore = new Map<string, { count: number; resetTime: number }>();

  async isAllowed(key: string, maxAttempts: number, windowMs: number): Promise<boolean> {
    const now = Date.now();
    
    try {
      // Try to use Deno KV if available
      const kv = await Deno.openKv();
      const result = await kv.get([key]);
      const record = result.value as { count: number; resetTime: number } | null;
      
      if (!record || now > record.resetTime) {
        await kv.set([key], { count: 1, resetTime: now + windowMs }, { expireIn: windowMs });
        return true;
      }
      
      if (record.count >= maxAttempts) {
        return false;
      }
      
      await kv.set([key], { count: record.count + 1, resetTime: record.resetTime }, { expireIn: windowMs });
      return true;
    } catch {
      // Fallback to in-memory store
      const record = this.memoryStore.get(key);
      
      if (!record || now > record.resetTime) {
        this.memoryStore.set(key, { count: 1, resetTime: now + windowMs });
        return true;
      }
      
      if (record.count >= maxAttempts) {
        return false;
      }
      
      record.count++;
      return true;
    }
  }
}

export const rateLimiter = new RateLimiter();

// Request validation utilities
export function validateRequiredParams(params: Record<string, any>, required: string[]): void {
  for (const param of required) {
    if (!params[param]) {
      throw new Error(`Missing required parameter: ${param}`);
    }
  }
}

export function createSecureHeaders(additionalHeaders: Record<string, string> = {}): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    ...additionalHeaders
  };
}

// Error handling utilities
export function createErrorResponse(message: string, status: number = 400): Response {
  console.error('Security Error:', message);
  return new Response(
    JSON.stringify({ error: message }),
    { 
      status,
      headers: createSecureHeaders({ 'Content-Type': 'application/json' })
    }
  );
}

// Authentication helpers
export function extractUserIdFromAuth(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  try {
    // Basic JWT structure validation (for more robust validation, use a proper JWT library)
    const token = authHeader.replace('Bearer ', '');
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    return token; // Return the token for Supabase to validate
  } catch {
    return null;
  }
}

// Prevent timing attacks
export async function secureCompare(a: string, b: string): Promise<boolean> {
  if (a.length !== b.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  
  // Add a small random delay to prevent timing analysis
  await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
  
  return result === 0;
}