import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { supabase } from "@/integrations/supabase/client"
import { User } from "@supabase/supabase-js"
import { ChatWindow } from "@/components/ChatWindow"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"

interface Friend {
  id: string
  line_user_id: string
  display_name: string | null
  picture_url: string | null
}

export default function IndividualChatPage() {
  const { friendId } = useParams<{ friendId: string }>()
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(null)
  const [friend, setFriend] = useState<Friend | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkUser()
  }, [])

  useEffect(() => {
    if (user && friendId) {
      loadFriend()
    }
  }, [user, friendId])

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session?.user) {
      navigate('/auth')
      return
    }
    
    setUser(session.user)
  }

  const loadFriend = async () => {
    if (!user || !friendId) return

    try {
      const { data, error } = await supabase
        .from('line_friends')
        .select('*')
        .eq('id', friendId)
        .eq('user_id', user.id)
        .single()

      if (error) {
        console.error('Error loading friend:', error)
        navigate('/friends-list')
      } else {
        setFriend(data)
      }
    } catch (error) {
      console.error('Error:', error)
      navigate('/friends-list')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="p-8">読み込み中...</div>
  }

  if (!user || !friend) {
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/friends-list")}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              友達一覧に戻る
            </Button>
            <h1 className="text-2xl font-bold">
              {friend.display_name || "名前未設定"}とのチャット
            </h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <ChatWindow 
          user={user} 
          friend={friend} 
          onClose={() => navigate("/friends-list")} 
        />
      </main>
    </div>
  )
}