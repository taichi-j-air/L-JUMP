import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DOMPurify from "dompurify";
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

  const isPreview = window.location.pathname.includes("/preview/") && !!pageId;

  const fetchData = async (withPasscode?: string) => {
    try {
      setLoading(true);
      setError(null);
      setRequirePass(false);

      if (!shareCode && !isPreview) {
        setError("not_found");
        return;
      }

      const { data: res, error: fnErr } = await supabase.functions.invoke("cms-page-view", {
        body: { shareCode, uid, pageId, passcode: withPasscode, isPreview },
      });

      if (fnErr) {
        console.error("Edge Function error:", fnErr);
        setError("not_found");
        return;
      }

      if (!res) {
        
        return;
      }

      if ((res as any).error) {
        const code = (res as any).error;
        if (code === "passcode_required") {
          setRequirePass(true);
          return;
        }
        if (["access_denied", "not_published", "not_found"].includes(code)) {
          setError(code);
          return;
        }
      }

      setData(res as PagePayload);
    } catch (e: any) {
      console.error(e);
      setError("not_found");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [shareCode, pageId, uid]);

  /* ------------------- UI レンダリング ------------------- */

  if (loading) return <div className="container mx-auto p-6">読み込み中…</div>;

  // 🎯 requirePass を最優先
  if (requirePass) {
    return (
      <div className="container mx-auto max-w-3xl p-4">
        <Card>
          <CardContent className="p-4 space-y-3">
            <div>このページはパスコードで保護されています。</div>
            <Input
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="パスコード"
              onKeyDown={(e) => e.key === "Enter" && fetchData(passcode)}
            />
            <Button onClick={() => fetchData(passcode)}>送信</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error === "not_published") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>このページは現在非公開です。</p>
      </div>
    );
  }

  if (error === "access_denied") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>このページはLINE友だち限定です。正しいリンクからアクセスしてください。</p>
      </div>
    );
  }

  if (error === "not_found") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>ページが見つかりません。</p>
      </div>
    );
  }

  if (!data) return null;

  const sanitized = DOMPurify.sanitize(data.content || "");

  return (
    <div className="container mx-auto max-w-3xl p-4 space-y-4">
      {isPreview && (
        <div className="fixed top-4 right-4 z-50">
          <Button variant="outline" size="sm" onClick={() => window.close()} className="flex items-center gap-2">
            <X className="h-4 w-4" />
            プレビュー画面を閉じる
          </Button>
        </div>
      )}

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
          showEndDate={data.timer_mode === "per_access" || data.timer_mode === "step_delivery"}
          scenarioId={data.timer_scenario_id || undefined}
          stepId={data.timer_step_id || undefined}
        />
      )}

      <article className="prose max-w-none dark:prose-invert">
        {Array.isArray(data.content_blocks) && data.content_blocks.length > 0 ? (
          data.content_blocks.map((block, idx) => {
            const html = DOMPurify.sanitize(block || "");
            return <div key={idx} className="mt-4 first:mt-0" dangerouslySetInnerHTML={{ __html: html }} />;
          })
        ) : (
          <div dangerouslySetInnerHTML={{ __html: sanitized }} />
        )}
      </article>
    </div>
  );
}
