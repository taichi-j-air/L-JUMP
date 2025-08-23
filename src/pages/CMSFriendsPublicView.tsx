import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DOMPurify from "dompurify";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TimerPreview } from "@/components/TimerPreview";
import { X } from "lucide-react";

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
  expire_action?: 'hide' | 'keep_public'; // 追加
}

interface FriendInfo {
  account_name: string | null;
  line_id: string | null;
  add_friend_url: string | null;
  message?: string;
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
  const [friendInfo, setFriendInfo] = useState<FriendInfo | null>(null);
  const [isExpired, setIsExpired] = useState(false); // タイマー切れ状態

  const isPreview = !!pageId;

  const fetchData = async (withPasscode?: string) => {
    try {
      setLoading(true);
      setError(null);
      setFriendInfo(null);
      setRequirePass(false);
      setIsExpired(false);

      if (isPreview) {
        const { data: pageData, error: pageError } = await supabase
          .from("cms_pages")
          .select("*")
          .eq("id", pageId)
          .single();

        if (pageError || !pageData) {
          throw new Error("プレビュー対象のページが見つかりません。");
        }
        setData(pageData as PagePayload);
      } else {
        if (!shareCode) {
          throw new Error("共有コードが指定されていません。");
        }
        
        const { data: res, error: fnErr } = await supabase.functions.invoke("cms-page-view", {
          body: { shareCode, uid, passcode: withPasscode },
        });

        if (fnErr) throw new Error(fnErr.message || "ページの読み込みに失敗しました。");
        if (!res) throw new Error("サーバーから応答がありません。");
        
        if (res.error) {
          if (res.errorType === 'expired') {
            setIsExpired(true);
          } else {
            throw new Error(res.error);
          }
        } else if (res.require_passcode) {
          setRequirePass(true);
        } else if (res.require_friend) {
          setFriendInfo(res.friend_info || null);
        } else {
          setData(res as PagePayload);
        }
      }
    } catch (e: any) {
      setError(e?.message || "ページの読み込み中にエラーが発生しました。");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [pageId, shareCode, uid]);

  if (loading) return <div className="container mx-auto p-6">読み込み中…</div>;
  if (error) return <div className="container mx-auto p-6 text-destructive">{error}</div>;

  // 【修正】タイマー切れの表示を最優先
  if (isExpired) {
    return (
      <div className="container mx-auto p-6 text-center">
        <h1 className="text-2xl font-bold text-destructive">閲覧期間が終了しました</h1>
        <p className="text-muted-foreground">このページの閲覧期間は終了しました。</p>
      </div>
    );
  }

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
              onKeyDown={(e) => e.key === 'Enter' && fetchData(passcode)}
            />
            <Button onClick={() => fetchData(passcode)}>送信</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (friendInfo) {
    // ... 権限なし画面 + L!JUMPバナーのコード ...
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
                    {friendInfo.account_name && (
                        <p className="text-sm">管理者: {friendInfo.account_name}</p>
                    )}
                    {friendInfo.line_id && (
                        <p className="text-sm">LINE ID: {friendInfo.line_id}</p>
                    )}
                    </div>
                    {friendInfo.add_friend_url && (
                    <Button 
                        className="mt-3" 
                        onClick={() => window.open(friendInfo.add_friend_url!, '_blank')}
                    >
                        お問い合わせ
                    </Button>
                    )}
                </div>
                )}
            </CardContent>
            </Card>
            <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
            <CardContent className="p-6">
                <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-bold">L!JUMP</h3>
                    <p className="text-sm opacity-90">次世代LINEマーケティングツール</p>
                </div>
                <Button 
                    variant="secondary"
                    onClick={() => window.open('https://ljump.com', '_blank')}
                >
                    詳細を見る
                </Button>
                </div>
            </CardContent>
            </Card>
        </div>
    );
  }

  if (!data) return null;

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
          deadline={data.timer_mode === 'absolute' ? data.timer_deadline : undefined}
          durationSeconds={data.timer_mode === 'per_access' ? data.timer_duration_seconds : undefined}
          showMilliseconds={!!data.show_milliseconds}
          styleVariant={data.timer_style || "solid"}
          bgColor={data.timer_bg_color || "#0cb386"}
          textColor={data.timer_text_color || "#ffffff"}
          internalTimer={!!data.internal_timer}
          timerText={data.timer_text || "期間限定公開"}
          dayLabel={data.timer_day_label || "日"}
          hourLabel={data.timer_hour_label || "時間"}
          minuteLabel={data.timer_minute_label || "分"}
          secondLabel={data.timer_second_label || "秒"}
          preview={isPreview}
        />
      )}

      <article className="prose max-w-none dark:prose-invert">
        {Array.isArray(data.content_blocks) && data.content_blocks.length > 0 ? (
          data.content_blocks.map((block, idx) => {
            const html = DOMPurify.sanitize(block || "");
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
          <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(data.content || "") }} />
        )}
      </article>
    </div>
  );
}
