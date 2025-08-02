import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const inviteCode =
    new URL(req.url).searchParams.get("code") ??
    req.url.split("/").filter(Boolean).pop();
  if (!inviteCode) return jsonErr(400, "invite code required");

  /* DB チェック & LINE Login Channel ID取得 */
  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data } = await db.from("scenario_invite_codes")
    .select(`
      id,
      step_scenarios!inner (
        profiles!inner (
          line_login_channel_id
        )
      )
    `)
    .eq("invite_code", inviteCode)
    .eq("is_active", true)
    .single();
  
  if (!data) return jsonErr(404, "invalid / expired invite code");
  
  const channelId = data.step_scenarios?.profiles?.line_login_channel_id;
  if (!channelId) return jsonErr(500, "LINE Login Channel ID not configured");

  /* UA で分岐 */
  const isMobile = /mobile|android|iphone|ipad|ipod/i.test(
    req.headers.get("user-agent") ?? "",
  );
  const fe = "https://74048ab5-8d5a-425a-ab29-bd5cc50dc2fe.lovableproject.com";

  const redirect = isMobile
    ? buildLineLoginUrl(channelId, inviteCode) // 直接LINEログイン認可URL
    : `${fe}/invite/${inviteCode}`;            // PC QR

  return new Response(null, { status: 302, headers: { ...cors, Location: redirect } });
});

function buildLineLoginUrl(channelId: string, inviteCode: string): string {
  const redirectUri = "https://rtjxurmuaawyzjcdkqxt.supabase.co/functions/v1/login-callback";
  const scope = "profile%20openid";
  const state = inviteCode;
  const botPrompt = "normal"; // 友だち追加オプション表示
  
  return `https://access.line.me/oauth2/v2.1/authorize?` +
    `response_type=code&` +
    `client_id=${channelId}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `state=${state}&` +
    `scope=${scope}&` +
    `bot_prompt=${botPrompt}`;
}

function jsonErr(code: number, msg: string) {
  return new Response(JSON.stringify({ error: msg }), {
    status: code,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}