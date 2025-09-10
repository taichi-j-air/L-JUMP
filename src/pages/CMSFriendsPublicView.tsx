import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DOMPurify from "dompurify";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

// 【追加】friendInfoの型定義を拡張
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

  // 正確なプレビューモード判定：URLパスに基づく
  const isPreview = window.location.pathname.includes('/preview/') && !!pageId;

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
      setFriendInfo(null);
      setRequirePass(false);

      console.log("🔍 Page access attempt:", { 
        isPreview, 
        shareCode, 
        uid, 
        pathname: window.location.pathname,
        hasPageId: !!pageId
      });

      // プレビューモードでも基本的な認証が必要
      if (isPreview) {
        console.log("📋 Preview mode - loading page directly with basic checks");
        
        const { data: page, error: pageError } = await supabase
          .from("cms_pages")
          .select("*")
          .eq("id", pageId)
          .maybeSingle();

        if (pageError || !page) {
          throw new Error("プレビュー対象のページが見つかりません。");
        }

        // Check if page is published
        if (!page.is_published) {
          setError("not_published");
          setLoading(false);
          return;
        }

        // プレビューでもパスコードチェック
        if (page.require_passcode && page.passcode) {
          const urlParams = new URLSearchParams(window.location.search);
          const urlPasscode = urlParams.get('passcode');
          if (!urlPasscode && !withPasscode) {
            setRequirePass(true);
            setLoading(false);
            return;
          }
          if ((urlPasscode || withPasscode) !== page.passcode) {
            throw new Error("パスコードが正しくありません");
          }
        }

        // プレビューでも期限切れチェック
        if (page.timer_enabled && page.expire_action === 'hide_page') {
          const now = new Date();
          let isExpired = false;

          if (page.timer_mode === 'absolute' && page.timer_deadline) {
            isExpired = now > new Date(page.timer_deadline);
          }

          if (isExpired) {
            console.log("⏰ Preview page expired:", { 
              timer_deadline: page.timer_deadline,
              current_time: now 
            });
            throw new Error("このページの表示期限が過ぎています。");
          }
        }

        setData(page as PagePayload);
        return;
      }

      // 通常の公開ページ表示 - Edge Functionを必ず使用
      if (!shareCode) {
        setError("共有コードがありません");
        return;
      }

      console.log("🌐 Public page - using Edge Function for strict authentication");

      const { data: res, error: fnErr } = await supabase.functions.invoke("cms-page-view", {
  body: { shareCode, uid, passcode: withPasscode },
});

console.log("📡 Edge Function response:", { res, fnErr });

// ネットワークレベルのエラー
if (fnErr) {
  throw new Error(fnErr.message || "エッジ関数でエラーが発生しました");
}

if (!res) {
  throw new Error("レスポンスがありません");
}

