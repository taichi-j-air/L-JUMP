import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DOMPurify from "dompurify";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TimerPreview } from "@/components/TimerPreview";
import { Block } from "@/components/EnhancedBlockEditor";
import { renderBlock, HeadingDesignStyles } from "@/lib/blockRenderer";

interface PagePayload {
  title: string;
  tag_label?: string | null;
  content?: string | null;
  content_blocks?: Block[];
  timer_enabled?: boolean;
  timer_mode?: "absolute" | "per_access" | "step_delivery";
  timer_deadline?: string | null;
  timer_duration_seconds?: number | null;
  show_milliseconds?: boolean;
  timer_style?: "solid" | "glass" | "outline" | "minimal";
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
  expire_action?: "hide_page" | "hide" | "keep_public";
  show_remaining_text?: boolean;
  show_end_date?: boolean;
}



const isHideAction = (action?: string | null) => action === "hide" || action === "hide_page";

type KnownErrors =
  | "not_found"
  | "access_denied"
  | "timer_expired"
  | "not_published"
  | "tag_blocked"
  | "tag_required";

export default function ExternalWebPageView() {
  const params = useParams();
  const [searchParams] = useSearchParams();

  const shareCode = params.shareCode;
  const pageId = params.pageId;
  const uid = searchParams.get("uid") || undefined;

  const [data, setData] = useState<PagePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<KnownErrors | null>(null);
  const [passcode, setPasscode] = useState("");
  const [requirePass, setRequirePass] = useState(false);

  const isPreview = window.location.pathname.includes("/preview/") && !!pageId;

  const sanitizeHtml = (raw: string) => {
    const clean = DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } });
    return clean.replace(/<a\s+([^>]*href=[\'"][^\'"]+[\'"][^>]*>)/gi, (m, attrs) => {
      if (!/rel=/.test(attrs)) {
        return `<a ${attrs} rel="noopener noreferrer">`;
      }
      return m;
    });
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
      else if (m.includes("423") || m.includes("locked")) status = 423;
      else if (m.includes("404") || m.includes("not found")) {
        status = 404;
      }
    }
    return { status: status ?? 0, code, message };
  };

  const fetchData = async (withPasscode?: string) => {
    setLoading(true);
    setError(null);
    setRequirePass(false);

    try {
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

        setData({
          ...page,
          content_blocks: Array.isArray(page.content_blocks) 
            ? page.content_blocks 
            : (typeof page.content_blocks === 'string' 
                ? JSON.parse(page.content_blocks) 
                : []
              )
        } as PagePayload);
        setLoading(false);
        return;
      }

      if (!shareCode) {
        setError("not_found");
        setLoading(false);
        return;
      }

      console.log(`🔍 Calling cms-page-view with shareCode: ${shareCode}, uid: ${uid}`);
      
      const { data: res, error: fnErr } = await supabase.functions.invoke(
        "cms-page-view",
        { body: { shareCode, uid, passcode: withPasscode, pageType: 'public' } }
      );

      if (fnErr) {
        const { status } = parseFnError(fnErr);
        if (status === 401) { setRequirePass(true); setLoading(false); return; }
        if (status === 423) { setError("not_published"); setLoading(false); return; }
        if (status === 404) { setError("not_found"); setLoading(false); return; }
        if (status === 410) { setError("timer_expired"); setLoading(false); return; }
        setError("not_found"); setLoading(false); return;
      }

      if (!res) { setError("not_found"); setLoading(false); return; }
      if ((res as any).error) {
        const code = (res as any).error as KnownErrors | string;
        if (code === "passcode_required") { setRequirePass(true); setLoading(false); return; }
        if (
          code === "not_published" || code === "not_found" || code === "timer_expired"
        ) { setError(code as KnownErrors); setLoading(false); return; }
        setError("not_found"); setLoading(false); return;
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

  if (loading) return <div className="container mx-auto p-6">読み込み中…</div>;

  if (error === "not_published") {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="w-full max-w-md p-6 rounded-lg" style={{ backgroundColor: "#999999" }}>
            <div className="text-center space-y-4">
              <h3 className="text-2xl font-semibold text-white">非公開ページ</h3>
              <p className="text-white">このページは現在非公開に設定されています。</p>
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

  if (error === "timer_expired") {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="w-full max-w-md p-6 rounded-lg" style={{ backgroundColor: "#ff6b6b" }}>
            <div className="text-center space-y-4">
              <h3 className="text-2xl font-semibold text-white">閲覧期限切れ</h3>
              <p className="text-white">このページの閲覧期限が過ぎました。</p>
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

  if (requirePass) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="flex-1 flex items-center justify-center px-4">
          <Card className="w-full max-w-md">
            <CardContent className="p-6">
              <div className="text-center space-y-4">
                <h3 className="text-2xl font-semibold">パスコードを入力してください</h3>
                <div className="space-y-3">
                  <Input
                    type="password"
                    placeholder="パスコードを入力"
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                  />
                  <Button 
                    className="w-full" 
                    onClick={() => fetchData(passcode)}
                  >
                    送信
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
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

  if (!data) return null;

  const sortedBlocks = Array.isArray(data.content_blocks)
    ? [...data.content_blocks].sort((a, b) => a.order - b.order)
    : [];
  const backgroundBlock = sortedBlocks.find((block) => block.type === 'background');
  const filteredBlocks = sortedBlocks.filter((block) => block.type !== 'background');
  const resolveBackgroundColor = (value?: string | null) => {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const normalized = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
    return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(normalized) ? normalized : undefined;
  };
  const pageBackgroundColor = resolveBackgroundColor((backgroundBlock?.content as any)?.color);

  return (
    <div className="min-h-screen bg-gray-100 flex justify-center">
      {HeadingDesignStyles}
      <div className="w-full max-w-3xl bg-white border-x border-gray-200 flex flex-col" style={pageBackgroundColor ? { backgroundColor: pageBackgroundColor } : undefined}>
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
            onExpire={
              isHideAction(data.expire_action)
                ? () => {
                    setError("timer_expired");
                    setData(null);
                  }
                : undefined
            }
          />
        )}

        <article className="prose max-w-none dark:prose-invert flex-1 p-4 ql-content">
          {filteredBlocks.length > 0 ? (
            filteredBlocks.map((block) => (
              <div key={block.id} className="not-prose">{renderBlock(block)}</div>
            ))
          ) : (
            <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(data.content || "") }} />
          )}
        </article>
      </div>
    </div>
  );
}
