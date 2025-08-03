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
      let code = url.searchParams.get("code");

      // LINE が時々 liff.state=... の形で返す対策
      if (!code) {
        const rawState = url.searchParams.get("liff.state");
        if (rawState) {
          const parsed = new URL("https://dummy/?" + rawState);
          code = parsed.searchParams.get("code") ?? "";
        }
      }

      // ---- パラメータチェック ----
      if (!code) {
        return htmlError("Parameter Error", "code parameter missing");
      }

      /* ---------- DB lookup : Channel & LIFF ID ---------- */
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );

      const { data } = await supabase
        .from("scenario_invite_codes")
        .select(`
          step_scenarios!inner (
            profiles!inner (
              line_login_channel_id,
              liff_id
            )
          )
        `)
        .eq("invite_code", code)
        .eq("is_active", true)
        .single();

      const liffId = data?.step_scenarios?.profiles?.liff_id;
      const channelId = data?.step_scenarios?.profiles?.line_login_channel_id;
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
        `&state=${code}` +
        `&scope=profile%20openid` +
        `&bot_prompt=aggressive`;

      return new Response(generateLoadingHtml(liffId, code, authUrl), {
        status: 200,
        headers: { ...cors, "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // ---------- POST (= access-token 受信 API) ----------
    if (req.method === "POST") {
      /* …既存の register_friend_to_scenario ロジック … */
    }

    return new Response("Method Not Allowed", { status: 405, headers: cors });
  } catch (e) {
    console.error("[liff-handler] fatal:", e);
    return htmlError("Server Error", e.message ?? "unknown");
  }
});

/* ---------- Utility ---------- */
function htmlError(title: string, msg: string) {
  return new Response(
    `<html><body><h3>${title}</h3><p>${msg}</p></body></html>`,
    { status: 400, headers: { ...cors, "Content-Type": "text/html" } },
  );
}

function generateLoadingHtml(liffId: string, code: string, authUrl: string) {
  return /* html */ `
<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width"/>
<title>LINE認証</title>
<style>body{display:flex;align-items:center;justify-content:center;
font-family:-apple-system,BlinkMacSystemFont,sans-serif;height:100vh;margin:0}
.spinner{width:44px;height:44px;border:4px solid #f3f3f3;border-top:4px solid #00b900;
border-radius:50%;animation:spin 1s linear infinite}@keyframes spin{0%{transform:rotate(0)}
100%{transform:rotate(360deg)}}</style></head><body>
<div class="spinner"></div>
<script>
  // SDK を読み込んで LIFF.init 後に LINE OAuth へ飛ばす
  (function(){
    const s=document.createElement('script');
    s.src='https://static.line-scdn.net/liff/edge/2/sdk.js';
    s.onload=async function(){
      await window.liff.init({liffId:'${liffId}'});
      location.replace(${JSON.stringify(authUrl)});
    };
    document.head.appendChild(s);
  })();
</script></body></html>`;
}