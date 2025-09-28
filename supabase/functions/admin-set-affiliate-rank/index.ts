import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const isAdmin = async (supabaseClient: any, userId: string): Promise<boolean> => {
  const { data, error } = await supabaseClient.from('profiles').select('user_role').eq('user_id', userId).single();
  if (error) return false;
  return data.user_role === 'admin' || data.user_role === 'developer';
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (!await isAdmin(supabaseClient, user.id)) {
      return new Response(JSON.stringify({ error: 'Permission denied.' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { user_id, rank_id } = await req.json();

    if (!user_id || rank_id === undefined) {
        return new Response(JSON.stringify({ error: 'user_id and rank_id are required.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { error: updateError } = await supabaseClient
      .from('profiles')
      .update({ affiliate_rank_id: rank_id })
      .eq('user_id', user_id);

    if (updateError) {
      console.error('Error updating affiliate rank:', updateError);
      return new Response(JSON.stringify({ error: 'Failed to update affiliate rank.', details: updateError.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error) {
    console.error('Error in admin-set-affiliate-rank function:', error);
    return new Response(JSON.stringify({ error: 'Internal server error', details: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
