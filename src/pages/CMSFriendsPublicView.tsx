import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DOMPurify, { Config as DOMPurifyConfig } from "dompurify";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TimerPreview } from "@/components/TimerPreview";
import FormEmbedComponent from "@/components/FormEmbedComponent";
import { X } from "lucide-react";

interface PagePayload {
  title: string;
  tag_label?: string | null;
  content?: string | null;
  content_blocks?: string[];
  timer_enabled?: boolean;
  timer_mode?: "absolute" | "per_access" | "step_delivery";
  timer_deadline?: string | null;
  timer_duration_seconds?: number | null;
  show_milliseconds?: boolean;
  timer_style?: "solid" | "glass" | "outline";
  timer_bg_color?: string;
  timer_text_color?: string;
  internal_timer?: boolean;
  timer_text?: string | null;
  timer_day_label?: string | null;
  timer_hour_label?: string | null;
  timer_minute_label?: string | null;
  timer_second_label?: string | null;
  timer_scenario_id?: string | null;
  timer_step_id?: string | null;
  expire_action?: "hide_page" | "keep_public";
  show_remaining_text?: boolean;
  show_end_date?: boolean;
}

interface FriendInfo {
  account_name: string | null;
  line_id: string | null;
  add_friend_url: string | null;
  message?: string;
}

type KnownErrors =
  | "not_found"
  | "access_denied"
  | "not_published"
  | "tag_blocked"
  | "tag_required";

