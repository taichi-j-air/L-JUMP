import { useEffect, useState } from "react"
import { supabase } from "@/integrations/supabase/client"
import { User } from "@supabase/supabase-js"
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Badge } from "./ui/badge"
import { Button } from "./ui/button"
import { MessageCircle } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { ja } from "date-fns/locale"
import { ChatWindow } from "./ChatWindow"

interface Friend {
  id: string
  line_user_id: string
  display_name: string | null
  picture_url: string | null
  added_at: string
}

interface FriendsListProps {
  user: User
}

export function FriendsList({ user }: FriendsListProps) {
  const [friends, setFriends] = useState<Friend[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null)

  useEffect(() => {
    loadFriends()
  }, [user.id])

  const loadFriends = async () => {
    try {
      // LINE APIから直接友達リストを取得
      const { data, error } = await supabase.functions.invoke('get-line-friends');

      if (error) {
        console.error('Error loading friends from LINE API:', error);
        // フォールバック: DBから取得
        const { data: dbData, error: dbError } = await supabase
          .from('line_friends')
          .select('*')
          .eq('user_id', user.id)
          .order('added_at', { ascending: false });

        if (dbError) {
          console.error('Error loading friends from DB:', dbError);
        } else {
          setFriends(dbData || []);
        }
      } else {
        setFriends(data.friends || []);
      }
    } catch (error) {
      console.error('Error:', error);
      // フォールバック: DBから取得
      const { data: dbData, error: dbError } = await supabase
        .from('line_friends')
        .select('*')
        .eq('user_id', user.id)
        .order('added_at', { ascending: false });

      if (dbError) {
        console.error('Error loading friends from DB:', dbError);
      } else {
        setFriends(dbData || []);
      }
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="p-4">読み込み中...</div>
  }

  if (friends.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        まだ友達が追加されていません
      </div>
    )
  }

  if (selectedFriend) {
    return (
      <ChatWindow 
        user={user} 
        friend={selectedFriend} 
        onClose={() => setSelectedFriend(null)} 
      />
    )
  }

  return (
    <div className="space-y-4">
      {friends.map((friend) => (
        <Card key={friend.line_user_id} className="hover:bg-muted/50 transition-colors">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={friend.picture_url || ""} alt={friend.display_name || ""} />
                <AvatarFallback>
                  {friend.display_name?.charAt(0) || "?"}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium truncate">
                    {friend.display_name || "名前未設定"}
                  </h4>
                  <Badge variant="secondary" className="text-xs">
                    {formatDistanceToNow(new Date(friend.added_at), { 
                      addSuffix: true, 
                      locale: ja 
                    })}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground font-mono">
                  ID: {friend.line_user_id}
                </p>
              </div>
              
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => setSelectedFriend(friend)}
                className="flex items-center gap-2"
              >
                <MessageCircle className="h-4 w-4" />
                チャット
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}