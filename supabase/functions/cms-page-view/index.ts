import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Cache-Control": "no-store",
};

// 未変換/ダミー UID を弾く
const isPlaceholder = (v?: string | null) => {
  if (v == null) return true;
  const s = String(v).trim();
  if (!s) return true;
  const lower = s.toLowerCase();
  return ["[uid]", "uid", "[[uid]]", "{uid}", "<uid>", "__uid__", "undefined", "null"].includes(lower)
      || /^[\[\{<\(_\-\s]*uid[\]\}>\)\_\-\s]*$/i.test(s);
};

// visibility を正規化（記法ゆれ対策）
const normalizeVis = (v: any) =>
  String(v ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_"); // "friends-only"等→"friends_only"

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const isJSON = req.headers.get("content-type")?.includes("application/json");
    const body = isJSON && req.method === "POST" ? await req.json().catch(() => ({})) : {};

    const shareCode = (body.shareCode ?? url.searchParams.get("shareCode") ?? "").trim();
    const passcode  = (body.passcode  ?? url.searchParams.get("passcode")  ?? "") || undefined;

    // uid は URL か body のどちらでも可（今回は「uidだけ」を使う）
    const uidParamRaw = url.searchParams.get("uid") ?? url.searchParams.get("suid");
    const hasUidParam = uidParamRaw !== null;
    let uid: string | undefined = (uidParamRaw ?? body.uid ?? body.suid) ?? undefined;
    if (uid != null) uid = String(uid).trim();

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

    const vis = normalizeVis(page.visibility);
    const isFriendsOnly = vis === "friends_only";

    // ---- 友だち限定：uid 必須 ＆ 登録済みUIDのみ許可（LIFFは一切見ない）----
    if (isFriendsOnly) {
      // uid が無い or 未変換 → 即 403
      if (!hasUidParam || isPlaceholder(uid)) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("display_name, line_user_id, add_friend_url")
          .eq("user_id", page.user_id)
          .maybeSingle();

        return new Response(
          JSON.stringify({
            require_friend: true,
            reason: !hasUidParam ? "uid_missing" : "uid_placeholder",
            friend_info: {
              account_name: profile?.display_name || null,
              line_id: profile?.line_user_id || null,
              add_friend_url: profile?.add_friend_url || null,
            },
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // 登録済みUID（同一 user_id の友だち）かを厳密チェック
      // 大文字小文字を吸収するため ilike を使用（UIDは英数想定）
      const { data: friend } = await supabase
        .from("line_friends")
        .select("id, line_user_id")
        .eq("user_id", page.user_id)   // ← ここが最重要：同じアカウントの友だち限定
        .ilike("short_uid", uid!)      // ← case-insensitive 一致
        .maybeSingle();

      if (!friend) {
        // その uid は当該アカウントの友だちとして登録がない → 403
        const { data: profile } = await supabase
          .from("profiles")
          .select("display_name, line_user_id, add_friend_url")
          .eq("user_id", page.user_id)
          .maybeSingle();

        return new Response(
          JSON.stringify({
            require_friend: true,
            reason: "uid_not_found",
            friend_info: {
              account_name: profile?.display_name || null,
              line_id: profile?.line_user_id || null,
              add_friend_url: profile?.add_friend_url || null,
            },
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // （必要ならここで allowed / blocked タグ制御）
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

    // ---- パスコード（必要なページのみ）----
    if (page.require_passcode) {
      if (!passcode || passcode !== page.passcode) {
        return new Response(JSON.stringify({ require_passcode: true }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ---- 認可OK：中身を返す ----
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
