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
            gap: bubble?.body?.spacing ? getMarginPx(bubble.body.spacing) : '0px',
            backgroundColor: bubble?.bodyBg && bubble.bodyBg !== '#ffffff' ? bubble.bodyBg : undefined
          }}
        >
          {elements.map((element: any, index: number) => {
            return (
              <div 
                key={element.id || index}
                style={{
                  marginTop: getMarginPx(element.properties?.margin),
                  padding: padToPx(element.properties?.padding),
                  backgroundColor: element.properties?.backgroundColor && element.properties.backgroundColor !== '#ffffff' ? element.properties.backgroundColor : undefined,
                  borderRadius: element.properties?.backgroundColor && element.properties.backgroundColor !== '#ffffff' ? '4px' : undefined
                }}
              >
                {element.type === 'text' && (
                  <div 
                    style={{
                      color: element.properties?.color || '#000',
                      textAlign: (element.properties?.align || 'start') as any,
                      fontSize: element.properties?.size === 'xxs' ? '10px' :
                               element.properties?.size === 'xs' ? '12px' :
                               element.properties?.size === 'sm' ? '14px' :
                               element.properties?.size === 'md' ? '16px' :
                               element.properties?.size === 'lg' ? '18px' :
                               element.properties?.size === 'xl' ? '20px' :
                               element.properties?.size === 'xxl' ? '24px' :
                               element.properties?.size === '3xl' ? '28px' :
                               element.properties?.size === '4xl' ? '32px' :
                               element.properties?.size === '5xl' ? '36px' : '14px',
                      fontWeight: element.properties?.weight === 'bold' ? 'bold' : 'normal',
                      whiteSpace: 'pre-wrap',
                      overflowWrap: 'break-word'
                    }}
                  >
                    {element.properties?.text || ''}
                  </div>
                )}
                {element.type === 'image' && element.properties?.url && (
                  <div>
                    <img 
                      src={element.properties.url} 
                      alt="img" 
                      className="w-full rounded block"
                      style={{
                        aspectRatio: element.properties.aspectRatio?.replace(':', '/') || 'auto',
                        objectFit: element.properties.aspectMode === 'fit' ? 'contain' : 'cover'
                      }}
                    />
                  </div>
                )}
                {element.type === 'button' && (
                  <button 
                    className="w-full rounded text-[13px] px-3 font-bold"
                    style={{
                      backgroundColor: element.properties?.style === 'link' ? 'transparent' : (element.properties?.buttonColor || '#06c755'),
                      color: element.properties?.style === 'primary' ? '#ffffff' :
                             element.properties?.style === 'secondary' ? '#000000' :
                             (element.properties?.buttonColor || '#0f83ff'),
                      textDecoration: element.properties?.style === 'link' ? 'underline' : 'none',
                      border: 'none',
                      height: element.properties?.height === 'sm' ? '32px' :
                              element.properties?.height === 'md' ? '40px' :
                              element.properties?.height === 'lg' ? '48px' : '40px'
                    }}
                  >
                    {element.properties?.action?.label || 'ボタン'}
                  </button>
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
        <div className="flex flex-col items-center gap-3">
          {renderSingleBubble(content.contents[carouselIndex])}
          
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={handlePrev}
              className="flex-shrink-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <div className="bg-background/80 px-3 py-1 rounded text-xs font-medium">
              {carouselIndex + 1} / {totalBubbles}
            </div>
            
            <Button
              variant="outline"
              size="icon"
              onClick={handleNext}
              className="flex-shrink-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
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