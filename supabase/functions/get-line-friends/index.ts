import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 認証チェック
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response('認証が必要です', { status: 401, headers: corsHeaders });
    }

    // Supabaseクライアント初期化
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // ユーザー認証確認
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response('認証エラー', { status: 401, headers: corsHeaders });
    }

    // Get secure LINE credentials
    const { data: credentials, error: credError } = await supabase
      .rpc('get_line_credentials_for_user', { p_user_id: user.id });

    if (credError || !credentials?.channel_access_token) {
      return new Response('LINE API設定が見つかりません', { status: 400, headers: corsHeaders });
    }

    // LINE APIから友達リストを取得
    const lineResponse = await fetch('https://api.line.me/v2/bot/followers/ids', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${credentials.channel_access_token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!lineResponse.ok) {
      console.error('LINE API error:', await lineResponse.text());
      return new Response('LINE API エラー', { status: 400, headers: corsHeaders });
    }

    const lineData = await lineResponse.json();
    const userIds = lineData.userIds || [];

    // 各友達の詳細情報を取得
    const friends = [];
    for (const userId of userIds) {
      try {
        const profileResponse = await fetch(`https://api.line.me/v2/bot/profile/${userId}`, {
          headers: {
            'Authorization': `Bearer ${credentials.channel_access_token}`,
          },
        });

        if (profileResponse.ok) {
          const userProfile = await profileResponse.json();
          friends.push({
            line_user_id: userId,
            display_name: userProfile.displayName,
            picture_url: userProfile.pictureUrl,
            status_message: userProfile.statusMessage,
            added_at: new Date().toISOString(), // LINE APIからは取得できないので現在時刻
          });
        }
      } catch (error) {
        console.error(`Error fetching profile for ${userId}:`, error);
      }
    }

    return new Response(JSON.stringify({ friends }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response('Internal Server Error', { status: 500, headers: corsHeaders });
  }
});