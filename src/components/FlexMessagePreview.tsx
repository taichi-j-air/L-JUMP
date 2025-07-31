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

  // FlexMessageDesignerと同じプレビューロジックを使用
  const renderFlexPreview = () => {
    if (!flexMessage.content || !flexMessage.content.body || !flexMessage.content.body.contents) {
      return (
        <div className="bg-white rounded-lg shadow-sm border max-w-[200px] p-3">
          <div className="text-center text-muted-foreground">
            <p className="text-xs">Flexメッセージ: {flexMessage.name}</p>
          </div>
        </div>
      )
    }

    const elements = flexMessage.content.body.contents

    return (
      <div className="bg-white rounded-lg shadow-sm border max-w-[200px]">
        <div className="p-3">
          {elements.map((element: any, index: number) => {
            const isFirst = index === 0;
            const isLast = index === elements.length - 1;
            
            return (
              <div 
                key={element.id || index} 
                className="flex"
                style={{
                  marginTop: !isFirst ? '10px' : undefined,
                  marginBottom: !isLast ? '10px' : undefined
                }}
              >
                {element.type === 'text' && (
                  <div 
                    className="flex-1"
                    style={{
                      color: element.properties?.color || '#000000',
                      backgroundColor: element.properties?.backgroundColor !== '#ffffff' ? element.properties?.backgroundColor : undefined,
                      fontSize: element.properties?.size === 'xs' ? '10px' : 
                               element.properties?.size === 'sm' ? '12px' :
                               element.properties?.size === 'lg' ? '16px' :
                               element.properties?.size === 'xl' ? '18px' : '14px',
                      fontWeight: element.properties?.weight === 'bold' ? 'bold' : 'normal',
                      textAlign: element.properties?.align as any || 'left',
                      padding: element.properties?.backgroundColor !== '#ffffff' ? '3px 6px' : undefined,
                      borderRadius: element.properties?.backgroundColor !== '#ffffff' ? '3px' : undefined,
                      whiteSpace: 'pre-wrap'
                    }}
                  >
                    {element.properties?.text || 'テキスト'}
                  </div>
                )}
                {element.type === 'image' && element.properties?.url && (
                  <div className="flex-1">
                    <img 
                      src={element.properties.url} 
                      alt="プレビュー画像" 
                      className="w-full h-auto rounded"
                      style={{
                        aspectRatio: element.properties.aspectRatio?.replace(':', '/') || '20/13',
                        maxHeight: '100px'
                      }}
                    />
                  </div>
                )}
                {element.type === 'button' && (
                  <div className="flex-1">
                    <button 
                      className="w-full rounded text-xs font-medium"
                      style={{
                        backgroundColor: element.properties?.color || (
                          element.properties?.style === 'primary' ? '#0066cc' : 
                          element.properties?.style === 'secondary' ? '#f0f0f0' : 'transparent'
                        ),
                        color: element.properties?.color ? 
                          (element.properties.color === '#ffffff' || element.properties.color === '#f0f0f0' ? '#333' : 'white') :
                          (element.properties?.style === 'primary' ? 'white' : 
                           element.properties?.style === 'secondary' ? '#333' : '#0066cc'),
                        border: element.properties?.style === 'secondary' ? 'none' : 
                                element.properties?.style === 'link' ? 
                                  `1px solid ${element.properties?.color || '#0066cc'}` : 'none',
                        padding: element.properties?.height === 'sm' ? '6px 12px' : 
                                 element.properties?.height === 'lg' ? '12px 12px' : '8px 12px'
                      }}
                    >
                      {element.properties?.action?.label || 'ボタン'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {renderFlexPreview()}
      <div className="text-xs text-muted-foreground text-center">
        {flexMessage.name}
      </div>
    </div>
  )
}