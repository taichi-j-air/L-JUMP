import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Copy, CheckCircle, AlertTriangle, Settings } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { toast } from "@/hooks/use-toast"
import { AppHeader } from "@/components/AppHeader"

export default function LineLoginSettings() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState({
    channelId: '',
    channelSecret: '',
    callbackUrl: '',
    loginUrl: ''
  })

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
        .select('line_channel_id, line_channel_secret')
        .eq('user_id', userId)
        .single()

      if (profile) {
        const baseUrl = window.location.origin
        const callbackUrl = `https://rtjxurmuaawyzjcdkqxt.supabase.co/functions/v1/login-callback`
        const loginUrl = generateLoginUrl(profile.line_channel_id)
        
        setSettings({
          channelId: profile.line_channel_id || '',
          channelSecret: profile.line_channel_secret || '',
          callbackUrl,
          loginUrl
        })
      }
    } catch (error) {
      console.error('設定読み込みエラー:', error)
    }
  }

  const generateLoginUrl = (channelId: string) => {
    if (!channelId) return ''
    
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: channelId,
      redirect_uri: `https://rtjxurmuaawyzjcdkqxt.supabase.co/functions/v1/login-callback`,
      state: 'login',
      scope: 'profile openid email'
    })
    
    return `https://access.line.me/oauth2/v2.1/authorize?${params.toString()}`
  }

  const handleSave = async () => {
    if (!user) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          line_channel_id: settings.channelId,
          line_channel_secret: settings.channelSecret,
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

  return (
    <div className="min-h-screen bg-background">
      <AppHeader user={user} />
      
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <div className="flex items-center gap-3 mb-6">
          <Settings className="h-6 w-6" />
          <h1 className="text-2xl font-bold">LINE Login設定</h1>
          <Badge variant={isConfigured ? "default" : "secondary"}>
            {isConfigured ? "設定済み" : "未設定"}
          </Badge>
        </div>

        <div className="space-y-6">
          {/* 設定状況 */}
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              LINE Loginを使用するには、LINE Developersコンソールでチャネル設定が必要です。
              設定後、チャネルIDとチャネルシークレットを以下に入力してください。
            </AlertDescription>
          </Alert>

          {/* チャネル設定 */}
          <Card>
            <CardHeader>
              <CardTitle>チャネル情報</CardTitle>
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
                {saving ? "保存中..." : "保存"}
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
                <p><strong>3.</strong> コールバックURLを設定</p>
                <p><strong>4.</strong> チャネルIDとチャネルシークレットを取得</p>
                <p><strong>5.</strong> 上記フォームに入力して保存</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}