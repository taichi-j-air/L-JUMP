import { useEffect, useState } from "react"
import { supabase } from "@/integrations/supabase/client"
import { useNavigate } from "react-router-dom"
import { User } from "@supabase/supabase-js"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FriendsList } from "@/components/FriendsList"

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

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            友達一覧
          </CardTitle>
        </CardHeader>
        <CardContent>
          <FriendsList user={user} />
        </CardContent>
      </Card>
    </div>
  )
}