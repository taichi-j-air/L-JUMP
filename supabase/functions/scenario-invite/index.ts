import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const inviteCode = url.searchParams.get("code");
  
  if (!inviteCode) {
    // QRコード生成や直接アクセス用の基本ページ
    return new Response(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>LINE友達追加</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
        </head>
        <body>
          <div style="text-align: center; padding: 40px;">
            <h1>LINE友達追加</h1>
            <p>招待コードが必要です</p>
          </div>
        </body>
      </html>
    `, {
      headers: { ...corsHeaders, 'Content-Type': 'text/html' }
    });
  }

  console.log("=== scenario-invite START ===");
  console.log("Invite code:", inviteCode);

  try {
    // Supabaseクライアント初期化
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 招待コードを検証して必要な情報を取得
    const { data, error } = await supabase
      .from("scenario_invite_codes")
      .select(`
        id,
        scenario_id,
        invite_code,
        max_usage,
        usage_count,
        step_scenarios!inner (
          id,
          name,
          profiles!inner (
            user_id,
            line_bot_id,
            add_friend_url,
            line_channel_access_token
          )
        )
      `)
      .eq("invite_code", inviteCode)
      .eq("is_active", true)
      .single();

    if (error || !data) {
      console.warn("Invalid invite code:", inviteCode, error);
      return new Response(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>招待コードエラー</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
          </head>
          <body>
            <div style="text-align: center; padding: 40px;">
              <h1>エラー</h1>
              <p>無効な招待コードです</p>
            </div>
          </body>
        </html>
      `, {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'text/html' }
      });
    }

    const profile = data.step_scenarios.profiles;
    const addFriendUrl = profile.add_friend_url;
    const botId = profile.line_bot_id;

    if (!addFriendUrl && !botId) {
      console.error("LINE Bot設定が不完全です");
      return new Response(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>設定エラー</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
          </head>
          <body>
            <div style="text-align: center; padding: 40px;">
              <h1>設定エラー</h1>
              <p>LINE Botの設定が不完全です</p>
            </div>
          </body>
        </html>
      `, {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'text/html' }
      });
    }

    // 招待クリックをログに記録
    const clientIP = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const userAgent = req.headers.get('user-agent') || '';
    
    try {
      await supabase
        .from('invite_clicks')
        .insert({
          invite_code_id: data.id,
          user_id: profile.user_id,
          clicked_at: new Date().toISOString(),
          ip_address: clientIP,
          user_agent: userAgent
        });
    } catch (logError) {
      console.warn('招待クリック記録に失敗:', logError);
    }

    // デバイス判定
    const isMobile = /mobile|android|iphone|ipad|ipod/i.test(userAgent);
    
    // LINE友達追加URLを構築
    let lineUrl = addFriendUrl;
    if (!lineUrl && botId) {
      lineUrl = `https://line.me/R/ti/p/${botId}`;
    }
    
    // 招待コードをstateパラメータとして追加
    const separator = lineUrl.includes('?') ? '&' : '?';
    lineUrl += `${separator}state=${inviteCode}`;

    console.log("LINE URL:", lineUrl);

    if (isMobile) {
      // モバイル: 直接LINEアプリにリダイレクト
      return new Response(null, {
        status: 302,
        headers: { ...corsHeaders, Location: lineUrl },
      });
    } else {
      // PC: QRコード表示ページ
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(lineUrl)}`;
      
      return new Response(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>LINE友達追加 - ${data.step_scenarios.name}</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                margin: 0;
                padding: 20px;
                background: #f5f5f5;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
              }
              .container {
                background: white;
                padding: 40px;
                border-radius: 12px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.1);
                text-align: center;
                max-width: 400px;
              }
              .qr-code {
                margin: 20px 0;
                border: 1px solid #eee;
                border-radius: 8px;
                overflow: hidden;
                display: inline-block;
              }
              .scenario-name {
                color: #00B900;
                font-weight: bold;
                margin-bottom: 10px;
              }
              .instructions {
                color: #666;
                font-size: 14px;
                line-height: 1.5;
              }
              .mobile-link {
                margin-top: 20px;
                padding: 12px 24px;
                background: #00B900;
                color: white;
                text-decoration: none;
                border-radius: 6px;
                display: inline-block;
                font-weight: bold;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>LINE友達追加</h1>
              <div class="scenario-name">${data.step_scenarios.name}</div>
              <div class="qr-code">
                <img src="${qrUrl}" alt="QRコード" />
              </div>
              <div class="instructions">
                スマートフォンでQRコードを読み取ると<br>
                LINEアプリが起動します
              </div>
              <a href="${lineUrl}" class="mobile-link">
                スマートフォンの方はこちら
              </a>
            </div>
          </body>
        </html>
      `, {
        headers: { ...corsHeaders, 'Content-Type': 'text/html' }
      });
    }

  } catch (error) {
    console.error("Scenario invite error:", error);
    return new Response(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>サーバーエラー</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
        </head>
        <body>
          <div style="text-align: center; padding: 40px;">
            <h1>サーバーエラー</h1>
            <p>一時的な問題が発生しました</p>
          </div>
        </body>
      </html>
    `, {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'text/html' }
    });
  }
});