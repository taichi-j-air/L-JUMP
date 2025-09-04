import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0'
import { 
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
    const isAllowed = await rateLimiter.isAllowed(`decrypt:${clientIP}`, 5, 60000) // 5 requests per minute
    
    if (!isAllowed) {
      return createErrorResponse('Too many decryption requests. Please try again later.', 429)
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

    const { encryptedValue } = await req.json()
    validateRequiredParams({ encryptedValue }, ['encryptedValue'])

    // Validate encrypted value format
    if (!encryptedValue.startsWith('enc:')) {
      return createErrorResponse('Invalid encrypted value format', 400)
    }

    try {
      // Parse the encrypted data
      const encryptedData = atob(encryptedValue.substring(4))
      const combinedArray = new Uint8Array(encryptedData.length)
      for (let i = 0; i < encryptedData.length; i++) {
        combinedArray[i] = encryptedData.charCodeAt(i)
      }

      // Extract IV and encrypted content
      const iv = combinedArray.slice(0, 12)
      const encrypted = combinedArray.slice(12)

      // Recreate the user's encryption key
      const userKey = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(user.id.substring(0, 32).padEnd(32, '0')),
        { name: 'AES-GCM' },
        false,
        ['encrypt', 'decrypt']
      )

      // Decrypt the credential
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        userKey,
        encrypted
      )

      const decryptedValue = new TextDecoder().decode(decrypted)

      // Log the decryption event for security monitoring
      await supabase.from('security_events_log').insert({
        user_id: user.id,
        event_type: 'credential_decrypted',
        details: {
          timestamp: new Date().toISOString(),
          ip_address: clientIP,
          user_agent: req.headers.get('user-agent')
        }
      })

      return new Response(
        JSON.stringify({ decryptedValue }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      )

    } catch (decryptError) {
      console.error('Decryption failed:', decryptError)
      return createErrorResponse('Failed to decrypt credential', 400)
    }

  } catch (error) {
    console.error('Decryption error:', error)
    return createErrorResponse('Decryption failed', 500)
  }
})