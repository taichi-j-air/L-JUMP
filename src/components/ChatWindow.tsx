import { useState, useEffect, useRef } from "react"
import { User } from "@supabase/supabase-js"
import { Send, Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "./ui/use-toast"

interface Friend {
  id: string
  line_user_id: string
  display_name: string | null
  picture_url: string | null
}

interface Message {
  id: string
  text: string
  sender: 'user' | 'friend'
  timestamp: Date
}

interface ChatWindowProps {
  user: User
  friend: Friend
  onClose: () => void
}

export function ChatWindow({ user, friend, onClose }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const sendMessage = async () => {
    if (!newMessage.trim() || sending) return

    setSending(true)
    try {
      // Add message to local state immediately
      const userMessage: Message = {
        id: Date.now().toString(),
        text: newMessage,
        sender: 'user',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, userMessage])

      // Send message via LINE API
      const { data, error } = await supabase.functions.invoke('send-line-message', {
        body: {
          to: friend.line_user_id,
          message: newMessage
        }
      })

      if (error) {
        console.error('Error sending message:', error)
        toast({
          title: "メッセージの送信に失敗しました",
          description: "もう一度お試しください",
          variant: "destructive"
        })
        // Remove the message from local state if sending failed
        setMessages(prev => prev.filter(msg => msg.id !== userMessage.id))
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

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader className="flex-row items-center space-y-0 pb-2">
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
      
      <CardContent className="flex-1 flex flex-col p-4">
        <div className="flex-1 overflow-y-auto space-y-4 mb-4">
          {messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <p>メッセージはまだありません</p>
              <p className="text-sm">最初のメッセージを送信してみましょう</p>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 ${
                    message.sender === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  <p className="text-sm">{message.text}</p>
                  <p className="text-xs opacity-70 mt-1">
                    {message.timestamp.toLocaleTimeString('ja-JP', {
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
        
        <div className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
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
  )
}