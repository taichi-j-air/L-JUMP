import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== SIMPLE LOGIN CALLBACK DEBUG ===')
    console.log('Request URL:', req.url)
    console.log('Request Method:', req.method)
    console.log('Request Headers:', Object.fromEntries(req.headers.entries()))
    
    const url = new URL(req.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const error = url.searchParams.get('error')
    const errorDescription = url.searchParams.get('error_description')
    
    console.log('Query Params:', { 
      code: code?.substring(0, 10) + '...', 
      state, 
      error, 
      errorDescription,
      allParams: Object.fromEntries(url.searchParams.entries())
    })
    
    // エラーがある場合
    if (error) {
      console.error('LINE Auth Error:', error, errorDescription)
      return new Response(null, {
        status: 302,
        headers: { 
          ...corsHeaders,
          'Location': `https://74048ab5-8d5a-425a-ab29-bd5cc50dc2fe.lovableproject.com/?debug=line_error&error=${error}&description=${encodeURIComponent(errorDescription || '')}`
        }
      })
    }
    
    // 成功の場合（簡易版）
    if (code) {
      console.log('Success - Code received:', code?.substring(0, 10) + '...')
      console.log('State received:', state)
      return new Response(null, {
        status: 302,
        headers: { 
          ...corsHeaders,
          'Location': `https://74048ab5-8d5a-425a-ab29-bd5cc50dc2fe.lovableproject.com/?debug=line_success&code=${code?.substring(0, 10)}&state=${state || 'none'}`
        }
      })
    }
    
    // その他の場合
    console.log('No code or error received')
    console.log('All query parameters:', Object.fromEntries(url.searchParams.entries()))
    return new Response(null, {
      status: 302,
      headers: { 
        ...corsHeaders,
        'Location': `https://74048ab5-8d5a-425a-ab29-bd5cc50dc2fe.lovableproject.com/?debug=no_params&url=${encodeURIComponent(req.url)}`
      }
    })
    
  } catch (err) {
    console.error('Function Error:', err)
    console.error('Error stack:', err.stack)
    return new Response(null, {
      status: 302,
      headers: { 
        ...corsHeaders,
        'Location': `https://74048ab5-8d5a-425a-ab29-bd5cc50dc2fe.lovableproject.com/?debug=function_error&message=${encodeURIComponent(err.message)}`
      }
    })
  }
})