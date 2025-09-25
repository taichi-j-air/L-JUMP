import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ---------- エントリポイント ----------
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    // ---------- GET (= LIFFブラウザからのロード) ----------
    if (req.method === "GET") {
      const url = new URL(req.url);
      
      // 変更点: 'inviteCode' パラメータを取得
      let inviteCode = url.searchParams.get("inviteCode"); 
      
      // LINE が時々 liff.state=... の形で返す対策 (ここでは元のコードに合わせて残しますが、inviteCodeを受け取る場合は不要な可能性が高いです)
      if (!inviteCode) {
        const rawState = url.searchParams.get("liff.state");
        if (rawState) {
          const parsed = new URL("https://dummy/?" + rawState);
          inviteCode = parsed.searchParams.get("code") ?? ""; // ここも 'inviteCode' を考慮する必要があるかもしれません
        }
      }

      // ---- パラメータチェック ----
      // 変更点: inviteCode の存在チェック
      if (!inviteCode) {
        return htmlError("Parameter Error", "inviteCode parameter missing");
      }

      /* ---------- DB lookup : Channel & LIFF ID ---------- */
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );

      const { data } = await supabase
        .from("scenario_invite_codes")
        .select(
          `
          step_scenarios!inner (
            profiles!inner (
              line_login_channel_id,
              liff_id
            )
          )
        `,
        )
        // 変更点: invite_code を inviteCode で検索
        .eq("invite_code", inviteCode)
        .eq("is_active", true)
        .single();

      const liffId = (data?.step_scenarios as any)?.profiles?.liff_id;
      const channelId = (data?.step_scenarios as any)?.profiles?.line_login_channel_id;

      if (!liffId || !channelId) {
        return htmlError("Config Error", "LIFF ID / Channel ID not found");
      }

      /* ---------- LINE OAuth URL (bot_prompt=aggressive) ---------- */
      const redirectUri = "https://rtjxurmuaawyzjcdkqxt.supabase.co/functions/v1/login-callback";
      const authUrl =
        `https://access.line.me/oauth2/v2.1/authorize` +
        `?response_type=code` +
        `&client_id=${channelId}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        // 変更点: state に inviteCode を含める
        `&state=${inviteCode}` +
        `&scope=profile%20openid` +
        `&bot_prompt=aggressive`;

      // 変更点: generateLoadingHtml に inviteCode を渡す
      return new Response(generateLoadingHtml(liffId, inviteCode, authUrl), {
        status: 200,
        headers: { ...cors, "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // ---------- POST (= access-token 受信 API) ----------
    if (req.method === "POST") {
      /* …既存の register_friend_to_scenario ロジック … */
      // ここは今回の修正対象外ですが、必要であれば inviteCode の取得・利用を考慮してください。
    }

    return new Response("Method Not Allowed", { status: 405, headers: cors });
  } catch (e) {
    console.error("[liff-handler] fatal:", e);
    return htmlError("Server Error", (e as Error)?.message ?? "unknown");
  }
});

/* ---------- Utility ---------- */
function htmlError(title: string, msg: string) {
  return new Response(
    `<!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <style>
            body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background-color: #f0f0f0; color: #333; }
            .container { text-align: center; padding: 20px; background-color: #fff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            h1 { color: #d32f2f; }
            p { font-size: 1.1em; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>${title}</h1>
            <p>${msg}</p>
        </div>
    </body>
    </html>`,
    { status: 400, headers: { ...cors, "Content-Type": "text/html" } },
  );
}

// 変更点: generateLoadingHtml の引数に inviteCode を追加
function generateLoadingHtml(liffId: string, inviteCode: string, authUrl: string) {
  return /* html */ `
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>LINE認証</title>
        <style>
            body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background-color: #f0f0f0; color: #333; }
            .container { text-align: center; padding: 20px; background-color: #fff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .spinner { border: 4px solid rgba(0,0,0,.1); border-left-color: #007bff; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 20px auto; }
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            p { font-size: 1.1em; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>LINE認証中...</h1>
            <div class="spinner"></div>
            <p>LINEアカウントで認証しています。しばらくお待ちください。</p>
        </div>
        <script>
            // LIFF SDKの読み込み
            (function(l,i,f,s,d){
                var el = l.createElement(i);
                el.src = f; el.async = true;
                d.head.appendChild(el);
            })(document, 'script', 'https://static.line-scdn.net/liff/edge/2/sdk.js', 'liff-sdk', document);

            window.addEventListener('load', function() {
                // LIFF 初期化
                liff.init({ liffId: '${liffId}' })
                    .then(() => {
                        console.log('LIFF initialized');
                        // 認証URLへリダイレクト
                        // bot_prompt=aggressive で友だち追加を促す
                        window.location.href = '${authUrl}';
                    })
                    .catch((err) => {
                        console.error('LIFF initialization failed', err);
                        document.querySelector('.container h1').innerText = 'エラーが発生しました';
                        document.querySelector('.container p').innerText = 'LIFFの初期化に失敗しました。';
                    });
            });
        </script>
    </body>
    </html>
  `;
}