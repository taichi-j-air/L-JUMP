import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Copy, CheckCircle, AlertTriangle, Settings, Zap } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { toast } from "@/hooks/use-toast"
import { AppHeader } from "@/components/AppHeader"

export default function LineLoginSettings() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingLiff, setSavingLiff] = useState(false)
  
  const [settings, setSettings] = useState({
    channelId: '',
    channelSecret: '',
    callbackUrl: '',
    loginUrl: ''
  })
  
  const [liffSettings, setLiffSettings] = useState({
    liffId: '',
    liffUrl: '',
    liffEndpointUrl: ''
  })
  const [customNext, setCustomNext] = useState('')

  useEffect(() => {
    checkUser()
  }, [])

  const checkUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        window.location.href = '/auth'
        return
      }
      
      setUser(session.user)
      await loadSettings(session.user.id)
    } catch (error) {
      console.error('ユーザー確認エラー:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadSettings = async (userId: string) => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('line_login_channel_id, line_login_channel_secret, line_channel_id, line_channel_secret, liff_id, liff_url, line_bot_id')
        .eq('user_id', userId)
        .maybeSingle()

      if (profile) {
        const callbackUrl = `https://rtjxurmuaawyzjcdkqxt.supabase.co/functions/v1/login-callback`
        const channelId = profile.line_login_channel_id || profile.line_channel_id || ''
        const channelSecret = profile.line_login_channel_secret || profile.line_channel_secret || ''
        const loginUrl = generateLoginUrl(channelId, userId)
        const liffId = profile.liff_id || ''
        const liffUrl = profile.liff_url || ''
        const lineBotId = profile.line_bot_id || ''
        
        // LIFF認証専用ページのエンドポイントURL生成（LINE Bot IDを使用してセキュリティ向上）
        const liffEndpointUrl = liffId
        ? `${window.location.origin}/liff?userId=${userId}&liffId=${liffId}`
        : `${window.location.origin}/liff?userId=${userId}&liffId=[LIFF_ID]`
        
        setSettings({
          channelId,
          channelSecret,
          callbackUrl,
          loginUrl
        })
        
        setLiffSettings({
          liffId,
          liffUrl,
          liffEndpointUrl
        })
      }
    } catch (error) {
      console.error('設定読み込みエラー:', error)
    }
  }

  const encodeState = (payload: Record<string, unknown>) => {
    try {
      const json = JSON.stringify(payload)
      const encoded = btoa(json)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')
      return encoded
    } catch (error) {
      console.error('State encoding error:', error)
      return 'login'
    }
  }

  const generateLoginUrl = (channelId: string, userId?: string | null, next?: string | null) => {
    if (!channelId) return ''
    
    const baseUrl = 'https://access.line.me/oauth2/v2.1/authorize'
    let stateParam = 'login'

    if (typeof window !== 'undefined') {
      const sanitizedNext = typeof next === 'string' && next.trim().length > 0 ? next.trim() : undefined;
      stateParam = encodeState({
        mode: 'login',
        origin: window.location.origin,
        userId: userId ?? null,
        ts: Date.now(),
        next: sanitizedNext ?? undefined
      })
    }

    const params = {
      response_type: 'code',
      client_id: channelId,
      redirect_uri: 'https://rtjxurmuaawyzjcdkqxt.supabase.co/functions/v1/login-callback',
      state: stateParam,
      scope: 'openid profile',
      bot_prompt: 'aggressive'
    }
    
    const searchParams = new URLSearchParams(params)
    return `${baseUrl}?${searchParams.toString()}`
  }

  const handleSave = async () => {
    if (!user) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          line_login_channel_id: settings.channelId,
          line_login_channel_secret: settings.channelSecret,
          line_channel_id: settings.channelId, // 既存の互換性のため
          line_channel_secret: settings.channelSecret, // 既存の互換性のため
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id)

      if (error) throw error

      // ログインURLを更新
      const loginUrl = generateLoginUrl(settings.channelId, user?.id)
      setSettings(prev => ({ ...prev, loginUrl }))

      toast({
        title: "保存完了",
        description: "LINE Login設定を保存しました",
      })
    } catch (error) {
      console.error('保存エラー:', error)
      toast({
        title: "保存失敗",
        description: "設定の保存に失敗しました",
        variant: "destructive"
      })
    } finally {
      setSaving(false)
    }
  }

  const handleLiffSave = async () => {
    if (!user) return
    
    // バリデーション: LIFF URLにクエリパラメータが含まれていないかチェック
    if (liffSettings.liffUrl && liffSettings.liffUrl.includes('?')) {
      toast({
        title: "保存エラー",
        description: "LIFF URLにはクエリパラメータ（?以降）を含めないでください",
        variant: "destructive"
      });
      return;
    }
    
    // バリデーション: LIFF URLの形式チェック
    if (liffSettings.liffUrl && 
        !liffSettings.liffUrl.startsWith('https://liff.line.me/') &&
        !liffSettings.liffUrl.match(/^https:\/\/[^/]+\/liff$/)) {
      toast({
        title: "警告",
        description: "LIFF URLは https://liff.line.me/{LIFF_ID} または https://{ドメイン}/liff の形式が推奨されます",
        variant: "destructive"
      });
    }

    setSavingLiff(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          liff_id: liffSettings.liffId,
          liff_url: liffSettings.liffUrl,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id)

      if (error) throw error

      // LIFF設定保存後、エンドポイントURLを更新（LINE Bot IDを使用）
      await loadSettings(user.id) // 設定を再読み込みして最新のLINE Bot IDを取得

      toast({
        title: "LIFF設定保存完了",
        description: "LIFF設定を保存しました",
      })
    } catch (error) {
      console.error('LIFF保存エラー:', error)
      toast({
        title: "LIFF保存失敗",
        description: "LIFF設定の保存に失敗しました",
        variant: "destructive"
      })
    } finally {
      setSavingLiff(false)
    }
  }

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast({
        title: "コピー完了",
        description: `${label}をクリップボードにコピーしました`,
      })
    } catch (error) {
      toast({
        title: "コピー失敗",
        description: "クリップボードへのコピーに失敗しました",
        variant: "destructive"
      })
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">読み込み中...</div>
  }

  const isConfigured = settings.channelId && settings.channelSecret
  const isLiffConfigured = liffSettings.liffId && liffSettings.liffUrl
  const customLoginUrl = generateLoginUrl(settings.channelId, user?.id, customNext || null)

  return (
    <div className="min-h-screen bg-background">
      <AppHeader user={user} />
      
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <div className="flex items-center gap-3 mb-6">
          <Settings className="h-6 w-6" />
          <h1 className="text-2xl font-bold">LINE Login & LIFF設定</h1>
          <Badge variant={isConfigured ? "default" : "secondary"}>
            {isConfigured ? "Login設定済み" : "Login未設定"}
          </Badge>
          <Badge variant={isLiffConfigured ? "default" : "secondary"}>
            {isLiffConfigured ? "LIFF設定済み" : "LIFF未設定"}
          </Badge>
        </div>

        <div className="space-y-6">
          {/* 設定状況 */}
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              LINE LoginとLIFFを使用するには、LINE Developersコンソールでチャネル設定とLIFFアプリケーション設定が必要です。
            </AlertDescription>
          </Alert>

          {/* チャネル設定 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                LINE Loginチャネル情報
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="channelId">チャネルID</Label>
                <Input
                  id="channelId"
                  value={settings.channelId}
                  onChange={(e) => setSettings(prev => ({ 
                    ...prev, 
                    channelId: e.target.value,
                    loginUrl: generateLoginUrl(e.target.value, user?.id)
                  }))}
                  placeholder="チャネルIDを入力"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="channelSecret">チャネルシークレット</Label>
                <Input
                  id="channelSecret"
                  type="password"
                  value={settings.channelSecret}
                  onChange={(e) => setSettings(prev => ({ ...prev, channelSecret: e.target.value }))}
                  placeholder="チャネルシークレットを入力"
                />
              </div>

              <Button onClick={handleSave} disabled={saving || !settings.channelId || !settings.channelSecret}>
                {saving ? "保存中..." : "LINE Login設定を保存"}
              </Button>
            </CardContent>
          </Card>

          {/* LIFF設定 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                LIFF設定
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>LIFF設定手順：</strong><br />
                  1. LINE Developers コンソールでチャネルを選択<br />
                  2. 「LIFF」タブをクリック<br />
                  3. 「追加」ボタンでLIFFアプリを作成<br />
                  4. 「エンドポイントURL」に下記の自動生成URLを設定<br />
                  5. サイズは「Full」を選択（推奨）<br />
                  6. 作成後、LIFF IDとLIFF URLをここに入力
                </AlertDescription>
              </Alert>
              <div className="space-y-2">
                <Label htmlFor="liffId">LIFF ID</Label>
                <Input
                  id="liffId"
                  value={liffSettings.liffId}
                  onChange={(e) => {
                    const newLiffId = e.target.value
                    setLiffSettings(prev => ({ 
                      ...prev, 
                      liffId: newLiffId,
                      liffEndpointUrl: newLiffId ? `${window.location.origin}/liff?userId=${user?.id}&liffId=${newLiffId}` : ''
                    }))
                  }}
                  placeholder="LIFF IDを入力 (例: 2007859465-L5VQg5q9)"
                />
                <p className="text-sm text-muted-foreground">
                  LINE Developers コンソールから取得したLIFF IDを入力してください
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="liffUrl">LIFF URL</Label>
                <Input
                  id="liffUrl"
                  value={liffSettings.liffUrl}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value && value.includes('?')) {
                      toast({
                        title: "エラー",
                        description: "LIFF URLにはクエリパラメータ（?以降）を含めないでください。例: https://liff.line.me/{LIFF_ID}",
                        variant: "destructive"
                      });
                      return;
                    }
                    setLiffSettings(prev => ({ ...prev, liffUrl: value }));
                  }}
                  placeholder="LIFF URLを入力 (例: https://liff.line.me/2007859465-L5VQg5q9)"
                />
                <p className="text-sm text-muted-foreground">
                  <strong>重要:</strong> クエリパラメータ（?以降）は含めず、https://liff.line.me/&#123;LIFF_ID&#125; の形式で入力してください
                </p>
              </div>

              <div className="space-y-2">
                <Label>LIFFエンドポイントURL（設定用・自動生成）</Label>
                <div className="flex items-center gap-2">
                  <Input 
                    value={liffSettings.liffEndpointUrl} 
                    readOnly 
                    className="font-mono text-sm" 
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(
                      liffSettings.liffEndpointUrl, 
                      "LIFFエンドポイントURL"
                    )}
                    disabled={!liffSettings.liffEndpointUrl}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  {liffSettings.liffEndpointUrl.includes('[LINE_BOT_ID]') ? (
                    <>
                      <strong>重要：</strong> 上記URLの「[LINE_BOT_ID]」部分にLINE Bot ID（@から始まるID）を設定後、LINE Developers コンソールでLIFFアプリ作成時のエンドポイントURLに設定してください。<br />
                      セキュリティ向上のため、LIFF IDではなくLINE Bot IDをパラメーターに使用します。
                    </>
                  ) : (
                    <>
                      <strong>完了：</strong> 上記URLがあなた専用のLIFFエンドポイントURLです。LINE Bot IDをパラメーターに使用してセキュリティが向上しています。LINE Developers コンソールでLIFFアプリ作成時にそのまま設定してください。
                    </>
                  )}
                </p>
              </div>

              {liffSettings.liffUrl && user && (
                <div className="rounded-lg border p-4 space-y-2">
                  <p className="font-medium">Rich menu LIFF link example</p>
                  <p className="text-sm text-muted-foreground break-all">
                    {`${liffSettings.liffUrl}?userId=${user.id}&target=${encodeURIComponent('https://example.com/?uid=[UID]')}`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Update the encoded URL to the page you want to open (include [UID] when you need personalised links).
                  </p>
                </div>
              )}

              <Button onClick={handleLiffSave} disabled={savingLiff}>
                {savingLiff ? "保存中..." : "LIFF設定を保存"}
              </Button>
            </CardContent>
          </Card>

          {/* コールバックURL */}
          <Card>
            <CardHeader>
              <CardTitle>コールバックURL</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label>LINE Developersに設定するコールバックURL</Label>
                <div className="flex items-center gap-2">
                  <Input value={settings.callbackUrl} readOnly className="font-mono text-sm" />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(settings.callbackUrl, "コールバックURL")}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ログインURL */}
          {settings.loginUrl && (
            <Card>
              <CardHeader>
                <CardTitle>ログインURL</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>生成されたLINE LoginURL</Label>
                    <div className="flex items-center gap-2">
                      <Input value={settings.loginUrl} readOnly className="font-mono text-sm" />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(settings.loginUrl, "ログインURL")}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  <div className="space-y-2">
                    <Label>テスト用</Label>
                    <Button
                      variant="outline"
                      onClick={() => window.open(settings.loginUrl, '_blank')}
                      disabled={!isConfigured}
                    >
                      LINE Loginをテスト
                    </Button>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label>リダイレクト先（任意）</Label>
                    <p className="text-xs text-muted-foreground">
                      ログイン完了後に遷移させたいパスまたは同一ドメインのURLを入力すると、専用のログインURLを生成できます。
                    </p>
                    <Input
                      value={customNext}
                      onChange={(e) => setCustomNext(e.target.value)}
                      placeholder="/cms/f/XXXXXXXX"
                    />
                    <div className="flex items-center gap-2">
                      <Input value={customLoginUrl || ''} readOnly className="font-mono text-sm" />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(customLoginUrl, "カスタムログインURL")}
                        disabled={!customLoginUrl}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 設定手順 */}
          <Card>
            <CardHeader>
              <CardTitle>設定手順</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2 text-sm">
                <p><strong>1.</strong> LINE Developersコンソールにアクセス</p>
                <p><strong>2.</strong> 新しいチャネルを作成（LINE Login）</p>
                <p><strong>3.</strong> LIFFアプリケーションを追加</p>
                <p><strong>4.</strong> LIFFのエンドポイントURLには上記「LIFFエンドポイントURL」をそのまま設定</p>
                <p><strong>5.</strong> コールバックURLを設定（LINE Login用）</p>
                <p><strong>6.</strong> チャネルID、チャネルシークレット、LIFF ID、LIFF URLを取得</p>
                <p><strong>7.</strong> 上記フォームに入力してそれぞれ保存</p>
                <p><strong>8.</strong> 「LIFFエンドポイントURL」をユーザーに配布してアクセスしてもらう</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
