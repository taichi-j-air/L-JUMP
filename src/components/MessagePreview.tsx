import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Smartphone } from "lucide-react"
import { StepMessage } from "@/hooks/useStepScenarios"

interface MessagePreviewProps {
  messages: StepMessage[]
}

export function MessagePreview({ messages }: MessagePreviewProps) {
  return (
    <Card className="h-fit">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Smartphone className="h-4 w-4" />
          配信プレビュー
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-[500px] overflow-y-auto">
          {messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <Smartphone className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">メッセージを追加してプレビューを確認</p>
            </div>
          ) : (
            messages.map((message, index) => (
              <div key={message.id} className="flex gap-2">
                <Avatar className="h-6 w-6 flex-shrink-0">
                  <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                    Bot
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="bg-muted rounded-lg p-3 max-w-[200px]">
                    {message.message_type === 'text' ? (
                      <p className="text-sm whitespace-pre-wrap break-words">
                        {message.content || 'テキストメッセージ'}
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {message.media_url ? (
                          <div className="bg-background rounded border p-2 space-y-2">
                            {/* Check if it's an image */}
                            {message.media_url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                              <img 
                                src={message.media_url} 
                                alt="Preview" 
                                className="max-w-full h-auto rounded"
                                style={{ maxHeight: '120px' }}
                              />
                            ) : message.media_url.match(/\.(mp4|webm|ogg)$/i) ? (
                              <video 
                                src={message.media_url} 
                                className="max-w-full h-auto rounded"
                                style={{ maxHeight: '120px' }}
                                controls
                              />
                            ) : (
                              <div className="text-center p-4 bg-muted rounded">
                                <p className="text-xs text-muted-foreground">メディアファイル</p>
                                <p className="text-xs font-mono">{message.media_url.split('/').pop()}</p>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="bg-background rounded border p-2">
                            <p className="text-xs text-muted-foreground">メディアが選択されていません</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    メッセージ {index + 1}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}