import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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

    // 1. Get referral count
    const { count: referralCount, error: referralError } = await supabaseClient
      .from('affiliate_referrals')
      .select('*', { count: 'exact', head: true })
      .eq('referrer_id', user.id);

    if (referralError) throw referralError;

    // 2. Get commission stats and recent commissions
    const { data: commissions, error: commissionsError } = await supabaseClient
      .from('affiliate_commissions')
      .select('source_event, amount, status, created_at')
      .eq('affiliate_id', user.id)
      .order('created_at', { ascending: false });

    if (commissionsError) throw commissionsError;

    const stats = {
      pending_amount: 0,
      approved_amount: 0,
      paid_amount: 0,
    };

    for (const commission of commissions) {
      if (commission.status === 'pending') {
        stats.pending_amount += commission.amount;
      } else if (commission.status === 'approved') {
        stats.approved_amount += commission.amount;
      } else if (commission.status === 'paid') {
        stats.paid_amount += commission.amount;
      }
    }

    const recentCommissions = commissions.slice(0, 20); // Return the 20 most recent

    const earningsData = {
      referral_count: referralCount ?? 0,
      stats,
      recent_commissions: recentCommissions,
    };

    return new Response(
      JSON.stringify(earningsData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in get-affiliate-earnings function:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
