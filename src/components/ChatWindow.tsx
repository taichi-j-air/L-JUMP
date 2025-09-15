import { useState, useEffect, useRef } from "react"
import { User } from "@supabase/supabase-js"
import { Send, Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "./ui/use-toast"
import { MessageQuotaDisplay } from "./MessageQuotaDisplay"

interface Friend {
  id: string
  line_user_id: string
  display_name: string | null
  picture_url: string | null
}

interface ChatMessage {
  id: string
  message_text: string
  message_type: 'outgoing' | 'incoming'
  sent_at: string
  media_kind?: string
  content_type?: string
  media_url?: string
  thumbnail_url?: string
  file_name?: string
  file_size?: number
  sticker_id?: string
  sticker_package_id?: string
}

interface ChatWindowProps {
  user: User
  friend: Friend
  onClose: () => void
}

export function ChatWindow({ user, friend, onClose }: ChatWindowProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    loadMessages()
  }, [friend.id])

  // リアルタイム購読の追加
  useEffect(() => {
    const channel = supabase
      .channel(`chat-${friend.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `friend_id=eq.${friend.id}`
      }, (payload) => {
        const newMessage = payload.new as ChatMessage;
        if (newMessage.message_type === 'incoming') {
          setMessages(prev => [...prev, newMessage]);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [friend.id])

  const loadMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('id, message_text, message_type, sent_at, media_kind, content_type, media_url, thumbnail_url, file_name, file_size, sticker_id, sticker_package_id')
        .eq('friend_id', friend.id)
        .order('sent_at', { ascending: true })

      if (error) {
        console.error('Error loading messages:', error)
      } else {
        setMessages((data || []) as ChatMessage[])
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  // UIDパラメーター付与関数
  const addUidToFormLinks = (message: string, friendShortUid: string | null): string => {
    if (!friendShortUid) return message
    
    // [UID]変数をshort_uidで置換
    message = message.replace(/\[UID\]/g, friendShortUid);
    
    // レガシー対応：既存のformリンクのパターンも検出してuidパラメーターを付与
    const formLinkPattern = /(https?:\/\/[^\/]+\/form\/[a-f0-9\-]+(?:\?[^?\s]*)?)/gi
    
    return message.replace(formLinkPattern, (match) => {
      try {
        const url = new URL(match)
        // Check if uid parameter already exists to prevent duplication
        if (!url.searchParams.has('uid')) {
          url.searchParams.set('uid', friendShortUid)
        }
        return url.toString()
      } catch (error) {
        console.error('Error processing form URL:', error)
        return match // Return original URL if parsing fails
      }
    })
  }

  const sendMessage = async () => {
    if (!newMessage.trim() || sending) return

    setSending(true)
    try {
      // 配信数チェック
      const { data: profile } = await supabase
        .from('profiles')
        .select('monthly_message_used, monthly_message_limit')
        .eq('user_id', user.id)
        .single()

      if (profile && profile.monthly_message_used >= profile.monthly_message_limit) {
        toast({
          title: "送信制限に達しました",
          description: "今月の配信上限に達しているため送信できません",
          variant: "destructive"
        })
        setSending(false)
        return
      }

      // 友達のshort_uidを取得
      const { data: friendData } = await supabase
        .from('line_friends')
        .select('short_uid')
        .eq('id', friend.id)
        .single()

      // UIDパラメーター付与処理
      const processedMessage = addUidToFormLinks(newMessage, friendData?.short_uid || null)

      // Save message to database first
      const { data: savedMessage, error: saveError } = await supabase
        .from('chat_messages')
        .insert({
          user_id: user.id,
          friend_id: friend.id,
          message_text: processedMessage,
          message_type: 'outgoing'
        })
        .select('id, message_text, message_type, sent_at')
        .single()

      if (saveError) {
        console.error('Error saving message:', saveError)
        toast({
          title: "メッセージの保存に失敗しました",
          description: "もう一度お試しください",
          variant: "destructive"
        })
        return
      }

      // Check if this is a test friend
      if (friend.line_user_id.startsWith('test_')) {
        // Add message to local state for test friends
        setMessages(prev => [...prev, savedMessage as ChatMessage])
        
        // Simulate a test reply after 1 second
        setTimeout(() => {
          const testReply: ChatMessage = {
            id: `test_reply_${Date.now()}`,
            message_text: `これはテスト友達からの自動返信です: ${newMessage}`,
            message_type: 'incoming',
            sent_at: new Date().toISOString()
          }
          setMessages(prev => [...prev, testReply])
        }, 1000)

        toast({
          title: "テストメッセージを送信しました",
          description: "これはテスト友達なのでLINEには送信されません",
        })
        
        setNewMessage("")
        setSending(false)
        return
      }

      // Add message to local state
      setMessages(prev => [...prev, savedMessage as ChatMessage])

      // Send message via LINE API (処理済みメッセージを使用)
      const { error: sendError } = await supabase.functions.invoke('send-line-message', {
        body: {
          to: friend.line_user_id,
          message: processedMessage
        }
      })

      if (sendError) {
        console.error('Error sending message:', sendError)
        toast({
          title: "メッセージの送信に失敗しました",
          description: "データベースには保存されましたが、LINE送信に失敗しました",
          variant: "destructive"
        })
      } else {
        toast({
          title: "メッセージを送信しました",
          description: `${friend.display_name}にメッセージを送信しました`,
        })
      }

      setNewMessage("")
    } catch (error) {
      console.error('Error:', error)
      toast({
        title: "エラーが発生しました",
        description: "メッセージの送信に失敗しました",
        variant: "destructive"
      })
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex gap-4 h-full">
      <Card className="min-h-[600px] max-h-[80vh] flex flex-col flex-1">
        <CardHeader className="flex-row items-center space-y-0 pb-2 flex-shrink-0">
          <Avatar className="h-8 w-8 mr-3">
            <AvatarImage src={friend.picture_url || ""} alt={friend.display_name || ""} />
            <AvatarFallback>
              {friend.display_name?.charAt(0) || "?"}
            </AvatarFallback>
          </Avatar>
          <CardTitle className="flex-1 text-lg">
            {friend.display_name || "名前未設定"}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            ×
          </Button>
        </CardHeader>
      
        <CardContent className="flex-1 flex flex-col p-4 min-h-0">
          <div className="flex-1 overflow-y-auto space-y-4 mb-4 min-h-0">
            {loading ? (
              <div className="text-center text-muted-foreground py-8">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                <p>メッセージを読み込み中...</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <p>メッセージはまだありません</p>
                <p className="text-sm">最初のメッセージを送信してみましょう</p>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.message_type === 'outgoing' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                     className={`max-w-[80%] rounded-lg px-3 py-2 word-wrap break-words ${
                       message.message_type === 'outgoing'
                         ? 'bg-primary text-primary-foreground'
                         : 'bg-muted'
                     }`}
                   >
                     {message.media_kind === 'image' && message.media_url ? (
                       <div className="space-y-2">
                         <img 
                           src={message.media_url} 
                           alt="送信された画像" 
                           className="max-w-full h-auto rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                           onError={(e) => {
                             console.error('Image failed to load:', message.media_url);
                             e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDIwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMTAwIiBmaWxsPSIjRjNGNEY2Ii8+Cjx0ZXh0IHg9IjEwMCIgeT0iNTUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzZCNzI4MCIgdGV4dC1hbmNob3I9Im1pZGRsZSI+55S75YOP44GM6Kqt44G/6L6844KB44G+44Gb44KT44Gn44GX44GfPC90ZXh0Pgo8L3N2Zz4K';
                           }}
                           onClick={() => window.open(message.media_url, '_blank')}
                         />
                         {message.message_text && (
                           <p className="text-sm">{message.message_text}</p>
                         )}
                       </div>
                     ) : message.media_kind === 'video' && message.media_url ? (
                       <div className="space-y-2">
                         <video 
                           controls 
                           className="max-w-full h-auto rounded-lg"
                           poster={message.thumbnail_url}
                           preload="metadata"
                         >
                           <source src={message.media_url} type={message.content_type || 'video/mp4'} />
                           お使いのブラウザは動画をサポートしていません。
                         </video>
                         {message.message_text && (
                           <p className="text-sm">{message.message_text}</p>
                         )}
                       </div>
                     ) : message.media_kind === 'audio' && message.media_url ? (
                       <div className="space-y-2">
                         <div className="bg-muted/50 rounded-lg p-3">
                           <div className="flex items-center gap-2 mb-2">
                             <span className="text-lg">🎵</span>
                             <span className="text-sm font-medium">音声メッセージ</span>
                           </div>
                           <audio controls className="w-full">
                             <source src={message.media_url} type={message.content_type || 'audio/m4a'} />
                             お使いのブラウザは音声をサポートしていません。
                           </audio>
                         </div>
                         {message.message_text && (
                           <p className="text-sm">{message.message_text}</p>
                         )}
                       </div>
                     ) : message.media_kind === 'sticker' ? (
                       <div className="space-y-2">
                         {message.media_url ? (
                           <img 
                             src={message.media_url}
                             alt="スタンプ"
                             className="w-32 h-32 object-contain rounded-lg"
                             onError={(e) => {
                               console.error('Sticker failed to load:', message.media_url);
                               // Fallback to emoji
                               e.currentTarget.style.display = 'none';
                               const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                               if (fallback) fallback.style.display = 'block';
                             }}
                           />
                         ) : null}
                         <div className="text-4xl" style={{ display: message.media_url ? 'none' : 'block' }}>
                           🎨
                         </div>
                         {message.message_text && (
                           <p className="text-sm">{message.message_text}</p>
                         )}
                         {message.sticker_id && (
                           <p className="text-xs opacity-60">スタンプID: {message.sticker_id}</p>
                         )}
                       </div>
                     ) : message.media_kind === 'file' ? (
                       <div className="space-y-2">
                         <div className="bg-muted/50 rounded-lg p-3">
                           <div className="flex items-center gap-2">
                             <span className="text-lg">📎</span>
                             <div className="flex-1 min-w-0">
                               {message.media_url ? (
                                 <a 
                                   href={message.media_url}
                                   download={message.file_name}
                                   className="text-sm font-medium text-primary hover:underline truncate block"
                                 >
                                   {message.file_name || 'ファイル'}
                                 </a>
                               ) : (
                                 <span className="text-sm font-medium truncate block">
                                   {message.file_name || 'ファイル'}
                                 </span>
                               )}
                               {message.file_size && (
                                 <span className="text-xs text-muted-foreground">
                                   {(message.file_size / 1024).toFixed(1)}KB
                                 </span>
                               )}
                             </div>
                           </div>
                         </div>
                         {message.message_text && (
                           <p className="text-sm">{message.message_text}</p>
                         )}
                       </div>
                     ) : (
                       <p className="text-sm whitespace-pre-wrap">{message.message_text}</p>
                     )}
                     <p className="text-xs opacity-70 mt-1">
                       {new Date(message.sent_at).toLocaleTimeString('ja-JP', {
                         hour: '2-digit',
                         minute: '2-digit'
                       })}
                     </p>
                   </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
          
          <div className="flex gap-2 flex-shrink-0">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="メッセージを入力..."
              disabled={sending}
              className="flex-1"
            />
            <Button 
              onClick={sendMessage} 
              disabled={!newMessage.trim() || sending}
              size="icon"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
      <div className="w-80 flex-shrink-0">
        <MessageQuotaDisplay user={user} />
      </div>
    </div>
  )
}