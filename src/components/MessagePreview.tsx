import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Smartphone } from "lucide-react"
import { FlexMessagePreview } from "./FlexMessagePreview"

interface StepMessage {
  id?: string;
  message_type: "text" | "media" | "flex" | "restore_access";
  content: string;
  media_url?: string | null;
  flex_message_id?: string | null;
  message_order: number;
  restore_config?: {
    type: "button" | "image";
    title?: string;
    button_text?: string;
    target_scenario_id?: string;
    image_url?: string;
  } | null;
}

interface MessagePreviewProps {
  messages: StepMessage[]
  editingMessages?: StepMessage[]  // 編集中のメッセージ（未保存状態でもプレビュー表示）
}

export function MessagePreview({ messages, editingMessages }: MessagePreviewProps) {
  // 編集中のメッセージがあればそれを優先、なければ保存済みメッセージを使用
  const displayMessages = editingMessages && editingMessages.length > 0 ? editingMessages : messages;
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
          {displayMessages.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <Smartphone className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">メッセージを追加してプレビューを確認</p>
            </div>
          ) : (
            displayMessages.map((message, index) => (
              <div key={message.id} className="flex gap-2">
                <Avatar className="h-6 w-6 flex-shrink-0">
                  <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                    Bot
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className={`bg-muted rounded-lg p-3 ${message.message_type === 'flex' ? 'max-w-[380px]' : 'max-w-[200px]'}`}>
                    {message.message_type === 'text' ? (
                      <p className="text-sm whitespace-pre-wrap break-words">
                        {message.content || 'テキストメッセージ'}
                      </p>
                    ) : message.message_type === 'media' ? (
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
                     ) : message.message_type === 'flex' ? (
                       message.flex_message_id ? (
                         <FlexMessagePreview flexMessageId={message.flex_message_id} />
                       ) : (
                         <div className="bg-background rounded border p-2">
                           <p className="text-xs text-muted-foreground">Flexメッセージが選択されていません</p>
                         </div>
                       )
                     ) : message.message_type === 'restore_access' ? (
                       <div className="space-y-0 bg-white rounded-lg border border-gray-200 overflow-hidden max-w-[300px]">
                         {message.restore_config?.type === 'button' ? (
                           // OKボタンタイプ：テキスト + ボタン
                           <>
                             <div className="p-4 text-center">
                               <p className="text-sm text-gray-800">
                                 {message.restore_config.title || 'アクセスを回復しますか？'}
                               </p>
                             </div>
                             <div className="border-t border-gray-200">
                               <button className="w-full py-3 text-center text-white bg-[#00B900] hover:bg-[#00A000] transition-colors font-medium text-sm">
                                 {message.restore_config.button_text || 'OK'}
                               </button>
                             </div>
                           </>
                         ) : message.restore_config?.type === 'image' && message.restore_config.image_url ? (
                           // 画像ボタンタイプ：画像 + ボタン
                           <>
                             <div className="aspect-video bg-gray-100">
                               <img 
                                 src={message.restore_config.image_url} 
                                 alt="Restoration action" 
                                 className="w-full h-full object-cover"
                               />
                             </div>
                             <div className="border-t border-gray-200">
                               <button className="w-full py-3 text-center text-white bg-[#00B900] hover:bg-[#00A000] transition-colors font-medium text-sm">
                                 {message.restore_config.button_text || 'OK'}
                               </button>
                             </div>
                           </>
                         ) : (
                           // 未設定の場合
                           <div className="p-4 text-center">
                             <p className="text-xs text-muted-foreground">復活アクションが設定されていません</p>
                           </div>
                         )}
                       </div>
                     ) : (
                       <div className="bg-background rounded border p-2">
                         <p className="text-xs text-muted-foreground">不明なメッセージタイプ</p>
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