import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    console.log("=== scenario-invite START ===");
    console.log("Request URL:", req.url);
    console.log("User-Agent:", req.headers.get("user-agent"));

    const inviteCode =
      new URL(req.url).searchParams.get("code") ??
      req.url.split("/").filter(Boolean).pop();
      
    console.log("Extracted invite code:", inviteCode);
    if (!inviteCode) return jsonErr(400, "invite code required");

    /* DB チェック & LIFF ID取得 */
    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    console.log("Querying database for invite code:", inviteCode);
    const { data, error } = await db.from("scenario_invite_codes")
      .select(`
        id,
        step_scenarios!inner (
          profiles!inner (
            line_login_channel_id,
            liff_id
          )
        )
      `)
      .eq("invite_code", inviteCode)
      .eq("is_active", true)
      .single();
    
    console.log("Database query result:", { data, error });
    
    if (!data) {
      console.log("No data found for invite code:", inviteCode);
      return jsonErr(404, "invalid / expired invite code");
    }
    
    const channelId = data.step_scenarios?.profiles?.line_login_channel_id;
    const liffId = data.step_scenarios?.profiles?.liff_id;
    console.log("Extracted Channel ID:", channelId);
    console.log("Extracted LIFF ID:", liffId);
    
    if (!channelId) {
      console.log("LINE Login Channel ID not found in profile");
      return jsonErr(500, "LINE Login Channel ID not configured");
    }

    /* UA で分岐: モバイルは直接LINE OAuth、PCはQR表示 */
    const userAgent = req.headers.get("user-agent") ?? "";
    const isMobile = /mobile|android|iphone|ipad|ipod|line/i.test(userAgent);
    console.log("🔍 [DEBUG] User Agent:", userAgent);
    console.log("🔍 [DEBUG] Is Mobile/LINE detected:", isMobile);
    const fe = "https://74048ab5-8d5a-425a-ab29-bd5cc50dc2fe.lovableproject.com";

    let redirect: string;
    
    if (isMobile) {
      // モバイル: 直接LINE OAuth認証URLにリダイレクト（LINEのアドバイス通り）
      const redirectUri = "https://rtjxurmuaawyzjcdkqxt.supabase.co/functions/v1/login-callback";
      const authUrl = 
        `https://access.line.me/oauth2/v2.1/authorize` +
        `?response_type=code` +
        `&client_id=${channelId}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&state=${inviteCode}` +
        `&scope=profile%20openid` +
        `&bot_prompt=aggressive`;
      
      console.log("🔍 [DEBUG] Generated AUTH URL:", authUrl);
      console.log("🔍 [DEBUG] Channel ID:", channelId);
      console.log("🔍 [DEBUG] Redirect URI:", redirectUri);
      redirect = authUrl;
    } else {
      // PC: QR表示ページへ
      redirect = `${fe}/invite/${inviteCode}`;
    }

    console.log("Redirecting to:", redirect);
    console.log("Is mobile:", isMobile);

    return new Response(null, { status: 302, headers: { ...cors, Location: redirect } });
  } catch (error) {
    console.error("=== scenario-invite ERROR ===");
    console.error("Error:", error);
    return jsonErr(500, `Server error: ${error.message}`);
  }
});

function jsonErr(code: number, msg: string) {
  return new Response(JSON.stringify({ error: msg }), {
    status: code,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}