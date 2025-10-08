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
    if (!authHeader) throw new Error('No authorization header');
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error('Authentication failed');

    const { userId } = await req.json();
    if (!userId) throw new Error('userId is required.');

    const { data: credentials, error: credsError } = await supabase.from('secure_line_credentials').select('encrypted_value').eq('user_id', user.id).eq('credential_type', 'channel_access_token').single();
    if (credsError || !credentials) throw new Error('LINE access token not found.');
    const accessToken = credentials.encrypted_value;

    const getUrl = `https://api.line.me/v2/bot/user/${userId}/richmenu`;
    const getResponse = await fetch(getUrl, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (!getResponse.ok) {
      // A 404 is a valid response meaning no menu is linked, so we must handle it gracefully.
      if (getResponse.status === 404) {
        return new Response(JSON.stringify({ message: 'No rich menu linked to this user.' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`LINE API error (getting user menu): ${await getResponse.text()}`);
    }

    const responseData = await getResponse.json();

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: (error as Error)?.message || 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
