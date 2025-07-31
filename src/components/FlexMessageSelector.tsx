import { useState, useEffect } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { supabase } from "@/integrations/supabase/client"
import { toast } from "sonner"

interface FlexMessage {
  id: string
  name: string
  content: any
  created_at: string
}

interface FlexMessageSelectorProps {
  onSelect: (flexMessageId: string) => void
  selectedFlexMessageId?: string
}

export function FlexMessageSelector({ onSelect, selectedFlexMessageId }: FlexMessageSelectorProps) {
  const [flexMessages, setFlexMessages] = useState<FlexMessage[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchFlexMessages()
  }, [])

  const fetchFlexMessages = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        toast.error("ユーザー認証が必要です")
        return
      }

      const { data, error } = await supabase
        .from('flex_messages')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        throw error
      }

      setFlexMessages(data || [])
    } catch (error) {
      console.error('Error fetching Flex messages:', error)
      toast.error("Flexメッセージの取得に失敗しました")
    } finally {
      setLoading(false)
    }
  }

  const selectedMessage = flexMessages.find(m => m.id === selectedFlexMessageId)

  return (
    <div className="space-y-3">
      <div>
        <Label>Flexメッセージを選択</Label>
        <Select 
          value={selectedFlexMessageId || ""} 
          onValueChange={onSelect}
          disabled={loading}
        >
          <SelectTrigger>
            <SelectValue placeholder={loading ? "読み込み中..." : "Flexメッセージを選択してください"} />
          </SelectTrigger>
          <SelectContent>
            {flexMessages.map((message) => (
              <SelectItem key={message.id} value={message.id}>
                {message.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedMessage && (
        <Card>
          <CardContent className="p-3">
            <h4 className="text-sm font-medium mb-2">{selectedMessage.name}</h4>
            <div className="text-xs text-muted-foreground">
              作成日: {new Date(selectedMessage.created_at).toLocaleString('ja-JP')}
            </div>
            <div className="mt-2 p-2 bg-muted/50 rounded text-xs">
              <strong>プレビューはFlexメッセージデザイナーで確認してください</strong>
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && flexMessages.length === 0 && (
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-sm text-muted-foreground">
              Flexメッセージがありません。<br />
              Flexメッセージデザイナーで作成してください。
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}