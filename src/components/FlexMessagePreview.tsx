import { useState, useEffect } from "react"
import { supabase } from "@/integrations/supabase/client"

interface FlexMessagePreviewProps {
  flexMessageId: string
}

interface FlexMessage {
  id: string
  name: string
  content: any
}

export function FlexMessagePreview({ flexMessageId }: FlexMessagePreviewProps) {
  const [flexMessage, setFlexMessage] = useState<FlexMessage | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchFlexMessage = async () => {
      if (!flexMessageId) return

      try {
        const { data, error } = await supabase
          .from('flex_messages')
          .select('*')
          .eq('id', flexMessageId)
          .single()

        if (error) throw error
        setFlexMessage(data)
      } catch (error) {
        console.error('Flexメッセージの取得に失敗しました:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchFlexMessage()
  }, [flexMessageId])

  if (loading) {
    return (
      <div className="bg-background rounded border p-2">
        <p className="text-xs text-muted-foreground">読み込み中...</p>
      </div>
    )
  }

  if (!flexMessage) {
    return (
      <div className="bg-background rounded border p-2">
        <p className="text-xs text-muted-foreground">Flexメッセージが見つかりません</p>
      </div>
    )
  }

  // Flexメッセージの基本的なプレビューを表示
  const renderFlexContent = () => {
    const content = flexMessage.content

    // Bubble型の処理
    if (content.type === 'bubble') {
      return (
        <div className="border rounded-lg overflow-hidden bg-white text-black max-w-[200px]">
          {/* Hero画像 */}
          {content.hero?.url && (
            <div className="w-full h-20 bg-cover bg-center" 
                 style={{ backgroundImage: `url(${content.hero.url})` }} />
          )}
          
          {/* Body部分 */}
          {content.body && (
            <div className="p-3 space-y-2">
              {content.body.contents?.map((item: any, index: number) => {
                if (item.type === 'text') {
                  return (
                    <div key={index} className={`text-${item.size || 'sm'} ${item.weight === 'bold' ? 'font-bold' : ''}`}>
                      {item.text}
                    </div>
                  )
                } else if (item.type === 'box') {
                  return (
                    <div key={index} className="space-y-1">
                      {item.contents?.map((subItem: any, subIndex: number) => (
                        <div key={subIndex} className="text-xs text-gray-600">
                          {subItem.text}
                        </div>
                      ))}
                    </div>
                  )
                }
                return null
              })}
            </div>
          )}
          
          {/* Footer部分 */}
          {content.footer && (
            <div className="p-2 border-t">
              {content.footer.contents?.map((item: any, index: number) => {
                if (item.type === 'button') {
                  return (
                    <div key={index} className="bg-blue-500 text-white text-center py-1 px-2 rounded text-xs">
                      {item.action?.label || 'ボタン'}
                    </div>
                  )
                }
                return null
              })}
            </div>
          )}
        </div>
      )
    }

    // Carousel型の処理
    if (content.type === 'carousel') {
      return (
        <div className="flex gap-2 overflow-x-auto max-w-[200px]">
          {content.contents?.slice(0, 2).map((bubble: any, index: number) => (
            <div key={index} className="border rounded-lg overflow-hidden bg-white text-black min-w-[120px]">
              {bubble.hero?.url && (
                <div className="w-full h-16 bg-cover bg-center" 
                     style={{ backgroundImage: `url(${bubble.hero.url})` }} />
              )}
              <div className="p-2 space-y-1">
                {bubble.body?.contents?.slice(0, 2).map((item: any, itemIndex: number) => (
                  <div key={itemIndex} className="text-xs">
                    {item.text}
                  </div>
                ))}
              </div>
            </div>
          ))}
          {content.contents?.length > 2 && (
            <div className="flex items-center text-xs text-muted-foreground">
              +{content.contents.length - 2}
            </div>
          )}
        </div>
      )
    }

    // その他の型の場合
    return (
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 border rounded-lg p-3 max-w-[200px]">
        <div className="text-xs font-medium text-blue-800 mb-1">Flexメッセージ</div>
        <div className="text-xs text-gray-600">{flexMessage.name}</div>
        <div className="text-xs text-muted-foreground mt-1">
          型: {content.type || 'unknown'}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {renderFlexContent()}
      <div className="text-xs text-muted-foreground">
        Flexメッセージ: {flexMessage.name}
      </div>
    </div>
  )
}