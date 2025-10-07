import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Authentication failed');
    }

    const { richMenuId } = await req.json();
    if (!richMenuId) {
      throw new Error('richMenuId is required in the request body.');
    }

    // Get LINE credentials
    const { data: credentials } = await supabase
      .from('secure_line_credentials')
      .select('encrypted_value')
      .eq('user_id', user.id)
      .eq('credential_type', 'channel_access_token')
      .single();

    if (!credentials?.encrypted_value) {
      throw new Error('LINE access token not found in the database.');
    }

    const accessToken = credentials.encrypted_value;

    // Set default rich menu via LINE API
    const setDefaultUrl = `https://api.line.me/v2/bot/user/all/richmenu/${richMenuId}`;
    const setDefaultResponse = await fetch(setDefaultUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!setDefaultResponse.ok) {
      // Create a more descriptive error message for the client
      const errorText = await setDefaultResponse.text();
      const clientError = `Failed to set default menu. The ID '${richMenuId}' was not found by LINE (404). Please verify this ID exists on the LINE platform. Raw response: ${errorText}`;
      console.error(`LINE API Error: ${clientError}`);
      throw new Error(clientError);
    }

    console.log(`Successfully set rich menu ${richMenuId} as default.`);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in set-default-rich-menu:', error.message);
    return new Response(JSON.stringify({ 
      success: false, 
      error: (error as Error)?.message || 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
