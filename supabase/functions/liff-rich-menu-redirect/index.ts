import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PLACEHOLDER_UID_VALUES = new Set(["[UID]", "UID", "NULL", "", null, undefined]);

const KNOWN_UID_PATH_PATTERNS = [
  /\/form\//,
  /\/liff-form\//,
  /\/liff-form-secure\//,
  /\/cms\/f\//,
  /\/member-site\//,
  /\/product-landing\//,
  /\/ewp\//,
];

type ResolveRequest = {
  ownerUserId?: string;
  lineUserId?: string;
  target?: string;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const { ownerUserId, lineUserId, target }: ResolveRequest = await req.json();

    if (!ownerUserId || !lineUserId || !target) {
      return jsonError("ownerUserId, lineUserId and target are required", 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: friendData, error: friendError } = await supabase
      .from("line_friends")
      .select("short_uid, display_name")
      .eq("user_id", ownerUserId)
      .eq("line_user_id", lineUserId)
      .maybeSingle();

    if (friendError) {
      console.error("Failed to load friend data", friendError);
      return jsonError("Could not resolve friend information", 500);
    }

    const shortUid = normalizeUid(friendData?.short_uid ?? null);
    const displayName = sanitizeDisplayName(friendData?.display_name ?? "Friend");

    let finalUrl = applyTokenReplacements(target, {
      "[UID]": shortUid ?? "",
      "[LINE_NAME]": displayName,
      "[LINE_NAME_SAN]": displayName,
    });

    if (shortUid) {
      finalUrl = maybeAppendUidParam(finalUrl, shortUid);
    }

    const urlInfo = analyzeUrl(finalUrl);

    return new Response(JSON.stringify({
      success: true,
      url: finalUrl,
      hasUid: Boolean(shortUid),
      openExternal: urlInfo.openExternal,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("liff-rich-menu-redirect error", error);
    return jsonError((error as Error)?.message ?? "Unknown error", 500);
  }
});

function jsonError(message: string, status = 400) {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function applyTokenReplacements(value: string, tokens: Record<string, string>): string {
  let result = value;
  for (const [token, replacement] of Object.entries(tokens)) {
    if (!token) continue;
    const safeReplacement = replacement ?? "";
    const pattern = new RegExp(escapeRegExp(token), "g");
    result = result.replace(pattern, safeReplacement);
  }
  return result;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeUid(uid: string | null): string | null {
  if (!uid) return null;
  const trimmed = uid.trim().toUpperCase();
  return PLACEHOLDER_UID_VALUES.has(trimmed) ? null : trimmed;
}

function sanitizeDisplayName(name: string) {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "Friend";
  if (/^[\p{Letter}\p{Number}\p{Mark}\p{Punctuation}\p{Symbol}\s]+$/u.test(trimmed)) {
    return trimmed;
  }
  return "Friend";
}

function maybeAppendUidParam(urlString: string, uid: string): string {
  try {
    const url = new URL(urlString);
    if (!url.searchParams.has("uid") && KNOWN_UID_PATH_PATTERNS.some((pattern) => pattern.test(url.pathname))) {
      url.searchParams.set("uid", uid);
      return url.toString();
    }
    return urlString;
  } catch (_error) {
    return urlString;
  }
}

function analyzeUrl(urlString: string) {
  try {
    const url = new URL(urlString);
    const envOrigins = [
      Deno.env.get("PUBLIC_APP_URL") ?? "",
      Deno.env.get("PUBLIC_SITE_URL") ?? "",
      Deno.env.get("SUPABASE_URL") ?? "",
    ].filter(Boolean);

    const appOrigins = new Set(envOrigins.map((origin) => {
      try {
        const parsed = new URL(origin);
        return `${parsed.protocol}//${parsed.host}`;
      } catch (_err) {
        return origin;
      }
    }).filter(Boolean));

    if (appOrigins.size === 0) {
      return { openExternal: false };
    }

    const currentOrigin = `${url.protocol}//${url.host}`;
    const openExternal = !appOrigins.has(currentOrigin);

    return { openExternal };
  } catch (_error) {
    return { openExternal: false };
  }
}
