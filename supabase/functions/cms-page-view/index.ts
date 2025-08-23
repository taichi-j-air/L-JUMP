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

    // ページ取得
    const { data: page, error: pageErr } = await supabase
      .from("cms_pages")
      .select(
        "id, user_id, title, tag_label, content, content_blocks, visibility, " +
        "allowed_tag_ids, blocked_tag_ids, require_passcode, passcode, " +
        "timer_enabled, timer_mode, timer_deadline, timer_duration_seconds, " +
        "show_milliseconds, timer_style, timer_bg_color, timer_text_color, " +
        "internal_timer, timer_text, timer_day_label, timer_hour_label, " +
        "timer_minute_label, timer_second_label, expire_action, timer_mode_step_delivery"
      )
      .eq("share_code", shareCode)
      .single();

    if (pageErr || !page) {
      console.log("Page not found:", { shareCode, pageErr });
      return new Response(JSON.stringify({ error: "page not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Page found:", { id: page.id, user_id: page.user_id, visibility: page.visibility });

    // 友達認証（friends_onlyの場合）
    let friend = null;
    if (page.visibility === "friends_only") {
      if (!uid) {
        console.log("No UID provided for friends_only page");
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
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // 友達認証の実行
      const uidUpper = uid.toUpperCase().trim();
      console.log("Friend authentication check:", { uid, uidUpper, user_id: page.user_id });

      // line_friendsテーブルで直接検索
      const { data: friendData, error: friendErr } = await supabase
        .from("line_friends")
        .select("id, line_user_id")
        .eq("user_id", page.user_id)
        .eq("short_uid_ci", uidUpper)  // 大文字小文字を区別しないフィールドを使用
        .maybeSingle();

      console.log("Friend query result:", { friendData, friendErr });

      if (friendErr || !friendData) {
        console.log("Friend not found:", { friendErr, uid: uidUpper, user_id: page.user_id });
        
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
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      friend = { id: friendData.id, line_user_id: friendData.line_user_id };
      console.log("Friend authentication successful:", friend);

      // 友達別のページアクセス制御をチェック
      const { data: accessData } = await supabase
        .from("friend_page_access")
        .select("*")
        .eq("friend_id", friend.id)
        .eq("page_share_code", shareCode)
        .maybeSingle();

      // アクセス制御レコードが存在し、access_enabledがfalseの場合
      if (accessData && !accessData.access_enabled) {
        console.log("Access disabled for friend:", { friend_id: friend.id, shareCode });
        
        const { data: profile } = await supabase
          .from("profiles")
          .select("display_name, line_user_id, add_friend_url")
          .eq("user_id", page.user_id)
          .maybeSingle();

        const friendInfo = {
          account_name: profile?.display_name || null,
          line_id: profile?.line_user_id || null,
          add_friend_url: profile?.add_friend_url || null,
          message: "このページの閲覧期限が終了しました。"
        };

        return new Response(
          JSON.stringify({ require_friend: true, friend_info: friendInfo }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // 初回アクセス時の記録（per_accessタイマー用）
      if (page.timer_enabled && page.timer_mode === 'per_access') {
        if (!accessData) {
          // 新規アクセス制御レコードを作成
          await supabase
            .from("friend_page_access")
            .insert({
              user_id: page.user_id,
              friend_id: friend.id,
              page_share_code: shareCode,
              first_access_at: new Date().toISOString(),
              access_enabled: true,
              access_source: 'page_view'
            });
        } else if (!accessData.first_access_at) {
          // 初回アクセス時刻を記録
          await supabase
            .from("friend_page_access")
            .update({ first_access_at: new Date().toISOString() })
            .eq("id", accessData.id);
        }
      }
    }

    // パスコード認証
    if (page.require_passcode) {
      console.log("Passcode check:", { 
        required: page.require_passcode, 
        provided: !!passcode,
        match: passcode === page.passcode 
      });

      if (!passcode || passcode !== page.passcode) {
        return new Response(JSON.stringify({ require_passcode: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      console.log("Passcode authentication successful");
    }

    // タグ制御（友達確定時のみ）
    if (friend) {
      const allowed = Array.isArray(page.allowed_tag_ids) ? page.allowed_tag_ids : [];
      const blocked = Array.isArray(page.blocked_tag_ids) ? page.blocked_tag_ids : [];

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

    // ページ内容を返却
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

    console.log("Success - returning page content");
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
