import { useEffect, useState } from "react"
import { supabase } from "@/integrations/supabase/client"
import { useNavigate } from "react-router-dom"
import { User } from "@supabase/supabase-js"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FriendsList } from "@/components/FriendsList"
import { MessageQuotaDisplay } from "@/components/MessageQuotaDisplay"
import { Button } from "@/components/ui/button"
import { ArrowLeft, RefreshCw } from "lucide-react"

export default function FriendsListPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.user) {
        navigate('/auth')
        return
      }
      
      setUser(session.user)
      setLoading(false)
    }

    checkUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!session?.user) {
          navigate('/auth')
        } else {
          setUser(session.user)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [navigate])

  if (loading) {
    return <div className="p-8">読み込み中...</div>
  }

  if (!user) {
    return null
  }

  const refreshPage = () => {
    window.location.reload()
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/")}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                ダッシュボードに戻る
              </Button>
              <h1 className="text-2xl font-bold">友達一覧</h1>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={refreshPage}
              className="flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              更新
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>友達一覧</CardTitle>
              </CardHeader>
              <CardContent>
                <FriendsList user={user} />
              </CardContent>
            </Card>
          </div>
          
          <div className="space-y-6">
            <MessageQuotaDisplay user={user} />
          </div>
        </div>
      </main>
    </div>
  )
}