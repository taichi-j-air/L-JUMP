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
  const [error, setError] = useState<string | null>(null)
  const [carouselIndex, setCarouselIndex] = useState(0)

  useEffect(() => {
    const fetchFlexMessage = async () => {
      setLoading(true)
      setError(null)
      
      try {
        const { data, error } = await supabase
          .from('flex_messages')
          .select('id, name, content')
          .eq('id', flexMessageId)
          .maybeSingle()

        if (error) {
          console.error('Error fetching flex message:', error)
          setError('Flexメッセージの読み込みに失敗しました')
          return
        }

        if (!data) {
          console.warn('Flex message not found:', flexMessageId)
          setError('Flexメッセージが見つかりません')
          return
        }

        let parsedContent = data.content
        if (typeof data.content === 'string') {
          try {
            parsedContent = JSON.parse(data.content)
          } catch (e) {
            console.error('Failed to parse flex message content:', e)
            setError('Flexメッセージの形式が不正です')
            return
          }
        }

        setFlexMessage({ ...data, content: parsedContent })
      } catch (err) {
        console.error('Unexpected error:', err)
        setError('予期しないエラーが発生しました')
      } finally {
        setLoading(false)
      }
    }

    fetchFlexMessage()

    const channel = supabase
      .channel(`flex_message:${flexMessageId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'flex_messages',
          filter: `id=eq.${flexMessageId}`,
        },
        (payload) => {
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            const newData = payload.new as FlexMessage
            let parsedContent = newData.content
            if (typeof newData.content === 'string') {
              try {
                parsedContent = JSON.parse(newData.content)
              } catch (e) {
                console.error('Failed to parse updated content:', e)
                return
              }
            }
            setFlexMessage({ ...newData, content: parsedContent })
          }
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [flexMessageId])

  if (loading) {
    return (
      <div className="flex items-center justify-center p-3">
        <p className="text-xs text-muted-foreground">読み込み中...</p>
      </div>
    )
  }

  if (error || !flexMessage) {
    return (
      <div className="flex items-center justify-center p-3">
        <p className="text-xs text-destructive">{error || 'メッセージが見つかりません'}</p>
      </div>
    )
  }

  // デザイントークンをピクセルに変換
  const getMarginPx = (margin?: string): number => {
    if (!margin) return 0
    const map: Record<string, number> = { 
      none: 0, xs: 2, sm: 4, md: 8, lg: 12, xl: 16, xxl: 20 
    }
    return map[margin] || 0
  }

  const getPaddingPx = (pad?: string): number => {
    if (!pad) return 0
    const map: Record<string, number> = { 
      none: 0, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 
    }
    return map[pad] || 0
  }

  const getBubbleWidth = (size?: string): string => {
    const sizeMap: Record<string, string> = {
      nano: '200px',
      micro: '260px',
      kilo: '300px',
      mega: '340px',
      giga: '360px'
    }
    return sizeMap[size || 'mega'] || '300px'
  }

  // 要素を再帰的にレンダリング
  const renderElement = (element: any, index: number, isFirst: boolean = false): React.ReactNode => {
    if (!element) return null

    const marginTop = isFirst ? 0 : getMarginPx(element.margin)

    // Box要素 - 中身のcontentsを展開
    if (element.type === 'box') {
      const layout = element.layout || 'vertical'
      const spacing = element.spacing || 'none'
      const paddingAll = getPaddingPx(element.paddingAll)
      const bgColor = element.backgroundColor

      return (
        <div
          key={index}
          className={layout === 'horizontal' ? 'flex gap-2' : 'space-y-1'}
          style={{
            marginTop,
            padding: paddingAll || undefined,
            backgroundColor: bgColor || undefined,
            gap: layout === 'horizontal' ? `${getMarginPx(spacing)}px` : undefined
          }}
        >
          {element.contents?.map((child: any, i: number) => 
            renderElement(child, i, i === 0)
          )}
        </div>
      )
    }

    // Text要素
    if (element.type === 'text') {
      const text = element.text || ''
      const size = element.size || 'md'
      const weight = element.weight || 'regular'
      const color = element.color || '#000000'
      const align = element.align || 'start'
      const wrap = element.wrap !== false

      const sizeMap: Record<string, string> = {
        xxs: '10px', xs: '12px', sm: '14px', md: '16px',
        lg: '18px', xl: '20px', xxl: '22px', '3xl': '26px', '4xl': '30px', '5xl': '34px'
      }

      return (
        <div
          key={index}
          className={wrap ? 'break-words' : 'truncate'}
          style={{
            fontSize: sizeMap[size] || '16px',
            fontWeight: weight === 'bold' ? 700 : 400,
            color,
            textAlign: align as any,
            marginTop
          }}
        >
          {text}
        </div>
      )
    }

    // Image要素
    if (element.type === 'image') {
      const url = element.url || ''
      const size = element.size || 'full'
      const aspectRatio = element.aspectRatio || '1:1'

      return (
        <div
          key={index}
          style={{
            marginTop,
            width: size === 'full' ? '100%' : size
          }}
        >
          <img
            src={url}
            alt={element.altText || ''}
            className="w-full h-auto rounded"
            style={{
              aspectRatio: aspectRatio.replace(':', '/')
            }}
          />
        </div>
      )
    }

    // Button要素
    if (element.type === 'button') {
      const action = element.action || {}
      const style = element.style || 'primary'
      const height = element.height || 'md'
      const color = element.color

      const heightMap: Record<string, string> = {
        sm: '32px',
        md: '40px',
        lg: '48px'
      }

      let buttonStyle: React.CSSProperties = {
        marginTop,
        height: heightMap[height] || '40px',
        borderRadius: '4px',
        fontSize: '14px',
        fontWeight: 500,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 16px'
      }

      if (style === 'link') {
        buttonStyle.backgroundColor = 'transparent'
        buttonStyle.color = color || '#0084ff'
        buttonStyle.border = 'none'
      } else if (style === 'primary') {
        buttonStyle.backgroundColor = color || '#0084ff'
        buttonStyle.color = '#ffffff'
        buttonStyle.border = 'none'
      } else if (style === 'secondary') {
        buttonStyle.backgroundColor = '#f0f0f0'
        buttonStyle.color = color || '#000000'
        buttonStyle.border = 'none'
      }

      return (
        <div key={index} style={buttonStyle}>
          {action.label || 'Button'}
        </div>
      )
    }

    // Separator要素
    if (element.type === 'separator') {
      const color = element.color || '#e0e0e0'
      return (
        <div
          key={index}
          style={{
            marginTop,
            height: '1px',
            backgroundColor: color
          }}
        />
      )
    }

    return null
  }

  const renderSingleBubble = (bubble: any) => {
    if (!bubble || bubble.type !== 'bubble') {
      return (
        <div className="bg-background rounded-lg border p-3 text-xs text-muted-foreground">
          バブル形式が不正です
        </div>
      )
    }

    const bubbleSize = bubble.size || 'mega'
    const heroImage = bubble.hero
    const bodyContent = bubble.body
    const footerContent = bubble.footer
    const bgColor = bubble.styles?.body?.backgroundColor

    const hasBody = bodyContent && bodyContent.contents && bodyContent.contents.length > 0
    const hasFooter = footerContent && footerContent.contents && footerContent.contents.length > 0

    if (!hasBody && !hasFooter && !heroImage) {
      return (
        <div className="bg-background rounded-lg border p-3 text-xs text-muted-foreground">
          表示する内容がありません
        </div>
      )
    }

    return (
      <div
        className="rounded-2xl overflow-hidden shadow-md bg-background border"
        style={{
          width: getBubbleWidth(bubbleSize),
          backgroundColor: bgColor || '#ffffff'
        }}
      >
        {/* Hero Image */}
        {heroImage && heroImage.type === 'image' && heroImage.url && (
          <div className="w-full">
            <img
              src={heroImage.url}
              alt={heroImage.altText || 'Hero'}
              className="w-full h-auto object-cover"
              style={{
                aspectRatio: heroImage.aspectRatio === '20:13' ? '20/13' :
                            heroImage.aspectRatio === '1:1' ? '1/1' : '1.51/1'
              }}
            />
          </div>
        )}

        {/* Body */}
        {hasBody && (
          <div
            style={{
              padding: `${getPaddingPx(bodyContent.paddingAll || 'md')}px`
            }}
          >
            {bodyContent.contents.map((item: any, idx: number) =>
              renderElement(item, idx, idx === 0)
            )}
          </div>
        )}

        {/* Footer */}
        {hasFooter && (
          <div
            style={{
              padding: `${getPaddingPx(footerContent.paddingAll || 'md')}px`,
              backgroundColor: footerContent.backgroundColor || undefined
            }}
          >
            {footerContent.contents.map((item: any, idx: number) =>
              renderElement(item, idx, idx === 0)
            )}
          </div>
        )}
      </div>
    )
  }

  const renderFlexPreview = () => {
    const content = flexMessage.content?.contents || flexMessage.content
    const isCarousel = content?.type === "carousel"

    if (isCarousel && content?.contents && Array.isArray(content.contents)) {
      const totalBubbles = content.contents.length
      
      const handlePrev = () => {
        setCarouselIndex((prev) => (prev > 0 ? prev - 1 : totalBubbles - 1))
      }

      const handleNext = () => {
        setCarouselIndex((prev) => (prev < totalBubbles - 1 ? prev + 1 : 0))
      }

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
      )
    }

    return renderSingleBubble(content)
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
