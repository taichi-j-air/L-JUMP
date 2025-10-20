import { useState, useEffect, useRef } from "react"
import { User } from "@supabase/supabase-js"
import { Send, Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Textarea } from "./ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "./ui/use-toast"
import { MessageQuotaDisplay } from "./MessageQuotaDisplay"
import { FlexMessageBubble } from "./FlexMessageBubble"

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
  metadata?: Record<string, any> | null
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
  const [supportsMetadata, setSupportsMetadata] = useState(true)
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
  }, [friend.id, supportsMetadata])

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
        const rawMessage = payload.new as ChatMessage
        const newMessage = supportsMetadata
          ? rawMessage
          : { ...rawMessage, metadata: null }
        setMessages(prev => {
          setMessages((prev) => [...prev, JSON.parse(payload.new.message_data) as unknown as ChatMessage]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [friend.id])

  const loadMessages = async (tryMetadata = supportsMetadata) => {
    try {
      const selectFields = tryMetadata
        ? 'id, message_text, message_type, sent_at, media_kind, content_type, media_url, thumbnail_url, file_name, file_size, sticker_id, sticker_package_id, metadata'
        : 'id, message_text, message_type, sent_at, media_kind, content_type, media_url, thumbnail_url, file_name, file_size, sticker_id, sticker_package_id'

      const { data, error } = await supabase
        .from('chat_messages')
        .select(selectFields)
        .eq('friend_id', friend.id)
        .order('sent_at', { ascending: true })

      if (error) {
        if (error.code === '42703' && tryMetadata) {
          console.warn('Metadata column not available; falling back without metadata')
          setSupportsMetadata(false)
          await loadMessages(false)
        } else {
          console.error('Error loading messages:', error)
        }
      } else {
        const normalized = (data || []).map((msg: any) => ({
          ...msg,
          metadata: tryMetadata ? (msg.metadata ?? null) : null
        })) as ChatMessage[]
        setMessages(normalized)
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  // UIDパラメーター付与関数
  const addUidToFormLinks = (message: string, friendShortUid: string | null): string => {
    let updated = message;

    const effectiveUid = friendShortUid?.trim() || null;
    if (effectiveUid) {
      updated = updated.replace(/\[UID\]/g, effectiveUid);
    } else {
      updated = updated.replace(/\[UID\]/g, "");
    }

    const rawDisplayName = typeof friend.display_name === "string" ? friend.display_name.trim() : "";
    const fallbackName = rawDisplayName.length > 0 ? rawDisplayName : "あなた";
    const fallbackNameSan = fallbackName === "あなた" ? "あなた" : `${fallbackName}さん`;

    updated = updated
      .replace(/\[LINE_NAME_SAN\]/g, fallbackNameSan)
      .replace(/\[LINE_NAME\]/g, fallbackName);

    const formLinkPattern = /(https?:\/\/[^\/]+\/form\/[a-f0-9\-]+(?:\?[^?\s]*)?)/gi;

    if (!effectiveUid) {
      return updated;
    }

    return updated.replace(formLinkPattern, (match) => {
      try {
        const url = new URL(match);
        // Check if uid parameter already exists to prevent duplication
        if (!url.searchParams.has("uid")) {
          url.searchParams.set("uid", effectiveUid);
        }
        return url.toString();
      } catch (error) {
        console.error("Error processing form URL:", error);
        return match; // Return original URL if parsing fails
      }
    });
  };

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
      const insertMessage = async (tryMetadata = supportsMetadata) => {
        const selectFields = tryMetadata
          ? 'id, message_text, message_type, sent_at, metadata'
          : 'id, message_text, message_type, sent_at'

        const { data, error } = await supabase
          .from('chat_messages')
          .insert({
            user_id: user.id,
            friend_id: friend.id,
            message_text: processedMessage,
            message_type: 'outgoing'
          })
          .select(selectFields)
          .single()

        if (error && error.code === '42703' && tryMetadata) {
          console.warn('Metadata column not available during insert; retrying without metadata')
          setSupportsMetadata(false)
          return insertMessage(false)
        }

        return { data, error }
      }

      const { data: savedMessage, error: saveError } = await insertMessage()

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
    if ((e.key === 'Enter' && e.shiftKey) || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) {
      e.preventDefault()
      sendMessage()
    }
  }

  const getSourceLabel = (metadata?: Record<string, any> | null) => {
    const source = metadata?.source
    switch (source) {
      case 'step_delivery':
        return 'ステップ配信'
      case 'flex_message_designer':
        return 'Flexメッセージ配信'
      default:
        return null
    }
  }

  return (
    <div className="flex gap-4 h-full">
      <Card className="min-h-[600px] max-h-[80vh] flex flex-col w-[700px] overflow-x-hidden">
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
      
        <CardContent className="flex-1 flex flex-col p-4 min-h-0 min-w-0">
          <div className="flex-1 overflow-y-auto space-y-4 mb-4 min-h-0 min-w-0" style={{ backgroundColor: 'rgb(140, 171, 216)' }}>
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
              messages.map((message) => {
                const sourceLabel = getSourceLabel(message.metadata)
                const isOutgoing = message.message_type === 'outgoing'
                const flexPayload =
                  message.metadata?.flex_payload ??
                  message.metadata?.line_message ??
                  null
                const isFlex =
                  message.media_kind === 'flex' ||
                  message.content_type === 'application/vnd.line.flex+json'

                return (
                  <div
                    key={message.id}
                    className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg mx-2 word-wrap break-words ${
                        message.media_kind === 'sticker' || isFlex
                          ? ''
                          : `px-3 py-2 ${
                              isOutgoing
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted'
                            }`
                      }`}
                    >
                      {sourceLabel ? (
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                          {sourceLabel}
                        </div>
                      ) : null}

                      {isFlex ? (
                        <FlexMessageBubble payload={flexPayload} altText={message.message_text} />
                      ) : message.media_kind === 'image' && message.media_url ? (
                        <div className="space-y-2">
                          <img
                            src={message.media_url}
                            alt="送信された画像"
                            className="max-w-full h-auto rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                            onError={(e) => {
                              console.error('Image failed to load:', message.media_url)
                              e.currentTarget.src =
                                'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDIwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMTAwIiBmaWxsPSIjRjNGNEY2Ii8+Cjx0ZXh0IHg9IjEwMCIgeT0iNTUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzZCNzI4MCIgdGV4dC1hbmNob3I9Im1pZGRsZSI+55S75YOP44GM6Kqt44G/6L6844KB44G+44Gb44KT44Gn44GX44GfPC90ZXh0Pgo8L3N2Zz4K'
                            }}
                            onClick={() => window.open(message.media_url ?? '', '_blank')}
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
                                console.error('Sticker failed to load:', message.media_url)
                                e.currentTarget.style.display = 'none'
                                const fallback = e.currentTarget.nextElementSibling as HTMLElement
                                if (fallback) fallback.style.display = 'block'
                              }}
                            />
                          ) : null}
                          <div className="text-4xl" style={{ display: message.media_url ? 'none' : 'block' }}>
                            🎨
                          </div>
                          {message.message_text && (
                            <p className="text-sm">{message.message_text}</p>
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
                      <p className={`text-xs opacity-70 ${isFlex ? 'mt-2' : 'mt-1'}`}>
                        {new Date(message.sent_at).toLocaleString('ja-JP', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                )
              })
            )}
            <div ref={messagesEndRef} />
          </div>
          
          <div className="flex flex-col gap-2 flex-shrink-0">
            <div className="flex gap-2">
              <Textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="メッセージを入力..."
                disabled={sending}
                className="flex-1 resize-none"
                rows={1}
              />
              <Button 
                onClick={sendMessage} 
                disabled={!newMessage.trim() || sending}
                size="sm"
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "送信"
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Enter: 改行 | Ctrl+Enter (Mac: Cmd+Enter): 送信
            </p>
          </div>
        </CardContent>
      </Card>
      <div className="w-80 flex-shrink-0">
        <MessageQuotaDisplay user={user} />
      </div>
    </div>
  )
}
