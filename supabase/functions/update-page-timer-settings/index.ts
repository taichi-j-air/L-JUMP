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

    // Calculate new timer_end_at for each record
    const updatePromises = countData?.map(async (record) => {
      const timerStartAt = new Date(record.timer_start_at);
      const newTimerEndAt = new Date(timerStartAt.getTime() + (timerDurationSeconds * 1000));
      
      console.log(`🔧 Updating record ${record.id}: timer_start_at=${record.timer_start_at} -> timer_end_at=${newTimerEndAt.toISOString()}`);
      
      return supabase
        .from('friend_page_access')
        .update({
          timer_end_at: newTimerEndAt.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', record.id)
        .select('id, timer_start_at, timer_end_at');
    }) || [];

    // Execute all updates in parallel
    const results = await Promise.allSettled(updatePromises);
    
    // Collect successful updates
    const successfulUpdates = [];
    let errorCount = 0;
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && !result.value.error) {
        if (result.value.data && result.value.data.length > 0) {
          successfulUpdates.push(result.value.data[0]);
        }
      } else {
        errorCount++;
        console.error(`❌ Failed to update record ${countData?.[index]?.id}:`, 
          result.status === 'rejected' ? result.reason : result.value.error);
      }
    });

    if (errorCount > 0) {
      console.log(`⚠️ ${errorCount} records failed to update, ${successfulUpdates.length} succeeded`);
    }

    const updatedCount = successfulUpdates.length;
    console.log(`✅ Successfully updated ${updatedCount} friend_page_access records:`, successfulUpdates);

    return new Response(JSON.stringify({ 
      success: true, 
      updatedCount,
      updatedRecords: successfulUpdates,
      errors: errorCount
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