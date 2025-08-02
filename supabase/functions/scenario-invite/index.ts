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

  /* DB チェック – 無効コードは 404 */
  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data } = await db.from("scenario_invite_codes")
    .select("id").eq("invite_code", inviteCode).eq("is_active", true).single();
  if (!data) return jsonErr(404, "invalid / expired invite code");

  /* UA で分岐 */
  const isMobile = /mobile|android|iphone|ipad|ipod/i.test(
    req.headers.get("user-agent") ?? "",
  );
  const liffId = Deno.env.get("LIFF_ID")!;
  const fe = "https://74048ab5-8d5a-425a-ab29-bd5cc50dc2fe.lovableproject.com";

  const redirect = isMobile
    ? `https://liff.line.me/${liffId}?code=${inviteCode}` // LINE アプリ
    : `${fe}/invite/${inviteCode}`;                      // PC QR

  return new Response(null, { status: 302, headers: { ...cors, Location: redirect } });
});

function jsonErr(code: number, msg: string) {
  return new Response(JSON.stringify({ error: msg }), {
    status: code,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}