// deno.json の import_map を使わない場合は URL を直書きしてください
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

// ────────────────────── 共通ヘッダー
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ────────────────────── 汎用ユーティリティ
const clone = <T>(v: T): T => (v == null ? v : JSON.parse(JSON.stringify(v)));

const replaceTokens = (
  n: any,
  uid: string | null,
  lineName: string | null,
  lineNameSan: string | null,
): any => {
  if (n == null) return n;
  if (Array.isArray(n)) return n.map((x) => replaceTokens(x, uid, lineName, lineNameSan));
  if (typeof n === "object") {
    return Object.fromEntries(
      Object.entries(n).map(([k, v]) => [k, replaceTokens(v, uid, lineName, lineNameSan)]),
    );
  }
  if (typeof n === "string") {
    let result = n;
    if (uid) {
      result = result.replace(/\[UID\]/g, uid);
    }
    if (lineNameSan) {
      result = result.replace(/\[LINE_NAME_SAN\]/g, lineNameSan);
    }
    if (lineName) {
      result = result.replace(/\[LINE_NAME\]/g, lineName);
    }
    return result;
  }
  return n;
};

// ────────────────────── LINE Flex 用サニタイズ
function sanitize(node: any): any {
  if (node == null) return node;
  if (Array.isArray(node)) return node.map(sanitize);

  if (typeof node === "object") {
    // 型ごとに LINE が許容しないキーを定義
    const invalid: Record<string, Set<string>> = {
      text: new Set(["backgroundColor", "padding", "borderRadius", "borderWidth", "borderColor", "className"]),
      image: new Set(["className"]),
      box: new Set(["className"]),
      button: new Set(["className"]),
    };

    const t = node.type as string | undefined;
    const out: any = {};
    for (const [k, v] of Object.entries(node)) {
      if (t && invalid[t]?.has(k)) continue;
      out[k] = sanitize(v);
    }
    return out;
  }
  return node;
}

// ────────────────────── Flex 正規化
function normalize(input: any) {
  if (!input) return null;

  let normalized: any = null;

  // ① すでに flex ラップ済み
  if (input.type === "flex" && input.contents) {
    normalized = { type: "flex", altText: input.altText?.trim() || "お知らせ", contents: sanitize(input.contents) };
  }
  // ② bubble / carousel がルート
  else if (["bubble", "carousel"].includes(input.type)) {
    normalized = { type: "flex", altText: "お知らせ", contents: sanitize(input) };
  }
  // ③ { contents: {...}, altText } 形式
  else if (input.contents && ["bubble", "carousel"].includes(input.contents.type)) {
    normalized = { type: "flex", altText: input.altText?.trim() || "お知らせ", contents: sanitize(input.contents) };
  }

  if (!normalized) return null;

  // ★★★ styles.body.backgroundColor を contents.body.backgroundColor に適用する処理を追加 ★★★
  if (input.styles?.body?.backgroundColor && normalized.contents?.type === 'bubble' && normalized.contents.body) {
    // 元のbodyにbackgroundColorがすでにある場合でも、styles側を優先して上書きする
    normalized.contents.body.backgroundColor = input.styles.body.backgroundColor;
  }

  return normalized;
}

