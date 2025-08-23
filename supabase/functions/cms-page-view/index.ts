import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

// 未変換・ダミー値を無効とする（例: [UID], UID, 空, null, undefined）
const isPlaceholder = (v?: string | null) => {
  if (v == null) return true;
  const s = String(v).trim();
  if (!s) return true;
  const lower = s.toLowerCase();
  return ["[uid]", "uid", "[[uid]]", "{uid}", "undefined", "null"].includes(lower);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // クエリ/JSONの両方から取得
    const url = new URL(req.url);
    const isJSON = req.headers.get("content-type")?.includes("application/json");
    const body = isJSON && req.method === "POST" ? await req.json().catch(() => ({})) : {};

    const shareCode = (body.shareCode ?? url.searchParams.get("shareCode") ?? "").trim();
    const passcode  = (body.passcode  ?? url.searchParams.get("passcode")  ?? "") || undefined;

    // フォーム同等：uid or line_user_id どちらでも照合可
    let uid: string | undefined = body.uid ?? url.searchParams.get("uid") ?? body.suid ?? url.searchParams.get("suid") ?? undefined;
    let lineUserId: string | undefined = body.line_user_id ?? url.searchParams.get("line_user_id") ?? url.searchParams.get("lu") ?? undefined;

    // 未変換/ダミーを無効化
    if (isPlaceholder(uid)) uid = undefined; else uid = String(uid).trim();
    if (isPlaceholder(lineUserId)) lineUserId = undefined; else lineUserId = String(lineUserId).trim();

    const uidUpper = uid ? uid.toUpperCase() : undefined;

    if (!shareCode) {
      return new Response(JSON.stringify({ error: "shareCode is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ページ取得
    const { data: page, error: pageErr } = await supabase
      .from("cms_pages")
      .select(
        "id, user_id, title, tag_label, content, content_blocks, visibility, " +
        "allowed_tag_ids, blocked_tag_ids, require_passcode, passcode, " +
        "timer_enabled, timer_mode, timer_deadline, timer_duration_seconds, " +
        "show_milliseconds, timer_style, timer_bg_color, timer_text_color, " +
        "internal_timer, timer_text, timer_day_label, timer_hour_label, " +
        "timer_minute_label, timer_second_label"
      )
      .eq("share_code", shareCode)
      .maybeSingle();

    if (pageErr || !page) {
      return new Response(JSON.stringify({ error: "page not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== 友だち認証（厳格）=====
    let friend: { id: string | number; line_user_id: string } | null = null;

    if (page.visibility === "friends_only") {
      // A) uid で照合（short_uid / short_uid_ci の OR）
      if (uid || uidUpper) {
        const orParts = [
          uid ? `short_uid.eq.${uid}` : "",
          uidUpper ? `short_uid_ci.eq.${uidUpper}` : "",
        ].filter(Boolean).join(",");

        if (orParts) {
          const { data: f1 } = await supabase
            .from("line_friends")
            .select("id, line_user_id")
            .eq("user_id", page.user_id) // テナント一致
            .or(orParts)
            .maybeSingle();

          if (f1) {
            friend = { id: f1.id, line_user_id: f1.line_user_id };
          }
        }
      }

      // B) 見つからず、かつ line_user_id があれば照合（LIFF想定）
      if (!friend && lineUserId) {
        const { data: f2 } = await supabase
          .from("line_friends")
          .select("id, line_user_id")
          .eq("user_id", page.user_id)
          .eq("line_user_id", lineUserId)
          .maybeSingle();

        if (f2) {
          friend = { id: f2.id, line_user_id: f2.line_user_id };
        }
      }

      // C) 友だち確定できなければ 403（payload は返さない）
      if (!friend) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("display_name, line_user_id, add_friend_url")
          .eq("user_id", page.user_id)
          .maybeSingle();

        return new Response(
          JSON.stringify({
            require_friend: true,
            friend_info: {
              account_name: profile?.display_name || null,
              line_id: profile?.line_user_id || null,
              add_friend_url: profile?.add_friend_url || null,
            },
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ===== パスコード（厳格）=====
    if (page.require_passcode) {
      if (!passcode || passcode !== page.passcode) {
        return new Response(JSON.stringify({ require_passcode: true }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ===== タグ制御 =====
    if (friend) {
      const allowed: string[] = Array.isArray(page.allowed_tag_ids) ? page.allowed_tag_ids : [];
      const blocked: string[] = Array.isArray(page.blocked_tag_ids) ? page.blocked_tag_ids : [];

      if (allowed.length > 0 || blocked.length > 0) {
        const { data: friendTags } = await supabase
          .from("friend_tags")
          .select("tag_id")
          .eq("user_id", page.user_id)
          .eq("friend_id", friend.id);

        const tagIds = new Set((friendTags || []).map((t: any) => t.tag_id));

        if (allowed.length > 0 && !allowed.some((id) => tagIds.has(id))) {
          return new Response(JSON.stringify({ error: "forbidden by allowed tags" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (blocked.length > 0 && blocked.some((id) => tagIds.has(id))) {
          return new Response(JSON.stringify({ error: "forbidden by blocked tags" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    // ===== コンテンツ返却（認可済みのみ）=====
    const payload = {
      title: page.title,
      tag_label: page.tag_label,
      content: page.content,
      content_blocks: Array.isArray(page.content_blocks) ? page.content_blocks : [],
      timer_enabled: !!page.timer_enabled,
      timer_mode: page.timer_mode || "absolute",
      timer_deadline: page.timer_deadline,
      timer_duration_seconds: page.timer_duration_seconds,
      show_milliseconds: !!page.show_milliseconds,
      timer_style: page.timer_style || "solid",
      timer_bg_color: page.timer_bg_color || "#0cb386",
      timer_text_color: page.timer_text_color || "#ffffff",
      internal_timer: !!page.internal_timer,
      timer_text: page.timer_text,
      timer_day_label: page.timer_day_label || null,
      timer_hour_label: page.timer_hour_label || null,
      timer_minute_label: page.timer_minute_label || null,
      timer_second_label: page.timer_second_label || null,
    };

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("cms-page-view error", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
