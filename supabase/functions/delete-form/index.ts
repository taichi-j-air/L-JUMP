// Supabase Edge Function: delete-form
// Deletes a form and all its submissions after verifying ownership

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { form_id } = await req.json();
    if (!form_id) {
      return new Response(JSON.stringify({ error: 'form_id is required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
    });
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Auth check
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // Ownership check via RLS-safe client
    const { data: form, error: formErr } = await supabase
      .from('forms')
      .select('id')
      .eq('id', form_id)
      .maybeSingle();

    if (formErr) {
      return new Response(JSON.stringify({ error: formErr.message }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }
    if (!form) {
      return new Response(JSON.stringify({ error: 'Form not found or not owned' }), { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // Delete submissions first
    const { error: delSubsErr } = await supabaseAdmin
      .from('form_submissions')
      .delete()
      .eq('form_id', form_id);
    if (delSubsErr) {
      return new Response(JSON.stringify({ error: delSubsErr.message }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // Delete the form itself
    const { error: delFormErr } = await supabaseAdmin
      .from('forms')
      .delete()
      .eq('id', form_id);
    if (delFormErr) {
      return new Response(JSON.stringify({ error: delFormErr.message }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
});
