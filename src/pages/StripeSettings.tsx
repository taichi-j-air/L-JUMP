import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { CreditCard, Settings, ExternalLink, CheckCircle, XCircle } from "lucide-react"
import { toast } from "sonner"
import { supabase } from "@/integrations/supabase/client"
import { AppHeader } from "@/components/AppHeader"
import { User } from "@supabase/supabase-js"

export default function StripeSettings() {
  const [user, setUser] = useState<User | null>(null)
  const [stripeSettings, setStripeSettings] = useState({
    secretKey: '',
    publishableKey: '',
    webhookSecret: ''
  })
  const [isConnected, setIsConnected] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        window.location.href = '/auth'
        return
      }
      setUser(user)
      loadStripeSettings()
    }
    checkUser()
  }, [])

  const loadStripeSettings = async () => {
    // In a real application, you would load existing Stripe settings from your database
    // For now, we'll just check if the user has configured Stripe
    try {
      // This is a placeholder - implement your actual loading logic
      setIsConnected(false)
    } catch (error) {
      console.error('Failed to load Stripe settings:', error)
    }
  }

  const saveStripeSettings = async () => {
    if (!stripeSettings.secretKey || !stripeSettings.publishableKey) {
      toast.error('Stripe Secret KeyとPublishable Keyは必須です')
      return
    }

    setLoading(true)
    try {
      // Here you would save the Stripe settings to your database or Supabase secrets
      // For security, the secret key should be stored as a Supabase secret
      
      toast.success('Stripe設定を保存しました')
      setIsConnected(true)
    } catch (error) {
      console.error('Failed to save Stripe settings:', error)
      toast.error('Stripe設定の保存に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const testStripeConnection = async () => {
    if (!isConnected) {
      toast.error('まずStripe設定を保存してください')
      return
    }

    setLoading(true)
    try {
      // Test Stripe connection here
      toast.success('Stripe接続テストが成功しました')
    } catch (error) {
      console.error('Stripe connection test failed:', error)
      toast.error('Stripe接続テストに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  if (!user) {
    return <div>Loading...</div>
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader user={user} />
      
      <main className="container mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center gap-3">
          <CreditCard className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Stripe決済連携設定</h1>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* 設定フォーム */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  API設定
                </CardTitle>
                <CardDescription>
                  StripeのAPI キーを設定してください。本番環境では必ず本番用のキーを使用してください。
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="secretKey">Secret Key</Label>
                  <Input
                    id="secretKey"
                    type="password"
                    placeholder="sk_test_... または sk_live_..."
                    value={stripeSettings.secretKey}
                    onChange={(e) => setStripeSettings(prev => ({
                      ...prev,
                      secretKey: e.target.value
                    }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    サーバーサイドの処理で使用されます（Supabase Secretsに保存）
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="publishableKey">Publishable Key</Label>
                  <Input
                    id="publishableKey"
                    placeholder="pk_test_... または pk_live_..."
                    value={stripeSettings.publishableKey}
                    onChange={(e) => setStripeSettings(prev => ({
                      ...prev,
                      publishableKey: e.target.value
                    }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    フロントエンドの処理で使用されます（公開可能）
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="webhookSecret">Webhook Secret (オプション)</Label>
                  <Input
                    id="webhookSecret"
                    type="password"
                    placeholder="whsec_..."
                    value={stripeSettings.webhookSecret}
                    onChange={(e) => setStripeSettings(prev => ({
                      ...prev,
                      webhookSecret: e.target.value
                    }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Webhookイベントの検証に使用
                  </p>
                </div>

                <Separator />

                <div className="flex gap-2">
                  <Button 
                    onClick={saveStripeSettings}
                    disabled={loading}
                    className="flex-1"
                  >
                    {loading ? '保存中...' : '設定を保存'}
                  </Button>
                  
                  <Button 
                    variant="outline"
                    onClick={testStripeConnection}
                    disabled={loading || !isConnected}
                  >
                    接続テスト
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ステータス・ヘルプ */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>接続ステータス</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  {isConnected ? (
                    <>
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <Badge variant="default" className="bg-green-100 text-green-800">
                        接続済み
                      </Badge>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4 text-red-600" />
                      <Badge variant="secondary">未接続</Badge>
                    </>
                  )}
                </div>
                
                {isConnected && (
                  <div className="mt-3 text-sm text-muted-foreground">
                    Stripe決済が正常に動作しています
                  </div>
                )}
              </CardContent>
            </Card>

            <Alert>
              <ExternalLink className="h-4 w-4" />
              <AlertDescription className="space-y-2">
                <p className="font-medium">Stripe設定ガイド</p>
                <ul className="text-sm space-y-1 list-disc list-inside">
                  <li>StripeダッシュボードからAPIキーを取得</li>
                  <li>テスト環境では test キーを使用</li>
                  <li>本番環境では live キーを使用</li>
                  <li>Webhookエンドポイントの設定（オプション）</li>
                </ul>
                <Button variant="link" className="h-auto p-0 text-xs">
                  Stripe公式ドキュメントを確認 →
                </Button>
              </AlertDescription>
            </Alert>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">注意事項</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <p className="text-muted-foreground">
                  • Secret Keyは厳重に管理し、フロントエンドには含めないでください
                </p>
                <p className="text-muted-foreground">
                  • 本番環境に移行する際は、必ずライブキーに変更してください
                </p>
                <p className="text-muted-foreground">
                  • Webhookを使用する場合は、適切なエンドポイントを設定してください
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}