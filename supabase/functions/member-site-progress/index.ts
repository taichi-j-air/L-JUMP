import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0'
import { corsHeaders } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

function errorResponse(message: string, status: number, errorCode: string) {
  return new Response(JSON.stringify({
    success: false,
    error: message,
    errorCode,
  }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405, 'METHOD_NOT_ALLOWED')
  }

  let payload: any
  try {
    payload = await req.json()
  } catch {
    return errorResponse('Invalid JSON body', 400, 'BAD_REQUEST')
  }

  const { slug, uid, contentId, completed } = payload || {}

  if (!slug || typeof slug !== 'string') {
    return errorResponse('Site slug is required', 400, 'BAD_REQUEST')
  }

  if (!uid || typeof uid !== 'string') {
    return errorResponse('UID is required for this request', 400, 'BAD_REQUEST')
  }

  if (!contentId || typeof contentId !== 'string') {
    return errorResponse('Content ID is required', 400, 'BAD_REQUEST')
  }

  if (typeof completed !== 'boolean') {
    return errorResponse('Completed flag must be boolean', 400, 'BAD_REQUEST')
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data: site, error: siteError } = await supabase
      .from('member_sites')
      .select('id, user_id, is_published')
      .eq('slug', slug)
      .eq('is_published', true)
      .maybeSingle()

    if (siteError) throw siteError
    if (!site) {
      return errorResponse('Site not found or not published', 404, 'NOT_FOUND')
    }

    const { data: friendData, error: friendError } = await supabase
      .from('line_friends')
      .select('id, user_id')
      .eq('short_uid_ci', uid.toUpperCase())
      .eq('user_id', site.user_id)
      .maybeSingle()

    if (friendError || !friendData) {
      return errorResponse('Invalid UID', 401, 'UID_AUTH_FAILED')
    }

    const { data: content, error: contentError } = await supabase
      .from('member_site_content')
      .select('id, site_id')
      .eq('id', contentId)
      .eq('site_id', site.id)
      .maybeSingle()

    if (contentError) throw contentError
    if (!content) {
      return errorResponse('Content not found for site', 404, 'CONTENT_NOT_FOUND')
    }

    const timestamp = new Date().toISOString()
    const progressPayload = {
      site_id: site.id,
      content_id: content.id,
      friend_id: friendData.id,
      status: completed ? 'completed' : 'incomplete',
      progress_percentage: completed ? 100 : 0,
      completed_at: completed ? timestamp : null,
    }

    const { error: upsertError } = await supabase
      .from('member_site_content_progress')
      .upsert(progressPayload, { onConflict: 'content_id,friend_id' })

    if (upsertError) throw upsertError

    return new Response(JSON.stringify({
      success: true,
      status: progressPayload.status,
      progress_percentage: progressPayload.progress_percentage,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error updating progress:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return errorResponse(message, 500, 'SERVER_ERROR')
  }
})
