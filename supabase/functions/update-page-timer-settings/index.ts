import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  console.log(`🔧 update-page-timer-settings: Starting request processing`);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log(`🔧 CORS preflight request received`);
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log(`🔧 Reading request body...`);
    const body = await req.json();
    console.log(`🔧 Request body: ${JSON.stringify(body)}`);
    
    const { pageShareCode, timerDurationSeconds } = body;

    if (!pageShareCode || timerDurationSeconds === undefined) {
      console.error(`❌ Missing parameters: pageShareCode=${pageShareCode}, timerDurationSeconds=${timerDurationSeconds}`);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Missing required parameters: pageShareCode and timerDurationSeconds' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Initialize Supabase client
    console.log(`🔧 Initializing Supabase client...`);
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      console.error(`❌ Missing Supabase environment variables`);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Server configuration error' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`🔧 Updating timer settings for page: ${pageShareCode}, new duration: ${timerDurationSeconds}s`);

    // First, check how many records match our criteria
    const { data: countData, error: countError } = await supabase
      .from('friend_page_access')
      .select('id, timer_start_at, timer_end_at')
      .eq('page_share_code', pageShareCode)
      .eq('access_enabled', true)
      .not('timer_start_at', 'is', null);

    if (countError) {
      console.error(`❌ Error checking existing records:`, countError);
    } else {
      console.log(`🔧 Found ${countData?.length || 0} records to update:`, countData);
    }

    // Update all active friend_page_access records for this page
    const { data, error } = await supabase
      .from('friend_page_access')
      .update({
        timer_end_at: supabase.sql`timer_start_at + ${timerDurationSeconds} * interval '1 second'`,
        updated_at: new Date().toISOString()
      })
      .eq('page_share_code', pageShareCode)
      .eq('access_enabled', true)
      .not('timer_start_at', 'is', null)
      .select('id, timer_start_at, timer_end_at');

    if (error) {
      console.error('❌ Error updating friend page access records:', error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: `Failed to update timer settings: ${error.message}` 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const updatedCount = data?.length || 0;
    console.log(`✅ Successfully updated ${updatedCount} friend_page_access records:`, data);

    return new Response(JSON.stringify({ 
      success: true, 
      updatedCount,
      updatedRecords: data
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: `Internal server error: ${error.message}` 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});