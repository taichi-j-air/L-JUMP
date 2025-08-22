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
    const body = await req.json();
    const { shareCode, uid, passcode } = body || {};

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

    // Fetch page by share code
    const { data: page, error: pageErr } = await supabase
      .from("cms_pages")
      .select(
        "id, user_id, title, tag_label, content, content_blocks, visibility, allowed_tag_ids, blocked_tag_ids, require_passcode, passcode, timer_enabled, timer_mode, timer_deadline, timer_duration_seconds, show_milliseconds, timer_style, timer_bg_color, timer_text_color, internal_timer, timer_text, timer_day_label, timer_hour_label, timer_minute_label, timer_second_label"
      )
      .eq("share_code", shareCode)
      .single();

    if (pageErr || !page) {
      return new Response(JSON.stringify({ error: "page not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Public pages don't require UID, friends-only pages do
    if (page.visibility === 'friends_only' && !uid) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, line_user_id, add_friend_url")
        .eq("user_id", page.user_id)
        .maybeSingle();

      const friendInfo = {
        account_name: profile?.display_name || null,
        line_id: profile?.line_user_id || null,
        add_friend_url: profile?.add_friend_url || null,
      };

      return new Response(
        JSON.stringify({ require_friend: true, friend_info: friendInfo }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate friend relationship for friends-only pages and when UID is provided
    let friend = null;
    if (page.visibility === 'friends_only' || uid) {
      if (!uid) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("display_name, line_user_id, add_friend_url")
          .eq("user_id", page.user_id)
          .maybeSingle();

        const friendInfo = {
          account_name: profile?.display_name || null,
          line_id: profile?.line_user_id || null,
          add_friend_url: profile?.add_friend_url || null,
        };

        return new Response(
          JSON.stringify({ require_friend: true, friend_info: friendInfo }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ✅ 修正：フォーム機能と同じデータベース側認証を使用
      console.log("Friend authentication check:", { uid, user_id: page.user_id });

      // 方法1: データベース関数を使用した友達認証（推奨）
      try {
        const { data: authResult, error: authErr } = await supabase
          .rpc('check_friend_access', {  // フォーム機能の認証関数を流用
            p_user_id: page.user_id,
            p_short_uid: uid
          });

        console.log("Friend auth result:", { authResult, authErr });

        if (authErr || !authResult) {
          // RPC関数が存在しない場合のフォールバック
          console.log("RPC auth failed, trying manual method...");
          
          // 方法2: 手動でフォーム機能と同じロジックを実装
          const friendCheckResult = await (async () => {
            // Step 1: 短縮UIDから元のLINE UIDに変換
            const { data: uidMapping, error: mappingErr } = await supabase
              .from("friends")
              .select("line_user_id")
              .eq("user_id", page.user_id)
              .eq("short_uid", uid)
              .single();

            if (mappingErr || !uidMapping?.line_user_id) {
              console.log("UID mapping failed:", { uid, user_id: page.user_id, mappingErr });
              return false;
            }

            const actualLineUserId = uidMapping.line_user_id;
            console.log("UID conversion successful:", { shortUid: uid, actualLineUserId });

            // Step 2: 変換された元UIDで友達関係確認
            const { data: friendData, error: friendErr } = await supabase
              .from("line_friends")
              .select("id")
              .eq("user_id", page.user_id)
              .eq("line_user_id", actualLineUserId)
              .single();

            console.log("Friend relationship check:", { friendData, friendErr });

            return !friendErr && !!friendData;
          })();

          if (!friendCheckResult) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("display_name, line_user_id, add_friend_url")
              .eq("user_id", page.user_id)
              .maybeSingle();

            const friendInfo = {
              account_name: profile?.display_name || null,
              line_id: profile?.line_user_id || null,
              add_friend_url: profile?.add_friend_url || null,
            };

            return new Response(
              JSON.stringify({ require_friend: true, friend_info: friendInfo }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }

        // 友達認証成功
        friend = { id: "verified" };
        console.log("Friend authentication successful");

      } catch (error) {
        console.error("Friend authentication error:", error);
        
        // エラー時は友達追加を要求
        const { data: profile } = await supabase
          .from("profiles")
          .select("display_name, line_user_id, add_friend_url")
          .eq("user_id", page.user_id)
          .maybeSingle();

        const friendInfo = {
          account_name: profile?.display_name || null,
          line_id: profile?.line_user_id || null,
          add_friend_url: profile?.add_friend_url || null,
        };

        return new Response(
          JSON.stringify({ require_friend: true, friend_info: friendInfo }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Passcode check if required
    if (page.require_passcode) {
      if (!passcode || passcode !== page.passcode) {
        return new Response(JSON.stringify({ require_passcode: true }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Tag segmentation (only apply if friend relationship exists)
    if (friend && friend.id !== "verified") {
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

    // Build payload
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
