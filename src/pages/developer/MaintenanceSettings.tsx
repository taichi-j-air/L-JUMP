import { useState, useEffect } from "react"
import { supabase } from "@/integrations/supabase/client"
import { User } from "@supabase/supabase-js"
import { AppHeader } from "@/components/AppHeader"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Settings } from "lucide-react"
import { toast } from "sonner"

export default function MaintenanceSettings() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [maintenanceMode, setMaintenanceMode] = useState(false)
  const [maintenanceMessage, setMaintenanceMessage] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (user) {
      loadSettings()
    }
  }, [user])

  const loadSettings = async () => {
    try {
      const { data: settings, error } = await supabase
        .from('system_settings')
        .select('setting_key, setting_value')
        .in('setting_key', ['maintenance_mode', 'maintenance_message'])

      if (error) throw error

      const settingsMap = new Map(settings?.map(s => [s.setting_key, s.setting_value]) || [])
      
      setMaintenanceMode(settingsMap.get('maintenance_mode') === 'true')
      setMaintenanceMessage(settingsMap.get('maintenance_message') || 'システムメンテナンス中です。しばらくお待ちください。')
    } catch (error) {
      console.error('Error loading settings:', error)
      toast.error('設定の読み込みに失敗しました')
    }
  }

  const handleMaintenanceModeToggle = async (checked: boolean) => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('system_settings')
        .upsert({
          setting_key: 'maintenance_mode',
          setting_value: checked.toString(),
          description: '全体のメンテナンスモードの状態'
        })

      if (error) throw error

      setMaintenanceMode(checked)
      toast.success(checked ? 'メンテナンスモードを有効にしました' : 'メンテナンスモードを無効にしました')
    } catch (error) {
      console.error('Error updating maintenance mode:', error)
      toast.error('メンテナンスモードの切り替えに失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const handleMessageSave = async () => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('system_settings')
        .upsert({
          setting_key: 'maintenance_message',
          setting_value: maintenanceMessage,
          description: 'メンテナンス中に表示されるメッセージ'
        })

      if (error) throw error

      toast.success('メンテナンスメッセージを保存しました')
    } catch (error) {
      console.error('Error saving maintenance message:', error)
      toast.error('メンテナンスメッセージの保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="p-4">読み込み中...</div>
  }

  if (!user) {
    return <div className="p-4">ログインが必要です</div>
  }

  return (
    <div className="space-y-6">
      <AppHeader user={user} />
      
      <div className="container mx-auto px-4">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">メンテナンス設定</h1>
          <p className="text-muted-foreground">システム全体のメンテナンスモードを管理できます。</p>
        </div>

        {maintenanceMode && (
          <Alert className="mb-6 border-orange-200 bg-orange-50">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-700">
              現在メンテナンスモードが有効です。一般ユーザーはシステムにアクセスできません。
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                メンテナンスモード
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="maintenance-mode" className="text-base">
                    メンテナンスモードを有効にする
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    有効にすると、開発者以外のユーザーはシステムにアクセスできなくなります
                  </p>
                </div>
                <Switch
                  id="maintenance-mode"
                  checked={maintenanceMode}
                  onCheckedChange={handleMaintenanceModeToggle}
                  disabled={saving}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>メンテナンスメッセージ</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="maintenance-message">
                  ユーザーに表示するメッセージ
                </Label>
                <Textarea
                  id="maintenance-message"
                  value={maintenanceMessage}
                  onChange={(e) => setMaintenanceMessage(e.target.value)}
                  placeholder="メンテナンス中に表示するメッセージを入力してください"
                  rows={4}
                />
              </div>
              <Button onClick={handleMessageSave} disabled={saving}>
                {saving ? '保存中...' : 'メッセージを保存'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>メンテナンスモードの動作</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2" />
                  <div>
                    <strong>一般ユーザー:</strong> メンテナンス画面が表示され、システムを利用できません
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2" />
                  <div>
                    <strong>開発者:</strong> 通常どおりシステムを利用できます
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2" />
                  <div>
                    <strong>API:</strong> エラーレスポンスが返されます
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2" />
                  <div>
                    <strong>自動配信:</strong> 一時停止されます
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}