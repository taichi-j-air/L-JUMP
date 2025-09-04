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

const replaceUid = (n: any, uid: string): any => {
  if (n == null) return n;
  if (Array.isArray(n)) return n.map((x) => replaceUid(x, uid));
  if (typeof n === "object") return Object.fromEntries(Object.entries(n).map(([k, v]) => [k, replaceUid(v, uid)]));
  return typeof n === "string" ? n.replace(/\[UID]/g, uid) : n;
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

  // ① すでに flex ラップ済み
  if (input.type === "flex" && input.contents)
    return { type: "flex", altText: input.altText?.trim() || "お知らせ", contents: sanitize(input.contents) };

  // ② bubble / carousel がルート
  if (["bubble", "carousel"].includes(input.type))
    return { type: "flex", altText: "お知らせ", contents: sanitize(input) };

  // ③ { contents: {...}, altText } 形式
  if (input.contents && ["bubble", "carousel"].includes(input.contents.type))
    return { type: "flex", altText: input.altText?.trim() || "お知らせ", contents: sanitize(input.contents) };

  return null;
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
      return new Response(JSON.stringify({ error: "JSON解析失敗", details: e.message }), {
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
        return new Response(JSON.stringify({ error: "flexMessage JSONが不正です", details: e.message }), {
          headers: { ...cors, "Content-Type": "application/json" },
          status: 400,
        });
      }
    }

    // ─ Supabase
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // LINE 資格情報
    const { data: cred, error: credErr } = await supabase.rpc("get_line_credentials_for_user", {
      p_user_id: userId,
    });
    if (credErr || !cred?.channel_access_token)
      return new Response(JSON.stringify({ error: "LINE資格情報エラー", details: credErr }), {
        headers: { ...cors, "Content-Type": "application/json" },
        status: 400,
      });

    // 友だち一覧
    const { data: friends, error: fErr } = await supabase
      .from("line_friends")
      .select("line_user_id, short_uid")
      .eq("user_id", userId);
    if (fErr) throw fErr;
    if (!friends?.length)
      return new Response(JSON.stringify({ error: "友だちが見つかりません" }), {
        headers: { ...cors, "Content-Type": "application/json" },
        status: 400,
      });

    // ─ Push loop
    const results: { lineUserId: string; success: boolean; error?: any }[] = [];
    for (const { line_user_id, short_uid } of friends) {
      const withUid = short_uid ? replaceUid(clone(flex), short_uid) : flex;
      const normalized = normalize(withUid);

      if (!normalized) {
        results.push({ lineUserId: line_user_id, success: false, error: "Flex形式不正" });
        continue;
      }

      const res = await fetch("https://api.line.me/v2/bot/message/push", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cred.channel_access_token}`,
        },
        body: JSON.stringify({ to: line_user_id, messages: [normalized] }),
      });

      if (res.ok) {
        results.push({ lineUserId: line_user_id, success: true });
      } else {
        const err = await (async () => {
          try {
            return await res.json();
          } catch {
            return await res.text();
          }
        })();
        results.push({ lineUserId: line_user_id, success: false, error: err });
      }
    }

    const ok = results.filter((r) => r.success).length;
    return new Response(
      JSON.stringify({
        success: true,
        message: `送信 成功${ok} 失敗${results.length - ok}`,
        results,
      }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: "予期しないエラー", details: e.message }), {
      headers: { ...cors, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
