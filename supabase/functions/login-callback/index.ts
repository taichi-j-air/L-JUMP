import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('=== LOGIN CALLBACK FUNCTION START ===')
    const url = new URL(req.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const error = url.searchParams.get('error')
    
    console.log('受信パラメータ:', { 
      code: code?.substring(0, 10) + '...', 
      state, 
      error 
    })

    // エラーチェック
    if (error) {
      console.error('❌ LINE認証エラー:', error)
      return new Response(null, {
        status: 302,
        headers: { 
          ...corsHeaders,
          'Location': 'https://74048ab5-8d5a-425a-ab29-bd5cc50dc2fe.lovableproject.com/?error=line_auth_failed&details=' + error
        }
      })
    }
    
    if (!code) {
      console.error('❌ 認証コードがありません')
      return new Response(null, {
        status: 302,
        headers: { 
          ...corsHeaders,
          'Location': 'https://74048ab5-8d5a-425a-ab29-bd5cc50dc2fe.lovableproject.com/?error=no_auth_code'
        }
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // 招待コード+ユーザーID取得
    const stateData = state?.split(':') || []
    const inviteCode = stateData[0]
    const targetUserId = stateData[1]
    console.log('招待コード:', inviteCode, 'ターゲットユーザーID:', targetUserId)

    // LINE設定取得（ターゲットユーザー優先）
    let lineSettings = null
    
    if (targetUserId) {
      console.log('🔍 ターゲットユーザーから設定取得中...')
      const { data: targetSettings } = await supabase
        .from('profiles')
        .select('line_login_channel_id, line_login_channel_secret, user_id, display_name, line_bot_id, add_friend_url')
        .eq('user_id', targetUserId)
        .single()
      
      if (targetSettings) {
        lineSettings = targetSettings
        console.log('✅ ターゲットユーザー設定取得成功')
      }
    }
    
    if (inviteCode && !lineSettings) {
      console.log('🔍 招待コードから設定取得中...')
      const { data: inviteData } = await supabase
        .from('scenario_invite_codes')
        .select(`
          scenario_id,
          step_scenarios!inner (
            user_id,
            profiles!inner (
              line_login_channel_id,
              line_login_channel_secret,
              user_id,
              display_name,
              line_bot_id,
              add_friend_url
            )
          )
        `)
        .eq('invite_code', inviteCode)
        .eq('is_active', true)
        .single()

      if (inviteData?.step_scenarios?.profiles) {
        lineSettings = inviteData.step_scenarios.profiles
        console.log('✅ 招待コードから設定取得成功')
      }
    }

    // フォールバック設定取得
    if (!lineSettings) {
      console.log('🔍 フォールバック設定取得中...')
      const { data: fallbackSettings } = await supabase
        .from('profiles')
        .select('line_login_channel_id, line_login_channel_secret, user_id, display_name')
        .not('line_login_channel_id', 'is', null)
        .not('line_login_channel_secret', 'is', null)
        .limit(1)
        .single()
      
      lineSettings = fallbackSettings
    }

    if (!lineSettings?.line_login_channel_id) {
      console.error('❌ LINE設定が見つかりません')
      return new Response(null, {
        status: 302,
        headers: { 
          ...corsHeaders,
          'Location': 'https://74048ab5-8d5a-425a-ab29-bd5cc50dc2fe.lovableproject.com/?error=no_line_config'
        }
      })
    }

    console.log('✅ LINE設定取得完了')

    // LINE Token取得
    const redirectUri = 'https://rtjxurmuaawyzjcdkqxt.supabase.co/functions/v1/login-callback'
    
    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUri,
      client_id: lineSettings.line_login_channel_id,
      client_secret: lineSettings.line_login_channel_secret,
    })

    console.log('🔐 LINEトークン取得中...')
    const tokenResponse = await fetch('https://api.line.me/oauth2/v2.1/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenParams,
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('❌ トークン取得失敗:', errorText)
      return new Response(null, {
        status: 302,
        headers: { 
          ...corsHeaders,
          'Location': 'https://74048ab5-8d5a-425a-ab29-bd5cc50dc2fe.lovableproject.com/?error=token_failed'
        }
      })
    }

    const tokenData = await tokenResponse.json()
    console.log('✅ トークン取得成功')

    // プロファイル取得
    console.log('👤 ユーザープロファイル取得中...')
    const profileResponse = await fetch('https://api.line.me/v2/profile', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
      },
    })

    if (!profileResponse.ok) {
      console.error('❌ プロファイル取得失敗')
      return new Response(null, {
        status: 302,
        headers: { 
          ...corsHeaders,
          'Location': 'https://74048ab5-8d5a-425a-ab29-bd5cc50dc2fe.lovableproject.com/?error=profile_failed'
        }
      })
    }

    const profile = await profileResponse.json()
    console.log('✅ プロファイル取得成功:', { 
      userId: profile.userId.substring(0, 10) + '...',
      displayName: profile.displayName 
    })

    // 友だち情報保存
    const { data: existingFriend } = await supabase
      .from('line_friends')
      .select('id')
      .eq('line_user_id', profile.userId)
      .eq('user_id', lineSettings.user_id)
      .single()

    if (!existingFriend) {
      await supabase.from('line_friends').insert({
        user_id: lineSettings.user_id,
        line_user_id: profile.userId,
        display_name: profile.displayName,
        picture_url: profile.pictureUrl || null,
      })
      console.log('✅ 新規友だち情報保存完了')
    } else {
      console.log('ℹ️ 既存友だち確認')
    }

    // シナリオ登録＋友達追加誘導処理
    const successUrl = new URL('https://74048ab5-8d5a-425a-ab29-bd5cc50dc2fe.lovableproject.com/')
    
    if (inviteCode && inviteCode !== 'login') {
      console.log('🎯 シナリオ登録処理開始')
      
      try {
        const { data: registrationResult, error: registrationError } = await supabase
          .rpc('register_friend_to_scenario', {
            p_line_user_id: profile.userId,
            p_invite_code: inviteCode,
            p_display_name: profile.displayName,
            p_picture_url: profile.pictureUrl || null
          })
        
        if (registrationResult?.success) {
          console.log('✅ シナリオ登録成功')
          
          // 友達追加URLがある場合はそこにリダイレクト
          if (lineSettings.add_friend_url || lineSettings.line_bot_id) {
            const friendAddUrl = lineSettings.add_friend_url || 
                                `https://lin.ee/${lineSettings.line_bot_id.replace('@', '')}`
            
            console.log('🤝 友達追加URLへリダイレクト:', friendAddUrl)
            return new Response(null, {
              status: 302,
              headers: { ...corsHeaders, 'Location': friendAddUrl }
            })
          } else {
            // 友達追加URLがない場合は成功画面へ
            successUrl.searchParams.set('line_login', 'success')
            successUrl.searchParams.set('scenario_registered', 'true')
            successUrl.searchParams.set('user_name', profile.displayName)
            successUrl.searchParams.set('invite_code', inviteCode)
            successUrl.searchParams.set('message', 'シナリオ登録完了。友達追加設定が必要です。')
          }
        } else {
          console.error('❌ シナリオ登録失敗:', registrationError)
          successUrl.searchParams.set('line_login', 'success')
          successUrl.searchParams.set('scenario_error', 'true')
        }
      } catch (regError) {
        console.error('💥 シナリオ登録例外:', regError)
        successUrl.searchParams.set('line_login', 'success')
        successUrl.searchParams.set('scenario_error', 'true')
      }
    } else {
      console.log('ℹ️ 通常ログインテスト')
      successUrl.searchParams.set('line_login', 'success')
      successUrl.searchParams.set('user_name', profile.displayName)
    }

    console.log('🎉 処理完了 - リダイレクト中')
    return new Response(null, {
      status: 302,
      headers: { ...corsHeaders, 'Location': successUrl.toString() }
    })

  } catch (error) {
    console.error('💥 CRITICAL ERROR:', error.message)
    console.error('Stack:', error.stack)
    return new Response(null, {
      status: 302,
      headers: { 
        ...corsHeaders,
        'Location': 'https://74048ab5-8d5a-425a-ab29-bd5cc50dc2fe.lovableproject.com/?error=server_error'
      }
    })
  }
})