// ────────────────────── メイン
serve(async (req) => {
  // CORS pre-flight
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    // ─ Authentication
    if (!req.headers.get("Authorization"))
      return new Response(JSON.stringify({ error: "認証が必要です" }), {
        headers: { ...cors, "Content-Type": "application/json" },
        status: 401,
      });

    // ─ Parse body
    let body: any;
    try {
      body = await req.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: "JSON解析失敗", details: (e as Error)?.message || 'Unknown error' }), {
        headers: { ...cors, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const { flexMessage: rawFlex, userId } = body;
    if (!userId || !rawFlex)
      return new Response(JSON.stringify({ error: "userId と flexMessage は必須です" }), {
        headers: { ...cors, "Content-Type": "application/json" },
        status: 400,
      });

    // ─ flexMessage を必ずオブジェクト化
    let flex: any = rawFlex;
    if (typeof rawFlex === "string") {
      try {
        flex = JSON.parse(rawFlex);
      } catch (e) {
        return new Response(JSON.stringify({ error: "flexMessage JSONが不正です", details: (e as Error)?.message || 'Unknown error' }), {
          headers: { ...cors, "Content-Type": "application/json" },
          status: 400,
        });
      }
    }

    // ─ Supabase (Service Role)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    console.log("Supabase client created with service role");

    // LINE 資格情報の取得 - 直接テーブルクエリで試行
    console.log("Fetching LINE credentials for user:", userId);
    const { data: cred, error: credErr } = await supabase
      .from("secure_line_credentials")
      .select("credential_type, encrypted_value")
      .eq("user_id", userId)
      .in("credential_type", ["channel_access_token"]);
    
    if (credErr) {
      console.error("LINE credentials query error:", credErr);
      return new Response(JSON.stringify({ error: "LINE資格情報取得エラー", details: credErr.message }), {
        headers: { ...cors, "Content-Type": "application/json" },
        status: 400,
      });
    }

    console.log("Raw credentials data:", cred);

    const accessTokenRecord = cred?.find(c => c.credential_type === "channel_access_token");
    const encryptedToken = accessTokenRecord?.encrypted_value;

    if (!encryptedToken) {
      console.error("No channel access token found in credentials:", cred);
      return new Response(JSON.stringify({ error: "LINE Channel Access Tokenが設定されていません" }), {
        headers: { ...cors, "Content-Type": "application/json" },
        status: 400,
      });
    }

    let channelAccessToken: string;
    try {
      // --- 復号化処理 ---
      if (!encryptedToken.startsWith("enc:")) {
        throw new Error("Invalid encrypted value format");
      }
      const encryptedData = atob(encryptedToken.substring(4));
      const combinedArray = new Uint8Array(encryptedData.length);
      for (let i = 0; i < encryptedData.length; i++) {
        combinedArray[i] = encryptedData.charCodeAt(i);
      }
      const iv = combinedArray.slice(0, 12);
      const encrypted = combinedArray.slice(12);
      const userKey = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(userId.substring(0, 32).padEnd(32, "0")),
        { name: "AES-GCM" },
        false,
        ["decrypt"]
      );
      const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        userKey,
        encrypted
      );
      channelAccessToken = new TextDecoder().decode(decrypted);
      // --- 復号化処理ここまで ---
    } catch (e) {
      console.error("Failed to decrypt access token:", e);
      return new Response(JSON.stringify({ error: "アクセストークンの復号に失敗しました", details: e.message }), {
        headers: { ...cors, "Content-Type": "application/json" },
        status: 500,
      });
    }
    
    console.log("LINE credentials fetched and decrypted successfully");

    // 友だち一覧の取得（Service Roleで直接クエリ）
    console.log("Fetching friends list for user:", userId);
    const { data: friends, error: fErr } = await supabase
      .from("line_friends")
      .select("line_user_id, short_uid, display_name")
      .eq("user_id", userId);
      
    if (fErr) {
      console.error("Friends fetch error:", fErr);
      return new Response(JSON.stringify({ error: "友だち一覧取得エラー", details: fErr.message }), {
        headers: { ...cors, "Content-Type": "application/json" },
        status: 500,
      });
    }

    if (!friends?.length) {
      console.log("No friends found for user:", userId);
      return new Response(JSON.stringify({ error: "配信対象の友だちが見つかりません。LINE友だちを追加してください。" }), {
        headers: { ...cors, "Content-Type": "application/json" },
        status: 400,
      });
    }

    console.log(`Found ${friends.length} friends for user:`, userId);

    // ─ Flexメッセージの配信処理
    console.log("Starting flex message delivery to", friends.length, "friends");
    const results: { lineUserId: string; success: boolean; error?: any }[] = [];
    
    for (const friend of friends) {
      const lineUserId = friend.line_user_id;
      const shortUid = friend.short_uid ?? null;
      console.log(`Processing friend: ${lineUserId}, short_uid: ${shortUid}`);

      const rawDisplayName = typeof friend.display_name === "string" ? friend.display_name.trim() : "";
      const fallbackName = rawDisplayName.length > 0 ? rawDisplayName : "あなた";
      const fallbackNameSan = fallbackName === "あなた" ? "あなた" : `${fallbackName}さん`;

      let normalized: any;
      try {
        const withTokens = replaceTokens(clone(flex), shortUid, fallbackName, fallbackNameSan);
        normalized = normalize(withTokens);

        if (!normalized) {
          console.error(`Flex message normalization failed for ${lineUserId}`);
          results.push({ lineUserId, success: false, error: "Flex形式不正" });
          continue;
        }
      } catch (tokenError) {
        const tokenErrorMessage = tokenError instanceof Error ? tokenError.message : String(tokenError);
        console.error(`Token replacement failed for ${lineUserId}:`, tokenError);
        results.push({ lineUserId, success: false, error: `Token replacement failed: ${tokenErrorMessage}` });
        continue;
      }

      console.log(`Sending message to ${lineUserId}`);
      try {
        const res = await fetch("https://api.line.me/v2/bot/message/push", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${channelAccessToken}`,
          },
          body: JSON.stringify({ to: lineUserId, messages: [normalized] }),
        });

        if (res.ok) {
          console.log(`Successfully sent message to ${lineUserId}`);
          results.push({ lineUserId, success: true });
        } else {
          console.error(`Failed to send message to ${lineUserId}, status: ${res.status}`);
          const errorText = await res.text();
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            errorData = errorText;
          }
          console.error(`LINE API error response:`, errorData);
          results.push({ lineUserId, success: false, error: errorData });
        }
      } catch (fetchError) {
        const fetchErrorMessage = fetchError instanceof Error ? fetchError.message : String(fetchError);
        console.error(`Network error when sending to ${lineUserId}:`, fetchError);
        results.push({ lineUserId, success: false, error: `Network error: ${fetchErrorMessage}` });
      }
    }
    const ok = results.filter((r) => r.success).length;
    const failed = results.length - ok;
    
    console.log(`Delivery completed: ${ok} success, ${failed} failed`);
    
    return new Response(
      JSON.stringify({
        success: true,
        message: `送信 成功${ok} 失敗${failed}`,
        results,
        summary: {
          total: results.length,
          successful: ok,
          failed: failed
        }
      }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("Unexpected error in send-flex-message:", e);
    return new Response(JSON.stringify({ error: "予期しないエラー", details: e.message, stack: e.stack }), {
      headers: { ...cors, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
