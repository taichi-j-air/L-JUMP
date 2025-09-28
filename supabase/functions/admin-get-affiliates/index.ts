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

    // 1. Fetch all affiliates and their rank
    const { data: affiliates, error: affiliatesError } = await supabaseClient
      .from('profiles')
      .select('user_id, email, full_name, affiliate_ranks ( rank_name )')
      .not('affiliate_rank_id', 'is', null);

    if (affiliatesError) throw affiliatesError;

    // 2. Fetch all referrals
    const { data: referrals, error: referralsError } = await supabaseClient
      .from('affiliate_referrals')
      .select('referrer_id');

    if (referralsError) throw referralsError;

    // 3. Fetch all commissions
    const { data: commissions, error: commissionsError } = await supabaseClient
      .from('affiliate_commissions')
      .select('affiliate_id, amount');

    if (commissionsError) throw commissionsError;

    // 4. Aggregate data in code
    const referralCountMap = new Map<string, number>();
    for (const referral of referrals) {
      referralCountMap.set(referral.referrer_id, (referralCountMap.get(referral.referrer_id) || 0) + 1);
    }

    const commissionSumMap = new Map<string, number>();
    for (const commission of commissions) {
      commissionSumMap.set(commission.affiliate_id, (commissionSumMap.get(commission.affiliate_id) || 0) + commission.amount);
    }

    // 5. Combine data
    const results = affiliates.map(affiliate => ({
      ...affiliate,
      referral_count: referralCountMap.get(affiliate.user_id) || 0,
      total_earnings: commissionSumMap.get(affiliate.user_id) || 0,
    }));

    return new Response(
      JSON.stringify({ affiliates: results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in admin-get-affiliates function:', error);
    return new Response(JSON.stringify({ error: 'Internal server error', details: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
