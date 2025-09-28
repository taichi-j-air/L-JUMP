import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Function to check for admin privileges
const isAdmin = async (supabaseClient: any, userId: string): Promise<boolean> => {
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('user_role')
    .eq('user_id', userId)
    .single();
  if (error) {
    console.error('Error fetching user role:', error);
    return false;
  }
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

    // Check if the user is an admin
    const userIsAdmin = await isAdmin(supabaseClient, user.id);
    if (!userIsAdmin) {
      return new Response(JSON.stringify({ error: 'Permission denied. Admin access required.' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const rank = await req.json();

    // Validate rank data (basic)
    if (!rank || !rank.rank_name) {
        return new Response(JSON.stringify({ error: 'Rank name is required.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { error: upsertError } = await supabaseClient
      .from('affiliate_ranks')
      .upsert(rank);

    if (upsertError) {
      console.error('Error upserting affiliate rank:', upsertError);
      return new Response(JSON.stringify({ error: 'Failed to save affiliate rank.', details: upsertError.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error) {
    console.error('Error in admin-update-affiliate-rank function:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
