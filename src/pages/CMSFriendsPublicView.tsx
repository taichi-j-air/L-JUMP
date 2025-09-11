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
    setLoading(true);
    setError(null);
    setFriendInfo(null);
    setRequirePass(false);

    try {
      // プレビューモードでも基本的な認証が必要
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
            setRequirePass(true);
            setLoading(false);
            return;
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
            setError("not_found");
            setLoading(false);
            return;
          }
        }

        setData(page as PagePayload);
        setLoading(false);
        return;
      }

      // 通常の公開ページ表示 - Edge Functionを必ず使用
      if (!shareCode) {
        console.error("❌ Missing shareCode");
        setError("not_found");
        setLoading(false);
        return;
      }

      const { data: res, error: fnErr } = await supabase.functions.invoke("cms-page-view", {
        body: { shareCode, uid, passcode: withPasscode },
      });

        // エラーハンドリング - HTTPステータスコードに基づく適切な処理
        if (fnErr) {
          // Supabase Functions の新しいエラー形式に対応
          let status = 0;
          let errorBody: any = {};

          // FunctionsHttpError からステータスコードを取得
          if (fnErr instanceof Error) {
            const errorMessage = fnErr.message.toLowerCase();
            
            if (errorMessage.includes('401') || errorMessage.includes('unauthorized')) {
              status = 401;
            } else if (errorMessage.includes('403') || errorMessage.includes('forbidden')) {
              status = 403;
            } else if (errorMessage.includes('423') || errorMessage.includes('locked')) {
              status = 423;
            } else if (errorMessage.includes('404') || errorMessage.includes('not found')) {
              status = 404;
            }
            // non-2xxの場合はデフォルトを404にして、パスコード画面の誤表示を防ぐ
          }

          // 旧形式のサポート（互換性のため）
          if (!status) {
            status = (fnErr as any)?.context?.response?.status ?? (fnErr as any)?.status ?? 0;
            errorBody = (fnErr as any)?.context?.body ?? {};
          }

          // 401: パスコード必要
          if (status === 401) {
            setRequirePass(true);
            setLoading(false);
            return;
          }
          
          // 423: 非公開ページ
          if (status === 423) {
            setError("not_published");
            setLoading(false);
            return;
          }
          
          // 403: アクセス拒否（タグ制限含む）
          if (status === 403) {
            setError("access_denied");
            setLoading(false);
            return;
          }
          
          // 404: ページが見つからない
          if (status === 404) {
            setError("not_found");
            setLoading(false);
            return;
          }
          
          // その他のエラー
          setError("not_found");
          setLoading(false);
          return;
        }

      // 正常レスポンスの処理
      if (!res) {
        setError("not_found");
        setLoading(false);
        return;
      }

      // 200レスポンスでもエラーオブジェクトが含まれる場合の処理
      if ((res as any).error) {
        const code = (res as any).error;
        
        if (code === "passcode_required") {
          setRequirePass(true);
          setLoading(false);
          return;
        }
        if (code === "not_published") {
          setError("not_published");
          setLoading(false);
          return;
        }
        if (code === "tag_blocked") {
          setError("tag_blocked");
          setLoading(false);
          return;
        }
        if (code === "tag_required") {
          setError("tag_required");
          setLoading(false);
          return;
        }
        if (code === "access_denied") {
          setError("access_denied");
          setLoading(false);
          return;
        }
        if (code === "not_found") {
          setError("not_found");
          setLoading(false);
          return;
        }
      }

      // 期限切れチェック
      if (res.timer_enabled && res.expire_action === "hide_page") {
        const now = new Date();
        let isExpired = false;
        if (res.timer_mode === "absolute" && res.timer_deadline) {
          isExpired = now > new Date(res.timer_deadline);
        }
        if (isExpired) {
          setError("not_found");
          setLoading(false);
          return;
        }
      }

      // 成功時の処理
      setData(res as PagePayload);
      setLoading(false);

    } catch (e: any) {
      setError("not_found");
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
        <div className="py-2 text-center" style={{ backgroundColor: 'rgb(12, 179, 134)' }}>
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
        <div className="py-2 text-center" style={{ backgroundColor: 'rgb(12, 179, 134)' }}>
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
          <div className="w-full max-w-md p-6 rounded-lg" style={{ backgroundColor: '#999999' }}>
            <div className="text-center space-y-4">
              <h3 className="text-2xl font-semibold leading-none tracking-tight text-white">アクセス制限</h3>
              <p className="text-white">
                申し訳ございませんが、このページを閲覧する権限がありません。
              </p>
            </div>
          </div>
        </div>
        
        {/* LJUMP Banner */}
        <div className="py-2 text-center" style={{ backgroundColor: 'rgb(12, 179, 134)' }}>
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
          <div className="w-full max-w-md p-6 rounded-lg" style={{ backgroundColor: '#999999' }}>
            <div className="text-center space-y-4">
              <h3 className="text-2xl font-semibold leading-none tracking-tight text-white">アクセス権限が必要です</h3>
              <p className="text-white">
                このページを閲覧するには特定の条件を満たしている必要があります。
              </p>
            </div>
          </div>
        </div>
        
        {/* LJUMP Banner */}
        <div className="py-2 text-center" style={{ backgroundColor: 'rgb(12, 179, 134)' }}>
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
          <div className="w-full max-w-md p-6 rounded-lg" style={{ backgroundColor: '#999999' }}>
            <div className="text-center space-y-4">
              <h3 className="text-2xl font-semibold leading-none tracking-tight text-white">ページが見つかりません</h3>
              <p className="text-white">
                お探しのページは存在しないか、削除された可能性があります。
              </p>
            </div>
          </div>
        </div>
        
        {/* LJUMP Banner */}
        <div className="py-2 text-center" style={{ backgroundColor: 'rgb(12, 179, 134)' }}>
          <div className="flex flex-col items-center justify-center">
            <span className="font-bold text-lg text-white">L！JUMP</span>
            <span className="text-xs text-white opacity-90">LINE公式アカウント拡張ツール</span>
          </div>
        </div>
      </div>
    );
  }
  
  // その他のエラーは表示しない（上記で具体的なエラーを処理済み）
  if (error && !["access_denied", "not_found", "not_published", "tag_blocked", "tag_required"].includes(error)) {
    setError("not_found"); // デフォルトで404扱い
    return null;
  }

  // パスコード入力画面の表示ロジック
  if (requirePass) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="text-center text-lg font-medium">このページはパスコードで保護されています。</div>
              <Input 
                value={passcode} 
                onChange={(e) => setPasscode(e.target.value)} 
                placeholder="パスコードを入力してください"
                onKeyDown={(e) => e.key === 'Enter' && fetchData(passcode)}
                className="text-center"
              />
              <div className="flex justify-center">
                <Button onClick={() => fetchData(passcode)} className="min-w-[100px]">送信</Button>
              </div>
            </CardContent>
          </Card>
        </div>
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
