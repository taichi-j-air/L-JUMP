import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DOMPurify from "dompurify";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TimerPreview } from "@/components/TimerPreview";
import { ArrowLeft, X } from "lucide-react";

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
  const navigate = useNavigate();
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
    const link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (link) link.href = window.location.href;
  }, [data?.title, data?.tag_label]);

  const fetchData = async (withPasscode?: string) => {
    try {
      setLoading(true);
      setError(null);

      // プレビューモードでも認証を適用する場合は、shareCodeから取得
      if (isPreview && pageId) {
        const { data: page, error } = await (supabase as any)
          .from("cms_pages")
          .select("share_code")
          .eq("id", pageId)
          .maybeSingle();
        if (error) throw error;
        if (!page?.share_code) throw new Error("ページが見つかりません");
        
        // プレビューモードでもエッジ関数を使用して認証を適用
        const { data: res, error: fnErr } = await supabase.functions.invoke("cms-page-view", {
          body: { 
            shareCode: page.share_code, 
            uid: uid, 
            passcode: withPasscode || undefined 
          },
        });
        if (fnErr) throw fnErr;
        if (res?.require_passcode) {
          setRequirePass(true);
          setFriendInfo(null);
          setData(null);
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
        return;
      }

      if (!shareCode) {
        setError("共有コードがありません");
        return;
      }

      const { data: res, error: fnErr } = await supabase.functions.invoke("cms-page-view", {
        body: { shareCode, uid, passcode: withPasscode || undefined },
      });
      if (fnErr) throw fnErr;
      if (res?.require_passcode) {
        setRequirePass(true);
        setFriendInfo(null);
        setData(null);
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
      {isPreview && (
        <div className="fixed top-4 right-4 z-50">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.close()}
            className="flex items-center gap-2"
          >
            <X className="h-4 w-4" />
            プレビュー画面を閉じる
          </Button>
        </div>
      )}
      
      {data.timer_enabled && (
        <TimerPreview
          mode={data.timer_mode || "absolute"}
          deadline={data.timer_mode === 'absolute' ? data.timer_deadline || undefined : undefined}
          durationSeconds={data.timer_mode === 'per_access' ? data.timer_duration_seconds || undefined : undefined}
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
          showEndDate={data.timer_mode === 'per_access'}
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
          {Array.isArray(data.content_blocks) && data.content_blocks.length > 0 ? (
            data.content_blocks.map((block, idx) => {
              const html = DOMPurify.sanitize(block || "");
              // フォーム埋め込みの処理
              if (html.includes('class="form-embed"') && html.includes('data-form-id=')) {
                const formIdMatch = html.match(/data-form-id="([^"]+)"/);
                if (formIdMatch) {
                  const formId = formIdMatch[1];
                  return (
                    <div key={idx} className="mt-4 first:mt-0">
                      <iframe 
                        src={`${window.location.origin}/form/${formId}${uid ? `?uid=${uid}` : ''}`}
                        className="w-full min-h-[400px] border rounded"
                        title="埋め込みフォーム"
                        style={{ background: 'white' }}
                      />
                    </div>
                  );
                }
              }
              return <div key={idx} className="mt-4 first:mt-0" dangerouslySetInnerHTML={{ __html: html }} />;
            })
          ) : (
            <div dangerouslySetInnerHTML={{ __html: sanitized }} />
          )}
        </article>
      )}
    </div>
  );
}
