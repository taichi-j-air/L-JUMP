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
  content_blocks?: string[];
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
  timer_day_label?: string | null;
  timer_hour_label?: string | null;
  timer_minute_label?: string | null;
  timer_second_label?: string | null;
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
const [friendInfo, setFriendInfo] = useState<{ account_name: string | null; line_id: string | null; add_friend_url: string | null } | null>(null);

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
            "title, tag_label, content, content_blocks, timer_enabled, timer_mode, timer_deadline, timer_duration_seconds, show_milliseconds, timer_style, timer_bg_color, timer_text_color, internal_timer, timer_text, timer_day_label, timer_hour_label, timer_minute_label, timer_second_label"
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
// UID がなくてもフレンド情報案内を返すためそのまま続行します

      const { data: res, error: fnErr } = await supabase.functions.invoke("cms-page-view", {
        body: { shareCode, uid, passcode: withPasscode || undefined },
      });
      if (fnErr) throw fnErr;
      if (res?.require_passcode) {
        setRequirePass(true);
        setFriendInfo(null);
        return;
      }
      if (res?.require_friend) {
        setFriendInfo(res.friend_info || null);
        setData(null);
        setRequirePass(false);
        return;
      }
      setFriendInfo(null);
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

if (!data && friendInfo) {
  return (
    <div className="container mx-auto max-w-3xl p-4 space-y-4">
      <Card>
        <CardContent className="p-6 space-y-3">
          <h1 className="text-xl font-semibold">このページは友だち限定です</h1>
          <p className="text-sm text-muted-foreground">下記の公式アカウントを友だち追加してください。</p>
          <div className="text-sm space-y-1">
            {friendInfo.account_name && <div>公式アカウント名：{friendInfo.account_name}</div>}
            {friendInfo.line_id && <div>LINE ID：{friendInfo.line_id}</div>}
          </div>
          {friendInfo.add_friend_url && (
            <Button onClick={() => window.open(friendInfo.add_friend_url!, '_blank')}>友だち追加する</Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

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
