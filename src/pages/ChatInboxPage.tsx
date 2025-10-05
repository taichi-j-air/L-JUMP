import { useEffect, useState } from "react"
import { supabase } from "@/integrations/supabase/client"
import { useNavigate, useSearchParams } from "react-router-dom"
import { User } from "@supabase/supabase-js"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AppHeader } from "@/components/AppHeader"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ChatWindow } from "@/components/ChatWindow"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

interface Friend {
  id: string
  line_user_id: string
  display_name: string | null
  picture_url: string | null
  last_message_at?: string
  unread_count?: number
}

interface ChatMessage {
  id: string
  message_text: string
  message_type: string
  sent_at: string
  friend_id: string
}

export default function ChatInboxPage() {
  const [user, setUser] = useState<User | null>(null)
  const [friends, setFriends] = useState<Friend[]>([])
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalFriendsCount, setTotalFriendsCount] = useState(0)
  const itemsPerPage = 20
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

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

  useEffect(() => {
    if (user) {
      loadFriendsWithLastMessage()
    }
  }, [user, currentPage]) // Add currentPage to dependency array

  useEffect(() => {
    const friendId = searchParams.get('friend')
    if (friendId && friends.length > 0) {
      const friend = friends.find(f => f.id === friendId)
      if (friend) {
        setSelectedFriend(friend)
      }
    }
  }, [searchParams, friends])

  const loadFriendsWithLastMessage = async () => {
    if (!user) return

    try {
      // 1. Fetch total count of friends
      const { count, error: countError } = await supabase
        .from('line_friends')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)

      if (countError) {
        console.error('Error counting friends:', countError)
        return
      }
      setTotalFriendsCount(count || 0)

      // Calculate range for current page
      const startIndex = (currentPage - 1) * itemsPerPage
      const endIndex = startIndex + itemsPerPage - 1

      // 友達一覧を取得
      const { data: friendsData, error: friendsError } = await supabase
        .from('line_friends')
        .select('*')
        .eq('user_id', user.id)
        .order('added_at', { ascending: false })
        .range(startIndex, endIndex) // Apply pagination

      if (friendsError) {
        console.error('Error loading friends:', friendsError)
        return
      }

      // 各友達の最新メッセージ時刻と未読数を取得
      const friendsWithLastMessage = await Promise.all(
        (friendsData || []).map(async (friend) => {
          const { data: lastMessage } = await supabase
            .from('chat_messages')
            .select('sent_at')
            .eq('friend_id', friend.id)
            .order('sent_at', { ascending: false })
            .limit(1)

          // 未読メッセージ数を取得
          const { count: unreadCount } = await supabase
            .from('chat_messages')
            .select('*', { count: 'exact', head: true })
            .eq('friend_id', friend.id)
            .eq('message_type', 'incoming')
            .is('read_at', null)

          return {
            ...friend,
            last_message_at: lastMessage?.[0]?.sent_at || friend.added_at,
            unread_count: unreadCount || 0
          }
        })
      )

      // 最新メッセージ時刻でソート
      const sortedFriends = friendsWithLastMessage.sort((a, b) => 
        new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime()
      )

      setFriends(sortedFriends)
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const handleFriendSelect = async (friend: Friend) => {
    setSelectedFriend(friend)
    setSearchParams({ friend: friend.id })
    
    // メッセージを既読にする
    await supabase
      .from('chat_messages')
      .update({ 
        read_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } as any)
      .eq('friend_id', friend.id)
      .eq('message_type', 'incoming')
      .is('read_at', null)
    
    // 友達リストを再読み込みして未読数を更新
    loadFriendsWithLastMessage()
    
    // サイドバーの未読数を更新するためのカスタムイベントを発火
    window.dispatchEvent(new CustomEvent('refreshUnreadCount'))
  }

  if (loading) {
    return <div className="p-8">読み込み中...</div>
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader user={user} />
      
      <main className="mx-auto px-4 py-8 max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">チャット受信箱</h1>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-160px)]">
          {/* 左側: チャット送信者一覧 */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>チャット一覧</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[calc(100vh-260px)] overflow-y-auto">
                {friends.length === 0 ? (
                  <div className="text-center text-muted-foreground p-4">
                    <div>チャットがありません</div>
                    <div className="text-xs mt-1">
                      LINEの公式アカウントからメッセージを受信するとここに表示されます
                    </div>
                  </div>
                ) : (
                  friends.map((friend) => (
                    <div
                      key={friend.id}
                      onClick={() => handleFriendSelect(friend)}
                      className={`flex items-center gap-2 py-1.5 px-2 border-b cursor-pointer hover:bg-muted/50 transition-colors ${
                        selectedFriend?.id === friend.id ? 'bg-primary/10 border-primary/20' : ''
                      }`}
                    >
                      <Avatar className="h-7 w-7">
                        <AvatarImage src={friend.picture_url || ""} />
                        <AvatarFallback>
                          {friend.display_name?.charAt(0) || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate text-xs">
                          {friend.display_name || "名前未設定"}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {friend.last_message_at && 
                            new Date(friend.last_message_at).toLocaleDateString('ja-JP', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })
                          }
                        </div>
                      </div>
                      {friend.unread_count && friend.unread_count > 0 && (
                        <Badge 
                          variant="destructive" 
                          className="h-3.5 w-3.5 flex items-center justify-center p-0 text-[9px] bg-red-500 text-white rounded-full"
                        >
                          {friend.unread_count}
                        </Badge>
                       )}
                     </div>
                   ))
                )}
              </div>
            </CardContent>
            <div className="flex justify-center gap-2 p-4 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                前へ
              </Button>
              <span className="text-sm flex items-center">
                {currentPage} / {Math.ceil(totalFriendsCount / itemsPerPage)}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.min(Math.ceil(totalFriendsCount / itemsPerPage), prev + 1))}
                disabled={currentPage === Math.ceil(totalFriendsCount / itemsPerPage)}
              >
                次へ
              </Button>
            </div>
          </Card>

          {/* 右側: チャット画面 */}
          <div className="lg:col-span-2">
            {selectedFriend ? (
              <ChatWindow 
                user={user} 
                friend={selectedFriend}
                onClose={() => {
                  setSelectedFriend(null)
                  setSearchParams({})
                }}
              />
            ) : (
              <Card className="h-full flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <div className="text-lg mb-2">チャットを選択してください</div>
                  <div className="text-sm">
                    左側のリストからチャットを選択すると、ここに会話が表示されます
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}