import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("=== LIFF HANDLER START ===");
    console.log("Method:", req.method);
    console.log("URL:", req.url);
    
    // GETリクエスト（ブラウザアクセス）の場合
    if (req.method === "GET") {
      const url = new URL(req.url);
      let code = url.searchParams.get("code");
      let liffIdParam = url.searchParams.get("liffId");
      
      // Handle liff.state parameter (LINE redirects sometimes use this format)
      const liffState = url.searchParams.get("liff.state");
      if (liffState && !code) {
        // Parse liff.state which might contain ?code=xxx
        const stateUrl = new URL("http://dummy.com" + liffState);
        code = stateUrl.searchParams.get("code");
      }
      
      console.log("GET Parameters:", { code, liffIdParam, liffState });
      
      if (!code || !liffIdParam) {
        return new Response(
          generateErrorPage("Parameter Error", "Required parameters are missing"),
          { 
            status: 400, 
            headers: { 
              ...corsHeaders, 
              "Content-Type": "text/html; charset=utf-8" 
            } 
          }
        );
      }

      // LIFFページを生成して返す
      const liffPageHtml = generateLiffPage(liffIdParam, code);
      
      return new Response(liffPageHtml, {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" }
      });
    }

    // POSTリクエスト（既存のAPI）の場合
    if (req.method === "POST") {
      const { inviteCode, scenarioId, accessToken } = await req.json();
      
      console.log('POST データ:', { 
        inviteCode, 
        scenarioId, 
        hasAccessToken: !!accessToken 
      });

      if (!inviteCode || !scenarioId || !accessToken) {
        return new Response(JSON.stringify({ 
          error: 'Missing required parameters' 
        }), { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      // LINEプロファイル取得
      const profileResponse = await fetch('https://api.line.me/v2/profile', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!profileResponse.ok) {
        console.error('❌ LINEプロファイル取得失敗:', await profileResponse.text());
        return new Response(JSON.stringify({ 
          error: 'Failed to get LINE profile' 
        }), { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const lineProfile = await profileResponse.json();

      // シナリオに友だちを登録
      const { data: registrationResult, error: registrationError } = await supabase
        .rpc('register_friend_to_scenario', {
          p_line_user_id: lineProfile.userId,
          p_invite_code: inviteCode,
          p_display_name: lineProfile.displayName,
          p_picture_url: lineProfile.pictureUrl
        });

      if (registrationError || !registrationResult?.success) {
        return new Response(JSON.stringify({ 
          error: registrationResult?.error || 'Registration failed',
          details: registrationError?.message
        }), { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ 
        success: true,
        message: 'シナリオ登録が完了しました',
        profile: {
          userId: lineProfile.userId,
          displayName: lineProfile.displayName
        }
      }), { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response('Method not allowed', { status: 405, headers: corsHeaders });

  } catch (error) {
    console.error("LIFF handler error:", error);
    
    if (req.method === "GET") {
      const errorPageHtml = generateErrorPage("Error", `An error occurred: ${error.message}`);
      return new Response(errorPageHtml, {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" }
      });
    }
    
    return new Response(JSON.stringify({ 
      error: 'Server error',
      details: error.message,
      timestamp: new Date().toISOString()
    }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

function generateLiffPage(liffId: string, code: string) {
  return `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LINE友だち追加</title>
    <script src="https://static.line-scdn.net/liff/edge/2/sdk.js"></script>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, sans-serif;
            margin: 0;
            padding: 20px;
            background: linear-gradient(135deg, #00B900 0%, #00D900 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .container {
            background: white;
            border-radius: 12px;
            padding: 30px;
            text-align: center;
            box-shadow: 0 8px 32px rgba(0,0,0,0.1);
            max-width: 400px;
            width: 100%;
        }
        .spinner {
            width: 40px;
            height: 40px;
            border: 4px solid #f3f3f3;
            border-top: 4px solid #00B900;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 20px;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .title {
            font-size: 20px;
            font-weight: bold;
            color: #333;
            margin-bottom: 10px;
        }
        .message {
            color: #666;
            font-size: 16px;
            margin-bottom: 20px;
        }
        .error {
            color: #d32f2f;
            background: #ffebee;
            padding: 15px;
            border-radius: 8px;
            margin-top: 15px;
        }
        .success {
            color: #2e7d32;
            background: #e8f5e8;
            padding: 15px;
            border-radius: 8px;
            margin-top: 15px;
        }
        .debug {
            font-size: 12px;
            color: #999;
            margin-top: 15px;
            padding: 10px;
            background: #f5f5f5;
            border-radius: 6px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="spinner" id="spinner"></div>
        <div class="title">LINE友だち追加</div>
        <div class="message" id="message">認証中...</div>
        <div id="status"></div>
        <div id="error" class="error" style="display: none;"></div>
        <div id="success" class="success" style="display: none;"></div>
        <div class="debug">
            LIFF ID: ${liffId}<br>
            Code: ${code}
        </div>
    </div>

    <script>
        const liffId = "${liffId}";
        const code = "${code}";
        const messageEl = document.getElementById('message');
        const statusEl = document.getElementById('status');
        const errorEl = document.getElementById('error');
        const successEl = document.getElementById('success');
        const spinnerEl = document.getElementById('spinner');

        function hideSpinner() {
            spinnerEl.style.display = 'none';
        }

        function showError(message) {
            hideSpinner();
            errorEl.textContent = message;
            errorEl.style.display = 'block';
            messageEl.textContent = 'エラーが発生しました';
        }

        function showSuccess(message) {
            hideSpinner();
            successEl.textContent = message;
            successEl.style.display = 'block';
            messageEl.textContent = '処理完了';
        }

        function updateMessage(message) {
            messageEl.textContent = message;
        }

        async function initLiff() {
            try {
                updateMessage('LIFF初期化中...');
                console.log('Initializing LIFF with ID:', liffId);
                
                await liff.init({ liffId: liffId });
                console.log('LIFF initialized successfully');
                
                updateMessage('ログイン状態確認中...');
                
                if (!liff.isLoggedIn()) {
                    updateMessage('LINE認証画面へ移動中...');
                    console.log('User not logged in, redirecting to login');
                    liff.login({
                        redirectUri: 'https://rtjxurmuaawyzjcdkqxt.supabase.co/functions/v1/login-callback',
                        state: code,
                        botPrompt: 'normal'  // 友だち追加オプションを表示
                    });
                } else {
                    updateMessage('認証完了 - 友だち追加処理中...');
                    console.log('User already logged in, redirecting to callback');
                    window.location.href = \`https://rtjxurmuaawyzjcdkqxt.supabase.co/functions/v1/login-callback?state=\${code}\`;
                }
            } catch (error) {
                console.error('LIFF Error:', error);
                showError(\`LIFF初期化エラー: \${error.message}\`);
            }
        }

        // LIFF SDK読み込み完了後に実行
        window.addEventListener('load', () => {
            setTimeout(() => {
                if (typeof liff !== 'undefined') {
                    initLiff();
                } else {
                    showError('LIFF SDKの読み込みに失敗しました');
                }
            }, 500);
        });
    </script>
</body>
</html>
  `;
}

function generateErrorPage(title: string, message: string) {
  return `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, sans-serif;
            margin: 0;
            padding: 20px;
            background: linear-gradient(135deg, #f44336 0%, #d32f2f 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .container {
            background: white;
            border-radius: 12px;
            padding: 30px;
            text-align: center;
            box-shadow: 0 8px 32px rgba(0,0,0,0.1);
            max-width: 400px;
            width: 100%;
        }
        .title {
            font-size: 20px;
            font-weight: bold;
            color: #d32f2f;
            margin-bottom: 15px;
        }
        .message {
            color: #666;
            font-size: 16px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="title">${title}</div>
        <div class="message">${message}</div>
    </div>
</body>
</html>
  `;
}