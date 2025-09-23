import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pageShareCode, timerDurationSeconds } = await req.json();

    if (!pageShareCode || timerDurationSeconds === undefined) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Missing required parameters: pageShareCode and timerDurationSeconds' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`Updating timer settings for page: ${pageShareCode}, new duration: ${timerDurationSeconds}s`);

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
      .select('id');

    if (error) {
      console.error('Error updating friend page access records:', error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Failed to update timer settings' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const updatedCount = data?.length || 0;
    console.log(`Successfully updated ${updatedCount} friend_page_access records`);

    return new Response(JSON.stringify({ 
      success: true, 
      updatedCount 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});