import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DOMPurify from "dompurify";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TimerPreview } from "@/components/TimerPreview";

interface PagePayload {
  title: string;
  tag_label?: string | null;
  content?: string | null;
  timer_enabled?: boolean;
  timer_mode?: "absolute" | "per_access";
  timer_deadline?: string | null;
  timer_duration_seconds?: number | null;
  show_milliseconds?: boolean;
  timer_style?: "solid" | "glass" | "outline";
  timer_bg_color?: string;
  timer_text_color?: string;
  internal_timer?: boolean;
  timer_text?: string | null;
}

export default function CMSFriendsPublicView() {
  const params = useParams();
  const [search] = useSearchParams();
  const shareCode = params.shareCode;
  const pageId = params.pageId;
  const uid = search.get("uid") || undefined;

  const [data, setData] = useState<PagePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [passcode, setPasscode] = useState("");
  const [requirePass, setRequirePass] = useState(false);

  const isPreview = !!pageId; // preview route for owners

  useEffect(() => {
    document.title = data?.title ? `${data.title} | ページ` : "ページ";
    const meta = document.querySelector('meta[name="description"]');
    if (meta && data?.tag_label) meta.setAttribute("content", data.tag_label);
  }, [data?.title, data?.tag_label]);

  const fetchData = async (withPasscode?: string) => {
    try {
      setLoading(true);
      setError(null);

      if (isPreview) {
        // Authenticated owner preview (no UID required)
        const { data: page, error } = await (supabase as any)
          .from("cms_pages")
          .select(
            "title, tag_label, content, timer_enabled, timer_mode, timer_deadline, timer_duration_seconds, show_milliseconds, timer_style, timer_bg_color, timer_text_color, internal_timer, timer_text"
          )
          .eq("id", pageId)
          .maybeSingle();
        if (error) throw error;
        if (!page) throw new Error("ページが見つかりません");
        setData(page as PagePayload);
        setRequirePass(false);
        return;
      }

      if (!shareCode) {
        setError("共有コードがありません");
        return;
      }
      if (!uid) {
        setError("このページを見るにはUIDが必要です（LINEからのリンクを開いてください）");
        return;
      }

      const { data: res, error: fnErr } = await supabase.functions.invoke("cms-page-view", {
        body: { shareCode, uid, passcode: withPasscode || undefined },
      });
      if (fnErr) throw fnErr;
      if (res?.require_passcode) {
        setRequirePass(true);
        return;
      }
      setRequirePass(false);
      setData(res as PagePayload);
    } catch (e: any) {
      setError(e?.message || "読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareCode, uid, pageId]);

  if (loading) return <div className="container mx-auto p-6">読み込み中…</div>;
  if (error) return <div className="container mx-auto p-6 text-destructive">{error}</div>;
  if (!data) return null;

  const sanitized = DOMPurify.sanitize(data.content || "");

  return (
    <div className="container mx-auto max-w-3xl p-4 space-y-4">
      {data.timer_enabled && (
        <TimerPreview
          mode={data.timer_mode || "absolute"}
          deadline={data.timer_deadline || undefined}
          durationSeconds={data.timer_duration_seconds || undefined}
          showMilliseconds={!!data.show_milliseconds}
          styleVariant={data.timer_style || "solid"}
          bgColor={data.timer_bg_color || "#0cb386"}
          textColor={data.timer_text_color || "#ffffff"}
          shareCode={shareCode}
          uid={uid}
        />
      )}

      {requirePass ? (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div>このページはパスコードで保護されています。</div>
            <Input value={passcode} onChange={(e) => setPasscode(e.target.value)} placeholder="パスコード" />
            <Button onClick={() => fetchData(passcode)}>送信</Button>
          </CardContent>
        </Card>
      ) : (
        <article className="prose max-w-none dark:prose-invert">
          <h1>{data.title}</h1>
          <div dangerouslySetInnerHTML={{ __html: sanitized }} />
        </article>
      )}
    </div>
  );
}
