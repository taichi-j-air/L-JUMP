import { useState, useEffect } from "react"
import { supabase } from "@/integrations/supabase/client"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "./ui/button"

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
  const [carouselIndex, setCarouselIndex] = useState(0)

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

    // リアルタイム更新の設定
    const channel = supabase
      .channel(`flex_message_${flexMessageId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'flex_messages',
          filter: `id=eq.${flexMessageId}`
        },
        (payload) => {
          console.log('Flexメッセージが更新されました:', payload)
          const newData = payload.new as any
          const content = typeof newData.content === 'string'
            ? JSON.parse(newData.content)
            : newData.content
          setFlexMessage({...newData, content})
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
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

  // Helper functions for converting tokens to pixels
  const getMarginPx = (token?: string): string => {
    const map: Record<string, string> = {
      none: "0px",
      xs: "2px",
      sm: "4px",
      md: "8px",
      lg: "12px",
      xl: "16px",
      xxl: "20px"
    };
    return map[token || "none"] || "0px";
  };

  const padToPx = (token?: string): string => {
    const map: Record<string, string> = {
      none: "0px",
      xs: "4px",
      sm: "8px",
      md: "12px",
      lg: "16px",
      xl: "20px"
    };
    return map[token || "none"] || "0px";
  };

  const renderSingleBubble = (bubble: any) => {
    const hero = bubble?.hero;
    const flexContents = bubble?.body?.contents;
    
    if (!flexContents || !Array.isArray(flexContents)) {
      return (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 max-w-[280px] mx-auto">
          <div className="text-center">
            <p className="text-sm text-yellow-800">⚠️ Flexメッセージの構造が不正です</p>
            <p className="text-xs text-yellow-600 mt-1">デザイナーで再作成することをお勧めします</p>
          </div>
        </div>
      )
    }

    const elements = flexContents

    return (
      <div className="bg-white rounded-lg shadow-sm border max-w-[280px] mx-auto overflow-hidden">
        {/* Hero block */}
        {hero && (
          <div className="w-full">
            {hero.type === 'image' && (
              <img
                src={hero.url}
                alt="Hero画像"
                className="w-full"
                style={{
                  aspectRatio: hero.aspectRatio?.replace(':', '/') || '20/13',
                  objectFit: hero.aspectMode === 'cover' ? 'cover' : 'contain',
                }}
              />
            )}
            {hero.type === 'video' && (
              <div className="relative w-full bg-black">
                <video
                  src={hero.url}
                  className="w-full"
                  style={{
                    aspectRatio: hero.aspectRatio?.replace(':', '/') || '20/13',
                    objectFit: hero.aspectMode === 'cover' ? 'cover' : 'contain',
                  }}
                  controls
                />
              </div>
            )}
          </div>
        )}
        
        {/* Body contents */}
        <div 
          className={hero ? 'p-3' : ''}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: bubble?.body?.spacing ? getMarginPx(bubble.body.spacing) : '0px'
          }}
        >
          {elements.map((element: any, index: number) => {
            const marginTop = element.properties?.margin ? getMarginPx(element.properties.margin) : undefined;
            const padding = element.properties?.padding ? padToPx(element.properties.padding) : undefined;
            
            return (
              <div 
                key={element.id || index}
                className="flex"
                style={{
                  marginTop,
                  padding
                }}
              >
                {element.type === 'text' && (
                  <div 
                    className="flex-1"
                    style={{
                      color: element.color || element.properties?.color || '#000000',
                      backgroundColor: (element.backgroundColor !== '#ffffff' && element.backgroundColor) || 
                                     (element.properties?.backgroundColor !== '#ffffff' && element.properties?.backgroundColor) ? 
                                     element.backgroundColor || element.properties?.backgroundColor : undefined,
                      fontSize: (element.size || element.properties?.size) === 'xs' ? '12px' : 
                               (element.size || element.properties?.size) === 'sm' ? '14px' :
                               (element.size || element.properties?.size) === 'lg' ? '18px' :
                               (element.size || element.properties?.size) === 'xl' ? '20px' : '16px',
                      fontWeight: (element.weight || element.properties?.weight) === 'bold' ? 'bold' : 'normal',
                      textAlign: (element.align || element.properties?.align) as any || 'left',
                      padding: ((element.backgroundColor !== '#ffffff' && element.backgroundColor) || 
                               (element.properties?.backgroundColor !== '#ffffff' && element.properties?.backgroundColor)) ? '4px 8px' : undefined,
                      borderRadius: ((element.backgroundColor !== '#ffffff' && element.backgroundColor) || 
                                   (element.properties?.backgroundColor !== '#ffffff' && element.properties?.backgroundColor)) ? '4px' : undefined,
                      whiteSpace: 'pre-wrap'
                    }}
                  >
                    {element.text || element.properties?.text || 'テキスト'}
                  </div>
                )}
                {element.type === 'image' && (element.url || element.properties?.url) && (
                  <div className="flex-1">
                    <img 
                      src={element.url || element.properties?.url} 
                      alt="プレビュー画像" 
                      className="w-full h-auto rounded"
                      style={{
                        aspectRatio: (element.aspectRatio || element.properties?.aspectRatio)?.replace(':', '/') || '20/13'
                      }}
                    />
                  </div>
                )}
                {element.type === 'button' && (
                  <div className="flex-1">
                    <button 
                      className="w-full rounded text-sm font-medium"
                      style={{
                        backgroundColor: (element.color || element.properties?.color) || (
                          (element.style || element.properties?.style) === 'primary' ? '#0066cc' : 
                          (element.style || element.properties?.style) === 'secondary' ? '#f0f0f0' : 'transparent'
                        ),
                        color: (element.color || element.properties?.color) ? 
                          ((element.color || element.properties?.color) === '#ffffff' || (element.color || element.properties?.color) === '#f0f0f0' ? '#333' : 'white') :
                          ((element.style || element.properties?.style) === 'primary' ? 'white' : 
                           (element.style || element.properties?.style) === 'secondary' ? '#333' : '#0066cc'),
                        border: (element.style || element.properties?.style) === 'secondary' ? 'none' : 
                                (element.style || element.properties?.style) === 'link' ? 
                                  `1px solid ${(element.color || element.properties?.color) || '#0066cc'}` : 'none',
                        padding: (element.height || element.properties?.height) === 'sm' ? '8px 16px' : 
                                 (element.height || element.properties?.height) === 'lg' ? '16px 16px' : '12px 16px'
                      }}
                    >
                      {element.action?.label || element.properties?.action?.label || 'ボタン'}
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

  const renderFlexPreview = () => {
    const content = flexMessage.content?.contents || flexMessage.content;
    const isCarousel = content?.type === "carousel";

    if (isCarousel && content?.contents && Array.isArray(content.contents)) {
      const totalBubbles = content.contents.length;
      
      const handlePrev = () => {
        setCarouselIndex((prev) => (prev > 0 ? prev - 1 : totalBubbles - 1));
      };

      const handleNext = () => {
        setCarouselIndex((prev) => (prev < totalBubbles - 1 ? prev + 1 : 0));
      };

      return (
        <div className="relative flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handlePrev}
            className="flex-shrink-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <div className="flex-1 flex justify-center">
            {renderSingleBubble(content.contents[carouselIndex])}
          </div>
          
          <Button
            variant="outline"
            size="icon"
            onClick={handleNext}
            className="flex-shrink-0"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-background/80 px-2 py-1 rounded text-xs">
            {carouselIndex + 1} / {totalBubbles}
          </div>
        </div>
      );
    }

    return renderSingleBubble(content);
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