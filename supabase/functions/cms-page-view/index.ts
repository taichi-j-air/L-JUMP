import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from '../_shared/cors.ts';

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
        "timer_minute_label, timer_second_label, expire_action, " +
        "timer_scenario_id, timer_step_id"
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

    // 厳格な友達認証（friends_onlyの場合）
    let friend = null;
    if (page.visibility === "friends_only") {
      if (!uid) {
        console.log("No UID provided for friends_only page - STRICT AUTHENTICATION REQUIRED");
        const { data: profile } = await supabase
          .from("profiles")
          .select("display_name, line_user_id, add_friend_url")
          .eq("user_id", page.user_id)
          .maybeSingle();

        const friendInfo = {
          account_name: profile?.display_name || null,
          line_id: profile?.line_user_id || null,
          add_friend_url: profile?.add_friend_url || null,
          message: "Authentication required. Please access through the correct link."
        };

        return new Response(
          JSON.stringify({ require_friend: true, friend_info: friendInfo }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // UIDフォーマット検証（6文字の英数字であることを確認）
      if (!/^[A-Z0-9]{6}$/i.test(uid)) {
        console.log("Invalid UID format:", uid);
        return new Response(
          JSON.stringify({ 
            error: "Invalid access code format.",
            require_friend: true,
            friend_info: { message: "Invalid access code format." }
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // 友達認証の実行 - より厳密なチェック
      const uidUpper = uid.toUpperCase().trim();
      console.log("STRICT Friend authentication check:", { uid, uidUpper, user_id: page.user_id });

      // line_friendsテーブルで直接検索（より厳密な条件）
      const { data: friendData, error: friendErr } = await supabase
        .from("line_friends")
        .select("id, line_user_id, display_name")
        .eq("user_id", page.user_id)
        .eq("short_uid_ci", uidUpper)  // 大文字小文字を区別しないフィールドを使用
        .single(); // .single()を使用してより厳密に

      console.log("Friend query result:", { friendData, friendErr });

      if (friendErr || !friendData) {
        console.log("STRICT: Friend not found - ACCESS DENIED:", { 
          friendErr, 
          uid: uidUpper, 
          user_id: page.user_id,
          errorCode: friendErr?.code,
          errorMessage: friendErr?.message 
        });
        
        const { data: profile } = await supabase
          .from("profiles")
          .select("display_name, line_user_id, add_friend_url")
          .eq("user_id", page.user_id)
          .maybeSingle();

        const friendInfo = {
          account_name: profile?.display_name || null,
          line_id: profile?.line_user_id || null,
          add_friend_url: profile?.add_friend_url || null,
          message: "Access denied. Please check your access link or contact the administrator."
        };

        return new Response(
          JSON.stringify({ require_friend: true, friend_info: friendInfo }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      friend = { id: friendData.id, line_user_id: friendData.line_user_id };
      console.log("STRICT: Friend authentication successful:", friend);

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

      // 修正されたタイマー初期設定とアクセス管理
      if (page.timer_enabled) {
        console.log("Timer enabled - managing access control");
        
        // 既存のアクセス制御をチェック
        const { data: accessData } = await supabase
          .from("friend_page_access")
          .select("*")
          .eq("friend_id", friend.id)
          .eq("page_share_code", shareCode)
          .maybeSingle();

        let currentAccessData = accessData;

        if (!accessData) {
          // 新規アクセス制御レコードを作成
          const now = new Date().toISOString();
          const insertData: any = {
            user_id: page.user_id,
            friend_id: friend.id,
            page_share_code: shareCode,
            access_enabled: true,
            access_source: 'page_view',
            first_access_at: now
          };

          // タイマー開始時刻の設定
          if (page.timer_mode === 'per_access') {
            insertData.timer_start_at = now;
            console.log("Setting timer_start_at for per_access mode:", now);
          } else if (page.timer_mode === 'step_delivery' && page.timer_scenario_id && page.timer_step_id) {
            // ステップ配信時刻を取得
            const { data: deliveryData } = await supabase
              .from("step_delivery_tracking")
              .select("delivered_at")
              .eq("friend_id", friend.id)
              .eq("scenario_id", page.timer_scenario_id)
              .eq("step_id", page.timer_step_id)
              .eq("status", "delivered")
              .maybeSingle();

            if (deliveryData?.delivered_at) {
              insertData.timer_start_at = deliveryData.delivered_at;
              insertData.scenario_id = page.timer_scenario_id;
              insertData.step_id = page.timer_step_id;
              console.log("Setting timer_start_at for step_delivery mode:", deliveryData.delivered_at);
            } else {
              // フォールバック: ステップ配信データがない場合は現在時刻
              insertData.timer_start_at = now;
              console.warn("Step delivery data not found, using current time as fallback");
            }
          } else {
            // デフォルトフォールバック
            insertData.timer_start_at = now;
          }

          const { data: newAccessData, error: insertError } = await supabase
            .from("friend_page_access")
            .insert(insertData)
            .select()
            .single();

          if (insertError) {
            console.error("Failed to create access record:", insertError);
          } else {
            currentAccessData = newAccessData;
            console.log("Created new access record:", newAccessData);
          }
        } else {
          // 既存レコードの更新 - timer_start_atが未設定の場合
          const updateData: any = {};
          
          if (!accessData.timer_start_at) {
            const now = new Date().toISOString();
            
            if (page.timer_mode === 'per_access') {
              updateData.timer_start_at = accessData.first_access_at || now;
              updateData.first_access_at = accessData.first_access_at || now;
            } else if (page.timer_mode === 'step_delivery' && page.timer_scenario_id && page.timer_step_id) {
              const { data: deliveryData } = await supabase
                .from("step_delivery_tracking")
                .select("delivered_at")
                .eq("friend_id", friend.id)
                .eq("scenario_id", page.timer_scenario_id)
                .eq("step_id", page.timer_step_id)
                .eq("status", "delivered")
                .maybeSingle();

              if (deliveryData?.delivered_at) {
                updateData.timer_start_at = deliveryData.delivered_at;
                updateData.scenario_id = page.timer_scenario_id;
                updateData.step_id = page.timer_step_id;
              } else {
                updateData.timer_start_at = now;
              }
            } else {
              updateData.timer_start_at = now;
            }

            console.log("Updating timer_start_at for existing record:", updateData);
          }

          if (!accessData.first_access_at) {
            updateData.first_access_at = new Date().toISOString();
          }

          if (Object.keys(updateData).length > 0) {
            const { data: updatedData, error: updateError } = await supabase
              .from("friend_page_access")
              .update(updateData)
              .eq("id", accessData.id)
              .select()
              .single();

            if (updateError) {
              console.error("Failed to update access record:", updateError);
            } else {
              currentAccessData = updatedData;
              console.log("Updated access record:", updatedData);
            }
          }
        }

        // 期限切れチェック（現在のアクセスデータを使用）
        if (currentAccessData && currentAccessData.timer_start_at && page.timer_duration_seconds) {
          const startTime = new Date(currentAccessData.timer_start_at);
          const expiryTime = new Date(startTime.getTime() + page.timer_duration_seconds * 1000);
          const now = new Date();
          const isExpired = now > expiryTime;

          console.log("Timer expiry check:", {
            timer_start_at: currentAccessData.timer_start_at,
            expiryTime: expiryTime.toISOString(),
            now: now.toISOString(),
            isExpired,
            expire_action: page.expire_action
          });

          if (isExpired && page.expire_action === 'hide') {
            // アクセスを無効化
            await supabase
              .from("friend_page_access")
              .update({ access_enabled: false, updated_at: new Date().toISOString() })
              .eq("id", currentAccessData.id);

            console.log("TIMER EXPIRED - ACCESS DISABLED");
            
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
              { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
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
          console.log("Access denied by allowed tags");
          
          const { data: profile } = await supabase
            .from("profiles")
            .select("display_name, line_user_id, add_friend_url")
            .eq("user_id", page.user_id)
            .maybeSingle();

          const friendInfo = {
            account_name: profile?.display_name || null,
            line_id: profile?.line_user_id || null,
            add_friend_url: profile?.add_friend_url || null,
            message: "このページを閲覧する権限がありません。必要なタグが設定されていません。"
          };

          return new Response(
            JSON.stringify({ require_friend: true, friend_info: friendInfo }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (blocked.length > 0 && blocked.some((id) => tagIds.has(id))) {
          console.log("Access denied by blocked tags");
          
          const { data: profile } = await supabase
            .from("profiles")
            .select("display_name, line_user_id, add_friend_url")
            .eq("user_id", page.user_id)
            .maybeSingle();

          const friendInfo = {
            account_name: profile?.display_name || null,
            line_id: profile?.line_user_id || null,
            add_friend_url: profile?.add_friend_url || null,
            message: "このページを閲覧する権限がありません。ブロックされたタグが設定されています。"
          };

          return new Response(
            JSON.stringify({ require_friend: true, friend_info: friendInfo }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // 期限切れ後の非表示処理をより厳密にチェック
      if (page.timer_enabled && page.expire_action === 'hide') {
        const { data: finalAccessData } = await supabase
          .from("friend_page_access")
          .select("*")
          .eq("friend_id", friend.id)
          .eq("page_share_code", shareCode)
          .maybeSingle();

        // 最終的な期限切れチェック
        let isExpired = false;
        if (page.timer_mode === 'absolute' && page.timer_deadline) {
          isExpired = new Date() > new Date(page.timer_deadline);
        } else if ((page.timer_mode === 'per_access' || page.timer_mode === 'step_delivery') && finalAccessData) {
          const startTime = finalAccessData.timer_start_at;
          if (startTime && page.timer_duration_seconds) {
            const endTime = new Date(new Date(startTime).getTime() + page.timer_duration_seconds * 1000);
            isExpired = new Date() > endTime;
            
            console.log("Final expiry check:", {
              startTime,
              endTime: endTime.toISOString(),
              now: new Date().toISOString(),
              isExpired
            });
          }
        }

        // アクセス無効化をより確実に
        if (isExpired || (finalAccessData && !finalAccessData.access_enabled)) {
          if (finalAccessData && finalAccessData.access_enabled) {
            await supabase
              .from("friend_page_access")
              .update({ access_enabled: false, updated_at: new Date().toISOString() })
              .eq("id", finalAccessData.id);
          }

          console.log("FINAL CHECK: Timer expired or access disabled");
          
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
            { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
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
      timer_scenario_id: page.timer_scenario_id || null,
      timer_step_id: page.timer_step_id || null,
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
