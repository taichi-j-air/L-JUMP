import { useEffect, useState } from "react"
import { supabase } from "@/integrations/supabase/client"
import { User } from "@supabase/supabase-js"
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar"
import { Badge } from "./ui/badge"
import { Button } from "./ui/button"
import { MessageCircle, Tag as TagIcon, ListChecks } from "lucide-react"
import { format } from "date-fns"
import { ChatWindow } from "./ChatWindow"
import { Input } from "./ui/input"
import { useToast } from "./ui/use-toast"
import { FriendScenarioDialog } from "./FriendScenarioDialog"
import FriendTagDialog from "./FriendTagDialog"

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
  const [searchTerm, setSearchTerm] = useState("")
  const [scenarioDialogFriend, setScenarioDialogFriend] = useState<Friend | null>(null)
  const [tagDialogFriend, setTagDialogFriend] = useState<Friend | null>(null)
  const { toast } = useToast()
  useEffect(() => {
    loadFriends()
  }, [user.id])

  const loadFriends = async () => {
    try {
      // データベースから友達リストを取得（APIは友だち追加時のみ使用）
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
    } catch (error) {
      console.error('Error loading friends:', error);
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

  const filteredFriends = friends.filter((f) => {
    const q = searchTerm.trim().toLowerCase()
    if (!q) return true
    return (
      (f.display_name || '').toLowerCase().includes(q) ||
      f.line_user_id.toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-2">
      <div className="mb-2">
        <Input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="ユーザー名やIDで検索"
          className="h-9"
          aria-label="友だち検索"
        />
      </div>

      <div className="space-y-0 divide-y rounded-md border">
        {filteredFriends.map((friend) => (
          <div key={friend.line_user_id} className="hover:bg-muted/50 transition-colors">
            <div className="p-2">
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
                      {format(new Date(friend.added_at), "yyyy/MM/dd HH:mm")}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground font-mono">
                    ID: {friend.line_user_id}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => setTagDialogFriend(friend)}
                    className="flex items-center gap-2"
                  >
                    <TagIcon className="h-4 w-4" />
                    タグ
                  </Button>

                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => setScenarioDialogFriend(friend)}
                    className="flex items-center gap-2"
                  >
                    <ListChecks className="h-4 w-4" />
                    シナリオ選択/解除
                  </Button>

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
              </div>
            </div>
          </div>
        ))}
      </div>

      {scenarioDialogFriend && (
        <FriendScenarioDialog
          open={!!scenarioDialogFriend}
          onOpenChange={(open) => { if (!open) setScenarioDialogFriend(null) }}
          user={user}
          friend={scenarioDialogFriend}
        />
      )}

      {tagDialogFriend && (
        <FriendTagDialog
          open={!!tagDialogFriend}
          onOpenChange={(open) => { if (!open) setTagDialogFriend(null) }}
          user={user}
          friend={{ id: tagDialogFriend.id, display_name: tagDialogFriend.display_name }}
        />
      )}
    </div>
  )
}