export default function CMSFriendsPublicView() {
  const params = useParams();
  const [search] = useSearchParams();

  const shareCode = params.shareCode;
  const pageId = params.pageId;
  const uid = search.get("uid") || undefined;

  const [data, setData] = useState<PagePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<KnownErrors | null>(null);
  const [passcode, setPasscode] = useState("");
  const [requirePass, setRequirePass] = useState(false);
  const [friendInfo, setFriendInfo] = useState<FriendInfo | null>(null);

  const isPreview = window.location.pathname.includes("/preview/") && !!pageId;

  // ====== 公開側で折返し＆アラインを効かせるCSS ======
  // ※ CSPでインラインstyleが禁止の場合は、この内容をグローバルCSSに移してください
  const AlignAndWrapCSS = (
    <style>{`
      .ql-content { 
        white-space: pre-wrap;
        overflow-wrap: break-word;
        word-break: break-word;
      }
      .ql-content img, .ql-content video, .ql-content iframe {
        max-width: 100%;
        height: auto;
      }
      .ql-align-center { text-align: center; }
      .ql-align-right  { text-align: right; }
      .ql-align-justify{ text-align: justify; }
    `}</style>
  );

  // ====== DOMPurify 設定（型安全） ======
  const sanitizeOptions: DOMPurifyConfig = {
    ALLOW_DATA_ATTR: true,
    ALLOWED_TAGS: [
      "p","div","span","a","img","br","strong","em","u","ol","ul","li","blockquote",
      "h1","h2","h3","h4","h5","h6","iframe","video","source"
    ],
    ALLOWED_ATTR: [
      "class","style","id",
      "href","target","rel","title",
      "src","alt","width","height","controls","allow","allowfullscreen","frameborder",
      "data-form-id","data-*"
    ],
    // 危険なタグ（script, style内の危険等）はデフォルトで除去されます
  };

  // aタグに rel を補強
  const secureLinks = (html: string) =>
    html.replace(/<a\s+([^>]*href=['"][^'"]+['"][^>]*)>/gi, (m, attrs) => {
      if (!/rel=/.test(attrs)) {
        return `<a ${attrs} rel="noopener noreferrer">`;
      }
      return m;
    });

  const sanitizeHtml = (raw: string) => {
    const clean = DOMPurify.sanitize(raw, sanitizeOptions);
    return secureLinks(clean);
  };

  useEffect(() => {
    document.title = data?.title ? `${data.title} | ページ` : "ページ";
    const meta = document.querySelector('meta[name="description"]');
    if (meta && data?.tag_label) meta.setAttribute("content", data.tag_label);
    const link = document.querySelector(
      'link[rel="canonical"]'
    ) as HTMLLinkElement | null;
    if (link) link.href = window.location.href;
  }, [data?.title, data?.tag_label]);

  const parseFnError = (fnErr: any) => {
    let status: number | undefined = fnErr?.context?.status ?? fnErr?.status;
    let code: string | undefined = fnErr?.context?.body?.error ?? fnErr?.code;
    let message: string | undefined = fnErr?.context?.body?.message || fnErr?.message;

    if (!status && typeof fnErr?.message === "string") {
      const m = fnErr.message.toLowerCase();
      if (m.includes("401") || m.includes("unauthorized")) status = 401;
      else if (m.includes("403") || m.includes("forbidden")) status = 403;
      else if (m.includes("423") || m.includes("locked")) status = 423;
      else if (m.includes("404") || m.includes("not found")) {
        status = 404;
        console.log("✅ Detected 404 from message");
      }
    }

    console.log("🔍 Final result:", { status: status ?? 0, code, message });
    return { status: status ?? 0, code, message };
  };

  const fetchData = async (withPasscode?: string) => {
    setLoading(true);
    setError(null);
    setFriendInfo(null);
    setRequirePass(false);

    try {
      // -------- Preview mode --------
      if (isPreview) {
        const { data: page, error: pageError } = await supabase
          .from("cms_pages")
          .select("*")
          .eq("id", pageId)
          .maybeSingle();

        if (pageError || !page) {
          setError("not_found");
          setLoading(false);
          return;
        }

        if (!page.is_published) {
          setError("not_published");
          setLoading(false);
          return;
        }

        if (page.require_passcode && page.passcode) {
          const urlParams = new URLSearchParams(window.location.search);
          const urlPasscode = urlParams.get("passcode");
          const provided = withPasscode || urlPasscode || "";
          if (!provided || provided !== page.passcode) {
            setRequirePass(true);
            setLoading(false);
            return;
          }
        }

        if (page.timer_enabled && page.expire_action === "hide_page") {
          const now = new Date();
          if (page.timer_mode === "absolute" && page.timer_deadline) {
            const isExpired = now > new Date(page.timer_deadline);
            if (isExpired) {
              setError("not_found");
              setLoading(false);
              return;
            }
          }
        }

        setData(page as PagePayload);
        setLoading(false);
        return;
      }

      // -------- Public mode (Edge Function) --------
      if (!shareCode) {
        setError("not_found");
        setLoading(false);
        return;
      }

      const { data: res, error: fnErr } = await supabase.functions.invoke(
        "cms-page-view",
        { body: { shareCode, uid, passcode: withPasscode } }
      );

      if (fnErr) {
        const { status, code } = parseFnError(fnErr);
        if (status === 401) { setRequirePass(true); setLoading(false); return; }
        if (status === 423) { setError("not_published"); setLoading(false); return; }
        if (status === 403) {
          if (code === "tag_blocked") setError("tag_blocked");
          else if (code === "tag_required") setError("tag_required");
          else setError("access_denied");
          setLoading(false);
          return;
        }
        if (status === 404) { setError("not_found"); setLoading(false); return; }
        setError("not_found"); setLoading(false); return;
      }

      if (!res) { setError("not_found"); setLoading(false); return; }
      if ((res as any).error) {
        const code = (res as any).error as KnownErrors | string;
        if (code === "passcode_required") { setRequirePass(true); setLoading(false); return; }
        if (
          code === "not_published" || code === "tag_blocked" ||
          code === "tag_required" || code === "access_denied" || code === "not_found"
        ) { setError(code as KnownErrors); setLoading(false); return; }
        setError("not_found"); setLoading(false); return;
      }

      if ((res as any).timer_enabled && (res as any).expire_action === "hide_page") {
        const now = new Date();
        if ((res as any).timer_mode === "absolute" && (res as any).timer_deadline) {
          const isExpired = now > new Date((res as any).timer_deadline);
          if (isExpired) {
            setError("not_found");
            setLoading(false);
            return;
          }
        }
      }

      setData(res as PagePayload);
      setLoading(false);
    } catch {
      setError("not_found");
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareCode, pageId, uid]);

  // -------- Loading --------
  if (loading) return <div className="container mx-auto p-6">読み込み中…</div>;

  // -------- Error screens --------
  if (error === "not_published") {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="w-full max-w-md p-6 rounded-lg" style={{ backgroundColor: "#999999" }}>
            <div className="text-center space-y-4">
              <h3 className="text-2xl font-semibold text-white">非公開ページ</h3>
              <p className="text-white">このページは現在非公開に設定されています</p>
            </div>
          </div>
        </div>
        <div className="py-2 text-center" style={{ backgroundColor: "rgb(12, 179, 134)" }}>
          <div className="flex flex-col items-center justify-center">
            <span className="font-bold text-lg text-white">L！JUMP</span>
            <span className="text-xs text-white opacity-90">LINE公式アカウント拡張ツール</span>
          </div>
        </div>
      </div>
    );
  }

  if (error === "access_denied") {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="w-full max-w-md p-6 rounded-lg" style={{ backgroundColor: "#999999" }}>
            <div className="text-center space-y-4">
              <h3 className="text-2xl font-semibold text白">LINE友だち限定WEBページ</h3>
              <p className="text-white">
                このページはLINE友だち限定です。<br />正しいリンクから開いてください。
              </p>
            </div>
          </div>
        </div>
        <div className="py-2 text-center" style={{ backgroundColor: "rgb(12, 179, 134)" }}>
          <div className="flex flex-col items-center justify-center">
            <span className="font-bold text-lg text-white">L！JUMP</span>
            <span className="text-xs text-white opacity-90">LINE公式アカウント拡張ツール</span>
          </div>
        </div>
      </div>
    );
  }

  if (error === "tag_blocked") {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="w-full max-w-md p-6 rounded-lg" style={{ backgroundColor: "#999999" }}>
            <div className="text-center space-y-4">
              <h3 className="text-2xl font-semibold text-white">アクセス制限</h3>
              <p className="text-white">申し訳ございませんが、このページを閲覧する権限がありません。</p>
            </div>
          </div>
        </div>
        <div className="py-2 text-center" style={{ backgroundColor: "rgb(12, 179, 134)" }}>
          <div className="flex flex-col items-center justify-center">
            <span className="font-bold text-lg text-white">L！JUMP</span>
            <span className="text-xs text-white opacity-90">LINE公式アカウント拡張ツール</span>
          </div>
        </div>
      </div>
    );
  }

  if (error === "tag_required") {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="w-full max-w-md p-6 rounded-lg" style={{ backgroundColor: "#999999" }}>
            <div className="text-center space-y-4">
              <h3 className="text-2xl font-semibold text-white">アクセス権限が必要です</h3>
              <p className="text-white">このページを閲覧するには特定の条件を満たしている必要があります。</p>
            </div>
          </div>
        </div>
        <div className="py-2 text-center" style={{ backgroundColor: "rgb(12, 179, 134)" }}>
          <div className="flex flex-col items-center justify-center">
            <span className="font-bold text-lg text-white">L！JUMP</span>
            <span className="text-xs text-white opacity-90">LINE公式アカウント拡張ツール</span>
          </div>
        </div>
      </div>
    );
  }

  if (error === "not_found") {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="w-full max-w-md p-6 rounded-lg" style={{ backgroundColor: "#999999" }}>
            <div className="text-center space-y-4">
              <h3 className="text-2xl font-semibold text-white">ページが見つかりません</h3>
              <p className="text-white">お探しのページは存在しないか、削除された可能性があります。</p>
            </div>
          </div>
        </div>
        <div className="py-2 text-center" style={{ backgroundColor: "rgb(12, 179, 134)" }}>
          <div className="flex flex-col items-center justify-center">
            <span className="font-bold text-lg text-white">L！JUMP</span>
            <span className="text-xs text-white opacity-90">LINE公式アカウント拡張ツール</span>
          </div>
        </div>
      </div>
    );
  }

  // -------- Passcode UI --------
  if (requirePass) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="text-center text-lg font-medium">
                このページはパスコードで保護されています。
              </div>
              <Input
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="パスコードを入力してください"
                onKeyDown={(e) => e.key === "Enter" && fetchData(passcode)}
                className="text-center"
              />
              <div className="flex justify-center">
                <Button onClick={() => fetchData(passcode)} className="min-w-[100px]">
                  送信
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // -------- Friend info (未使用想定) --------
  if (friendInfo) {
    return (
      <div className="container mx-auto max-w-3xl p-4 space-y-4">
        <Card>
          <CardContent className="p-6 space-y-4">
            <h1 className="text-xl font-semibold">アクセス権限がありません</h1>
            <p className="text-sm text-muted-foreground">
              {friendInfo.message || "このページを閲覧する権限がありません。詳細については管理者にお問い合わせください。"}
            </p>
            {(friendInfo.account_name || friendInfo.line_id || friendInfo.add_friend_url) && (
              <div className="mt-4 p-4 bg-muted rounded-lg">
                <p className="text-sm font-medium mb-2">お問い合わせ先：</p>
                <div className="space-y-1">
                  {friendInfo.account_name && <p className="text-sm">管理者: {friendInfo.account_name}</p>}
                  {friendInfo.line_id && <p className="text-sm">LINE ID: {friendInfo.line_id}</p>}
                </div>
                {friendInfo.add_friend_url && (
                  <Button className="mt-3" onClick={() => window.open(friendInfo.add_friend_url!, "_blank")}>
                    お問い合わせ
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="min-h-screen bg-gray-100 flex justify-center">
      {/* 中央の白い部分 */}
      <div className="w-full max-w-3xl bg-white border-x border-gray-200 flex flex-col">
        {AlignAndWrapCSS}

        {/* タイマー */}
        {data.timer_enabled && (
          <TimerPreview
            mode={data.timer_mode || "absolute"}
            deadline={data.timer_mode === "absolute" ? data.timer_deadline || undefined : undefined}
            durationSeconds={
              data.timer_mode === "per_access" || data.timer_mode === "step_delivery"
                ? data.timer_duration_seconds || undefined
                : undefined
            }
            showMilliseconds={!!data.show_milliseconds}
            styleVariant={data.timer_style || "solid"}
            bgColor={data.timer_bg_color || "#0cb386"}
            textColor={data.timer_text_color || "#ffffff"}
            shareCode={shareCode}
            uid={uid}
            dayLabel={data.timer_day_label || "日"}
            hourLabel={data.timer_hour_label || "時間"}
            minuteLabel={data.timer_minute_label || "分"}
            secondLabel={data.timer_second_label || "秒"}
            internalTimer={!!data.internal_timer}
            timerText={data.timer_text || "期間限定公開"}
            showEndDate={data.show_end_date ?? true}
            showRemainingText={data.show_remaining_text ?? true}
            scenarioId={data.timer_scenario_id || undefined}
            stepId={data.timer_step_id || undefined}
          />
        )}

        {/* コンテンツ本文 */}
        <article className="prose max-w-none dark:prose-invert flex-1 p-4 ql-content">
          {Array.isArray(data.content_blocks) && data.content_blocks.length > 0 ? (
            data.content_blocks.map((block, idx) => {
              const raw = block || "";

              // --- 生HTMLでFormEmbed検出（サニタイズ前） ---
              if (raw.includes("<FormEmbed") && raw.includes("formId=")) {
                const formIdMatch = raw.match(/formId="([^"]+)"/);
                const uidMatch = raw.match(/uid="([^"]+)"/);
                if (formIdMatch) {
                  const formId = formIdMatch[1];
                  const embedUid = uidMatch && uidMatch[1] === "[UID]" ? uid : uidMatch ? uidMatch[1] : "";
                  return (
                    <div key={idx} className="mt-4 first:mt-0">
                      <FormEmbedComponent formId={formId} uid={embedUid} className="my-6" />
                    </div>
                  );
                }
              }
              if (raw.includes('class="form-embed-container"') && raw.includes("data-form-id=")) {
                const formIdMatch = raw.match(/data-form-id="([^"]+)"/);
                if (formIdMatch) {
                  const formId = formIdMatch[1];
                  return (
                    <div key={idx} className="mt-4 first:mt-0">
                      <FormEmbedComponent formId={formId} uid={uid} className="my-6" />
                    </div>
                  );
                }
              }
              if (raw.includes('class="form-embed"') && raw.includes("data-form-id=")) {
                const formIdMatch = raw.match(/data-form-id="([^"]+)"/);
                if (formIdMatch) {
                  const formId = formIdMatch[1];
                  return (
                    <div key={idx} className="mt-4 first:mt-0">
                      <FormEmbedComponent formId={formId} uid={uid} className="my-6" />
                    </div>
                  );
                }
              }

              // --- フォーム以外はサニタイズして表示 ---
              const html = sanitizeHtml(raw);
              return (
                <div
                  key={idx}
                  className="mt-4 first:mt-0"
                  dangerouslySetInnerHTML={{ __html: html }}
                />
              );
            })
          ) : (
            <div
              className="mt-4 first:mt-0"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(data.content || "") }}
            />
          )}
        </article>
      </div>
    </div>
  );
}
