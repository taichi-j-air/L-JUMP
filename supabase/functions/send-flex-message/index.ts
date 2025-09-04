// deno deploy --import-map=import_map.json
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/* ---------- 汎用ユーティリティ ---------- */
function deepClone<T>(obj: T): T {
  return obj == null ? obj : JSON.parse(JSON.stringify(obj));
}
function deepReplaceUID(node: any, uid: string): any {
  if (node == null) return node;
  if (Array.isArray(node)) return node.map((v) => deepReplaceUID(v, uid));
  if (typeof node === "object") {
    const out: any = {};
    for (const [k, v] of Object.entries(node)) out[k] = deepReplaceUID(v, uid);
    return out;
  }
  return typeof node === "string" ? node.replace(/\[UID]/g, uid) : node;
}
function addUidSafely(flex: any, uid: string | null) {
  return uid ? deepReplaceUID(deepClone(flex), uid) : flex;
}

/* ---------- LINE用サニタイズ ---------- */
function sanitizeFlex(node: any): any {
  if (node == null) return node;
  if (Array.isArray(node)) return node.map(sanitizeFlex);

  if (typeof node === "object") {
    const invalidByType: Record<string, Set<string>> = {
      text: new Set(["backgroundColor", "borderRadius", "borderWidth", "borderColor", "padding"]),
      image: new Set(["className"]),
      box: new Set(["className"]),
      button: new Set(["className"]),
    };

    const out: any = {};
    const t = (node.type as string) ?? "";
    for (const [k, v] of Object.entries(node)) {
      if (invalidByType[t]?.has(k)) {
        console.log(`[sanitizeFlex] remove ${k} from ${t}`);
        continue;
      }
      out[k] = sanitizeFlex(v);
    }
    return out;
  }
  return node;
}

/* ---------- Flex 正規化 ---------- */
function normalizeFlex(input: any) {
  if (!input) return null;
  if (input.type === "flex" && input.contents) {
    return { type: "flex", altText: input.altText?.trim() || "お知らせ", contents: sanitizeFlex(input.contents) };
  }
  if (["bubble", "carousel"].includes(input.type)) {
    return { type: "flex", altText: "お知らせ", contents: sanitizeFlex(input) };
  }
  if (input.contents && ["bubble", "carousel"].includes(input.contents.type)) {
    return { type: "flex", altText: input.altText?.trim() || "お知らせ", contents: sanitizeFlex(input.contents) };
  }
  return null;
}

/* ---------- メイン ---------- */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    /* ----- 認証 ----- */
    if (!req.headers.get("Authorization"))
      return new Response(JSON.stringify({ error: "認証が必要です" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });

    /* ----- ボディ取得 ----- */
    let body: any;
    try {
      body = await req.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: "JSON解析失敗", details: e.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const { flexMessage: rawFlex, userId } = body;
    if (!userId || !rawFlex)
      return new Response(JSON.stringify({ error: "userId と flexMessage は必須です" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });

    /* ----- Flex解析 ----- */
    let flex: any = rawFlex;
    if (typeof rawFlex === "string") {
      try {
        flex = JSON.parse(rawFlex);
      } catch (e) {
        return new Response(JSON.stringify({ error: "flexMessage JSONが不正です", details: e.message }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }
    }

    /* ----- Supabase 初期化 ----- */
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    /* ----- 認証情報取得 ----- */
    const { data: cred, error: credErr } = await supabase.rpc("get_line_credentials_for_user", { p_user_id: userId });
    if (credErr || !cred?.channel_access_token)
      return new Response(JSON.stringify({ error: "LINE資格情報エラー", details: credErr }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });

    /* ----- 友だち一覧取得 ----- */
    const { data: friends, error: fErr } = await supabase
      .from("line_friends")
      .select("line_user_id, short_uid")
      .eq("user_id", userId);

    if (fErr) throw fErr;
    if (!friends?.length)
      return new Response(JSON.stringify({ error: "友だちが見つかりません" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });

    /* ----- 配信ループ ----- */
    const results: { lineUserId: string; success: boolean; error?: any }[] = [];
    for (const { line_user_id, short_uid } of friends) {
      const withUid = addUidSafely(flex, short_uid ?? null);
      const normalized = normalizeFlex(withUid);

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
        let err;
        try {
          err = await res.json();
        } catch {
          err = await res.text();
        }
        results.push({ lineUserId: line_user_id, success: false, error: err });
      }
    }

    const ok = results.filter((r) => r.success).length;
    return new Response(JSON.stringify({ success: true, message: `送信 成功${ok} 失敗${results.length - ok}`, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: "予期しないエラー", details: e.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
