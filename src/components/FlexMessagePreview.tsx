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
      setLoading(true)
      if (!flexMessageId) return

      try {
        const { data, error } = await supabase
          .from('flex_messages')
          .select('*')
          .eq('id', flexMessageId)
          .single()

        if (error) throw error
        
        // JSON文字列の場合はパース
        const content = typeof data.content === 'string' 
          ? JSON.parse(data.content) 
          : data.content
          
        setFlexMessage({...data, content})
      } catch (error) {
        console.error('Flexメッセージの取得またはパースに失敗:', error)
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

  const renderFlexPreview = () => {
    // データ構造を確認: content.contents.body.contents
    const flexContents = flexMessage.content?.contents?.body?.contents;
    
    if (!flexContents || !Array.isArray(flexContents)) {
      return (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 max-w-[200px]">
          <div className="text-center">
            <p className="text-sm text-yellow-800">⚠️ Flexメッセージの構造が不正です</p>
            <p className="text-xs text-yellow-600 mt-1">デザイナーで再作成することをお勧めします</p>
          </div>
        </div>
      )
    }

    const elements = flexContents

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
                      color: element.color || '#000000',
                      fontSize: element.size === 'xs' ? '10px' : 
                               element.size === 'sm' ? '12px' :
                               element.size === 'lg' ? '16px' :
                               element.size === 'xl' ? '18px' : '14px',
                      fontWeight: element.weight === 'bold' ? 'bold' : 'normal',
                      textAlign: element.align as any || 'left',
                      whiteSpace: 'pre-wrap',
                      margin: element.margin || '0px'
                    }}
                  >
                    {element.text || 'テキスト'}
                  </div>
                )}
                {element.type === 'image' && element.url && (
                  <div className="flex-1" style={{ margin: element.margin || '0px' }}>
                    <img 
                      src={element.url} 
                      alt="プレビュー画像" 
                      className="w-full h-auto rounded"
                      style={{
                        aspectRatio: element.aspectRatio?.replace(':', '/') || '20/13',
                        maxHeight: '100px'
                      }}
                    />
                  </div>
                )}
                {element.type === 'button' && (
                  <div className="flex-1" style={{ margin: element.margin || '0px' }}>
                    <button 
                      className="w-full rounded text-xs font-medium"
                      style={{
                        backgroundColor: element.color || (
                          element.style === 'primary' ? '#0066cc' : 
                          element.style === 'secondary' ? '#f0f0f0' : 'transparent'
                        ),
                        color: element.color ? 
                          (element.color === '#ffffff' || element.color === '#f0f0f0' ? '#333' : 'white') :
                          (element.style === 'primary' ? 'white' : 
                           element.style === 'secondary' ? '#333' : '#0066cc'),
                        border: element.style === 'secondary' ? 'none' : 
                                element.style === 'link' ? 
                                  `1px solid ${element.color || '#0066cc'}` : 'none',
                        padding: element.height === 'sm' ? '6px 12px' : 
                                 element.height === 'lg' ? '12px 12px' : '8px 12px'
                      }}
                    >
                      {element.action?.label || 'ボタン'}
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