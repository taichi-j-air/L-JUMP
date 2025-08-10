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
  const [inviteCodes, setInviteCodes] = useState<string[]>([])

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
        .select('line_login_channel_id, line_login_channel_secret, line_channel_id, line_channel_secret, liff_id, liff_url')
        .eq('user_id', userId)
        .maybeSingle()

      if (profile) {
        const callbackUrl = `https://rtjxurmuaawyzjcdkqxt.supabase.co/functions/v1/login-callback`
        const channelId = profile.line_login_channel_id || profile.line_channel_id || ''
        const channelSecret = profile.line_login_channel_secret || profile.line_channel_secret || ''
        const loginUrl = generateLoginUrl(channelId)
        const liffId = profile.liff_id || ''
        const liffUrl = profile.liff_url || ''
        
        // LIFF認証専用ページのエンドポイントURL生成
        const liffEndpointUrl = liffId ? `https://rtjxurmuaawyzjcdkqxt.supabase.co/functions/v1/liff-scenario-invite?code=YOUR_INVITE_CODE` : ''
        
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

      // 招待コード一覧を取得（自分のアカウント用・動的）
      const { data: codes } = await supabase
        .from('scenario_invite_codes')
        .select('invite_code')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      setInviteCodes((codes || []).map((c: any) => c.invite_code))
    } catch (error) {
      console.error('設定読み込みエラー:', error)
    }
  }

  const generateLoginUrl = (channelId: string) => {
    if (!channelId) return ''
    
    // LINE Login の正確な URL 構造を使用
    const baseUrl = 'https://access.line.me/oauth2/v2.1/authorize'
    const params = {
      response_type: 'code',
      client_id: channelId,
      redirect_uri: 'https://rtjxurmuaawyzjcdkqxt.supabase.co/functions/v1/login-callback',
      state: 'login',
      scope: 'openid profile',
      bot_prompt: 'aggressive'  // 友だち追加を促進
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
      const loginUrl = generateLoginUrl(settings.channelId)
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

      // LIFF設定保存後、エンドポイントURLを更新
      const liffEndpointUrl = liffSettings.liffId ? `https://rtjxurmuaawyzjcdkqxt.supabase.co/functions/v1/liff-scenario-invite?code=YOUR_INVITE_CODE` : ''
      setLiffSettings(prev => ({ ...prev, liffEndpointUrl }))

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
                    loginUrl: generateLoginUrl(e.target.value)
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
                      liffEndpointUrl: newLiffId ? `https://rtjxurmuaawyzjcdkqxt.supabase.co/functions/v1/liff-scenario-invite?code=YOUR_INVITE_CODE` : ''
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
                  onChange={(e) => setLiffSettings(prev => ({ ...prev, liffUrl: e.target.value }))}
                  placeholder="LIFF URLを入力 (例: https://liff.line.me/2007859465-L5VQg5q9)"
                />
                <p className="text-sm text-muted-foreground">
                  完全なLIFF URLを入力してください
                </p>
              </div>

              <div className="space-y-2">
                <Label>LIFFエンドポイントURL（自動生成）</Label>
                <div className="flex items-center gap-2">
                  <Input value={liffSettings.liffEndpointUrl} readOnly className="font-mono text-sm" />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(liffSettings.liffEndpointUrl, "LIFFエンドポイントURL")}
                    disabled={!liffSettings.liffEndpointUrl}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  LINE Developers コンソールのLIFF設定で「エンドポイントURL」として設定してください。
                  ユーザーは「https://liff.line.me/{"{LIFF_ID}"}」からLIFF認証にアクセスできます。
                </p>
              </div>

              <Button onClick={handleLiffSave} disabled={savingLiff || !liffSettings.liffId || !liffSettings.liffUrl}>
                {savingLiff ? "保存中..." : "LIFF設定を保存"}
              </Button>
            </CardContent>
          </Card>

          {/* 招待コードとLIFF起動URL（動的） */}
          <Card>
            <CardHeader>
              <CardTitle>招待コードとLIFF起動URL（動的）</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {inviteCodes.length === 0 ? (
                <p className="text-sm text-muted-foreground">招待コードがまだありません。シナリオから招待コードを作成してください。</p>
              ) : (
                inviteCodes.map((code) => {
                  const liffStartUrl = `https://rtjxurmuaawyzjcdkqxt.supabase.co/functions/v1/liff-scenario-invite?code=${code}`
                  const invitePageUrl = `${window.location.origin}/invite/${code}`
                  return (
                    <div key={code} className="space-y-2 border rounded-md p-3">
                      <div className="space-y-1">
                        <Label>招待コード</Label>
                        <div className="flex items-center gap-2">
                          <Input value={code} readOnly className="font-mono text-sm" />
                          <Button variant="outline" size="sm" onClick={() => copyToClipboard(code, '招待コード')}>
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label>LIFF起動URL（LINEアプリ内で完結）</Label>
                        <div className="flex items-center gap-2">
                          <Input value={liffStartUrl} readOnly className="font-mono text-sm" />
                          <Button variant="outline" size="sm" onClick={() => copyToClipboard(liffStartUrl, 'LIFF起動URL')}>
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label>QR配布用URL（未追加ユーザーの誘導にも対応）</Label>
                        <div className="flex items-center gap-2">
                          <Input value={invitePageUrl} readOnly className="font-mono text-sm" />
                          <Button variant="outline" size="sm" onClick={() => copyToClipboard(invitePageUrl, 'QR配布用URL')}>
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
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
