import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

interface TimerInfoRequest {
  pageShareCode: string;
  uid?: string;
}

interface TimerResponse {
  success: boolean;
  timer_start_at?: string;
  timer_end_at?: string;
  access_enabled?: boolean;
  expired?: boolean;
  error?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pageShareCode, uid }: TimerInfoRequest = await req.json();

    if (!pageShareCode) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Page share code is required' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let timerInfo: TimerResponse = { success: false };

    if (uid) {
      // 友達情報を先に取得してfriend_idを確定
      const { data: friend, error: friendLookupError } = await supabase
        .from('line_friends')
        .select('id, user_id')
        .eq('short_uid_ci', uid.toUpperCase())
        .single();

      if (friendLookupError || !friend) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Friend not found for provided UID' 
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // ページのタイマー設定を取得
      const { data: pageData, error: pageError } = await supabase
        .from('cms_pages')
        .select('timer_duration_seconds, timer_mode')
        .eq('share_code', pageShareCode)
        .single();

      if (pageError || !pageData) {
        console.error('Failed to load page timer settings:', pageError);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to load page timer configuration'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // 特定の友達のアクセス情報を取得
      const { data: friendAccess, error: friendError } = await supabase
        .from('friend_page_access')
        .select('*')
        .eq('page_share_code', pageShareCode)
        .eq('friend_id', friend.id)
        .maybeSingle();

      if (friendError) {
        console.error('Failed to fetch friend page access:', friendError);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to load access record'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (!friendAccess) {
        if (pageData.timer_mode === 'step_delivery') {
          console.log('Step-delivery timer pending start; skipping access record creation.');
          timerInfo = {
            success: true,
            timer_start_at: null,
            timer_end_at: null,
            access_enabled: false,
            expired: false
          };
        } else {
          const now = new Date();
          let timer_end_at = null;
          
          if (pageData.timer_duration_seconds > 0 && pageData.timer_mode === 'per_access') {
            timer_end_at = new Date(now.getTime() + pageData.timer_duration_seconds * 1000).toISOString();
          }

          const { data: newAccess, error: insertError } = await supabase
            .from('friend_page_access')
            .insert({
              user_id: friend.user_id,
              friend_id: friend.id,
              page_share_code: pageShareCode,
              access_enabled: true,
              timer_start_at: now.toISOString(),
              timer_end_at,
              first_access_at: now.toISOString(),
              access_source: 'direct'
            })
            .select()
            .single();

          if (insertError) {
            console.error('Failed to create access record:', insertError);
            return new Response(JSON.stringify({ 
              success: false, 
              error: 'Failed to create access record' 
            }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          timerInfo = {
            success: true,
            timer_start_at: newAccess.timer_start_at,
            timer_end_at: newAccess.timer_end_at,
            access_enabled: newAccess.access_enabled,
            expired: false
          };
        }
      } else {
        // 既存のアクセス記録がある場合
        const now = new Date();
        let expired = false;

        if (!friendAccess.first_access_at) {
          const firstAccessAt = now.toISOString();
          await supabase
            .from('friend_page_access')
            .update({ first_access_at: firstAccessAt })
            .eq('id', friendAccess.id);
          friendAccess.first_access_at = firstAccessAt;
        }

        if (pageData.timer_mode === 'per_access' && !friendAccess.timer_start_at) {
          await supabase
            .from('friend_page_access')
            .update({ timer_start_at: now.toISOString() })
            .eq('id', friendAccess.id);
          
          friendAccess.timer_start_at = now.toISOString();
        }

        // 期限切れチェック
        if (friendAccess.timer_end_at) {
          expired = new Date(friendAccess.timer_end_at) <= now;
        } else if (friendAccess.timer_start_at) {
          // timer_end_atが設定されていない場合、ページの設定から計算
          if (
            pageData.timer_duration_seconds > 0 &&
            (pageData.timer_mode === 'per_access' || pageData.timer_mode === 'step_delivery')
          ) {
            const startTime = new Date(friendAccess.timer_start_at);
            const endTime = new Date(startTime.getTime() + pageData.timer_duration_seconds * 1000);
            expired = now >= endTime;
            
            // timer_end_atを更新
            await supabase
              .from('friend_page_access')
              .update({ timer_end_at: endTime.toISOString() })
              .eq('id', friendAccess.id);
              
            friendAccess.timer_end_at = endTime.toISOString();
          }
        }

        timerInfo = {
          success: true,
          timer_start_at: friendAccess.timer_start_at,
          timer_end_at: friendAccess.timer_end_at,
          access_enabled: friendAccess.access_enabled && !expired,
          expired
        };
      }
    } else {
      // UIDが提供されていない場合は一般的なタイマー情報のみ
      timerInfo = {
        success: true,
        timer_start_at: new Date().toISOString(),
        access_enabled: false,
        expired: false
      };
    }

    return new Response(JSON.stringify(timerInfo), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in get-timer-info function:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
