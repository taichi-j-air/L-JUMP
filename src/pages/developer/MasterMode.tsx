import { useState, useEffect } from "react"
import { supabase } from "@/integrations/supabase/client"
import { User } from "@supabase/supabase-js"
import { AppHeader } from "@/components/AppHeader"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, BarChart3, Settings, Users, Video } from "lucide-react"
import { toast } from "sonner"
import { useNavigate } from "react-router-dom"

const MasterMode = () => {
  const [user, setUser] = useState<User | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    checkUserAndAuth()
  }, [])

  const checkUserAndAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.user) {
        navigate("/auth")
        return
      }

      setUser(session.user)

      // 開発者権限チェック
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_role')
        .eq('user_id', session.user.id)
        .single()

      if (!profile || profile.user_role !== 'developer') {
        navigate("/")
        return
      }
    } catch (error) {
      console.error("Error loading data:", error)
      toast.error("データの読み込みに失敗しました")
    }
  }

  if (!user) {
    return <div>Loading...</div>
  }

  return (
    <div className="space-y-6">
      <AppHeader user={user} />
      
      <div className="container mx-auto px-4">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Settings className="w-6 h-6" />
              開発者設定
            </h1>
            <p className="text-muted-foreground">システム全体の管理機能にアクセスできます。</p>
          </div>
          <Button variant="outline" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            ダッシュボードに戻る
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                プラン管理
              </CardTitle>
              <CardDescription>
                料金プランと機能制限の設定
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => navigate("/developer/plan-management")}
                className="w-full"
              >
                プラン管理を開く
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                ユーザー管理
              </CardTitle>
              <CardDescription>
                全ユーザーの管理と統計情報
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => navigate("/developer/user-management")}
                className="w-full"
              >
                ユーザー管理を開く
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Video className="w-5 h-5" />
                オンボーディング動画管理
              </CardTitle>
              <CardDescription>
                オンボーディングで表示される動画の管理
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => navigate("/developer/onboarding-video-management")}
                className="w-full"
              >
                動画管理を開く
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                メンテナンス設定
              </CardTitle>
              <CardDescription>
                システム全体のメンテナンス制御
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => navigate("/developer/maintenance-settings")}
                className="w-full"
              >
                メンテナンス設定を開く
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default MasterMode