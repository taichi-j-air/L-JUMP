import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0'
import { 
  sanitizeTextInput, 
  validateRequiredParams, 
  createSecureHeaders, 
  createErrorResponse,
  rateLimiter
} from '../_shared/security.ts'

const corsHeaders = createSecureHeaders()

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Rate limiting
    const clientIP = req.headers.get('x-forwarded-for') || 'unknown'
    const isAllowed = await rateLimiter.isAllowed(`encrypt:${clientIP}`, 10, 60000) // 10 requests per minute
    
    if (!isAllowed) {
      return createErrorResponse('Too many encryption requests. Please try again later.', 429)
    }

    // Validate authentication
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return createErrorResponse('Authentication required', 401)
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verify the user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      return createErrorResponse('Invalid authentication', 401)
    }

    const { value } = await req.json()
    validateRequiredParams({ value }, ['value'])

    // Sanitize input
    const sanitizedValue = sanitizeTextInput(value)
    if (!sanitizedValue || sanitizedValue.length === 0) {
      return createErrorResponse('Invalid credential value', 400)
    }

    // Use a consistent encryption key for the user (derived from their ID)
    // In production, use proper key management service
    const userKey = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(user.id.substring(0, 32).padEnd(32, '0')),
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt']
    )

    // Generate random IV
    const iv = crypto.getRandomValues(new Uint8Array(12))
    
    // Encrypt the credential
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      userKey,
      new TextEncoder().encode(sanitizedValue)
    )

    // Combine IV and encrypted data
    const encryptedArray = new Uint8Array(encrypted)
    const combinedArray = new Uint8Array(iv.length + encryptedArray.length)
    combinedArray.set(iv)
    combinedArray.set(encryptedArray, iv.length)

    const encryptedValue = 'enc:' + btoa(String.fromCharCode(...combinedArray))

    // Log the encryption event for security monitoring
    await supabase.from('security_events_log').insert({
      user_id: user.id,
      event_type: 'credential_encrypted',
      details: {
        timestamp: new Date().toISOString(),
        ip_address: clientIP,
        user_agent: req.headers.get('user-agent')
      }
    })

    return new Response(
      JSON.stringify({ encryptedValue }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    console.error('Encryption error:', error)
    return createErrorResponse('Encryption failed', 500)
  }
})