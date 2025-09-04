/**
 * Enhanced form validation component with security features
 */
import React from 'react';
import { useSecurityContext } from './SecurityProvider';

interface SecureFormValidatorProps {
  children: React.ReactNode;
  onSubmit: (data: Record<string, any>) => Promise<void>;
  formData: Record<string, any>;
  requiredFields?: string[];
  className?: string;
}

export function SecureFormValidator({ 
  children, 
  onSubmit, 
  formData, 
  requiredFields = [],
  className = ''
}: SecureFormValidatorProps) {
  const { sanitizeInput, checkRateLimit, reportSecurityIssue } = useSecurityContext();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Rate limiting check
    const clientId = `form_submit_${window.location.pathname}`;
    if (!checkRateLimit(clientId, 10, 60000)) { // 10 submissions per minute
      reportSecurityIssue('form_rate_limit_exceeded', {
        path: window.location.pathname,
        formData: Object.keys(formData)
      });
      return;
    }

    // Validate and sanitize all form data
    const sanitizedData: Record<string, any> = {};
    let hasSecurityIssues = false;

    for (const [key, value] of Object.entries(formData)) {
      if (typeof value === 'string') {
        const sanitized = sanitizeInput(value, getInputContext(key));
        
        // Check if significant sanitization occurred (potential attack)
        if (sanitized.length < value.length * 0.8) {
          reportSecurityIssue('suspicious_form_input', {
            field: key,
            originalLength: value.length,
            sanitizedLength: sanitized.length,
            reductionRatio: (value.length - sanitized.length) / value.length
          });
          hasSecurityIssues = true;
        }
        
        sanitizedData[key] = sanitized;
      } else {
        sanitizedData[key] = value;
      }
    }

    // Check required fields
    for (const field of requiredFields) {
      if (!sanitizedData[field] || sanitizedData[field].toString().trim().length === 0) {
        throw new Error(`Required field missing: ${field}`);
      }
    }

    // Proceed with submission if no security issues
    if (!hasSecurityIssues) {
      await onSubmit(sanitizedData);
    } else {
      console.warn('Form submission blocked due to security concerns');
    }
  };

  const getInputContext = (fieldName: string): 'html' | 'text' | 'url' | 'email' | 'phone' => {
    const lowercaseField = fieldName.toLowerCase();
    
    if (lowercaseField.includes('email')) return 'email';
    if (lowercaseField.includes('url') || lowercaseField.includes('link')) return 'url';
    if (lowercaseField.includes('phone') || lowercaseField.includes('tel')) return 'phone';
    if (lowercaseField.includes('content') || lowercaseField.includes('description')) return 'html';
    
    return 'text';
  };

  return (
    <form onSubmit={handleSubmit} className={className}>
      {children}
    </form>
  );
}