// Edge Functionがエラーを返した場合の処理
if (res.error) {
  console.log("🚫 Edge Function returned error:", res.error);
  setError(res.error);   // 👈 throw ではなく state に渡す
  return;
}

      
      // 非公開ページチェック
      if (res.not_published) {
        console.log("📝 Page is not published");
        setError("not_published");
        return;
      }

      if (res.access_denied) {
        console.log("🚫 Access denied:", res.reason);
        setError("access_denied");
        return;
      }
      
      if (res.require_passcode) {
        console.log("🔑 Passcode required");
        return setRequirePass(true);
      }
      if (res.require_friend) {
        console.log("👥 Friend authentication required:", res.friend_info);
        return setFriendInfo(res.friend_info || null);
      }

      // フロントエンドでの追加期限チェック
      if (res.timer_enabled && res.expire_action === 'hide_page') {
        const now = new Date();
        let isExpired = false;

        if (res.timer_mode === 'absolute' && res.timer_deadline) {
          isExpired = now > new Date(res.timer_deadline);
          console.log("🔍 Frontend expiration check (absolute):", { 
            deadline: res.timer_deadline, 
            now: now.toISOString(), 
            isExpired 
          });
        }

        if (isExpired) {
          console.log("🚫 Frontend detected expired page");
          throw new Error("このページの表示期限が過ぎています。");
        }
      }

      console.log("✅ Page loaded successfully:", res.title || res.tag_label);
      setData(res as PagePayload);

    } catch (e: any) {
      setError(e?.message || "読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [shareCode, pageId, uid]); // 依存配列を修正

  if (loading) return <div className="container mx-auto p-6">読み込み中…</div>;
  
  // 非公開ページ専用表示
  if (error === "not_published") {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="w-full max-w-md p-6 rounded-lg" style={{ backgroundColor: '#999999' }}>
            <div className="text-center space-y-4">
              <h3 className="text-2xl font-semibold leading-none tracking-tight text-white">非公開ページ</h3>
              <p className="text-white">
                このページは現在非公開に設定されています
              </p>
            </div>
          </div>
        </div>
        
        {/* LJUMP Banner */}
        <div className="p-4 text-center" style={{ backgroundColor: 'rgb(12, 179, 134)' }}>
          <div className="flex items-center justify-center space-x-2">
            <span className="font-bold text-lg text-white">L!JUMP-LINE公式アカウント拡張ツール</span>
          </div>
        </div>
      </div>
    );
  }

  if (error === "access_denied") {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="w-full max-w-md p-6 rounded-lg" style={{ backgroundColor: '#999999' }}>
            <div className="text-center space-y-4">
              <h3 className="text-2xl font-semibold leading-none tracking-tight text-white">LINE友だち限定WEBページ</h3>
              <p className="text-white">
                このページはLINE友だち限定です。<br />
                正しいリンクから開いてください。
              </p>
            </div>
          </div>
        </div>
        
        {/* LJUMP Banner */}
        <div className="p-4 text-center" style={{ backgroundColor: 'rgb(12, 179, 134)' }}>
          <div className="flex items-center justify-center space-x-2">
            <span className="font-bold text-lg text-white">L!JUMP-LINE公式アカウント拡張ツール</span>
          </div>
        </div>
      </div>
    );
  }
  
  if (error) return <div className="container mx-auto p-6 text-destructive">{error}</div>;

  // 【修正】パスコード入力画面の表示ロジックを優先
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

  // 【修正】権限なし画面の表示ロジックと宣伝バナー
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
          durationSeconds={(data.timer_mode === 'per_access' || data.timer_mode === 'step_delivery') ? data.timer_duration_seconds || undefined : undefined}
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
          showEndDate={data.timer_mode === 'per_access' || data.timer_mode === 'step_delivery'}
          scenarioId={data.timer_scenario_id || undefined}
          stepId={data.timer_step_id || undefined}
        />
      )}

      {/* requirePassは上部で処理済みのため削除 */}
      <article className="prose max-w-none dark:prose-invert">
        {Array.isArray(data.content_blocks) && data.content_blocks.length > 0 ? (
          data.content_blocks.map((block, idx) => {
            const html = DOMPurify.sanitize(block || "");
            
            // FormEmbed component detection and rendering
            if (html.includes('<FormEmbed') && html.includes('formId=')) {
              const formIdMatch = html.match(/formId="([^"]+)"/);
              const uidMatch = html.match(/uid="([^"]+)"/);
              
              if (formIdMatch) {
                const formId = formIdMatch[1];
                const embedUid = uidMatch && uidMatch[1] === '[UID]' ? uid : (uidMatch ? uidMatch[1] : '');
                
                return (
                  <div key={idx} className="mt-4 first:mt-0">
                    <FormEmbedComponent 
                      formId={formId} 
                      uid={embedUid}
                      className="my-6"
                    />
                  </div>
                );
              }
            }
            
            // フォーム埋め込み（新しい形式）の処理
            if (html.includes('class="form-embed-container"') && html.includes('data-form-id=')) {
              const formIdMatch = html.match(/data-form-id="([^"]+)"/);
              if (formIdMatch) {
                const formId = formIdMatch[1];
                return (
                  <div key={idx} className="mt-4 first:mt-0">
                    <FormEmbedComponent 
                      formId={formId} 
                      uid={uid}
                      className="my-6"
                    />
                  </div>
                );
              }
            }
            
            // 従来のフォーム埋め込み形式も維持
            if (html.includes('class="form-embed"') && html.includes('data-form-id=')) {
              const formIdMatch = html.match(/data-form-id="([^"]+)"/);
              if (formIdMatch) {
                const formId = formIdMatch[1];
                return (
                  <div key={idx} className="mt-4 first:mt-0">
                    <FormEmbedComponent 
                      formId={formId} 
                      uid={uid}
                      className="my-6"
                    />
                  </div>
                );
              }
            }
            
            return <div key={idx} className="mt-4 first:mt-0" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }} />;
          })
        ) : (
          <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(data.content || '') }} />
        )}
      </article>
    </div>
  );
}
