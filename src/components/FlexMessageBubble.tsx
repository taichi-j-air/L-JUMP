import React from "react"

interface FlexMessageBubbleProps {
  payload?: any
  altText?: string | null
}

const renderElement = (element: any, key: string): React.ReactNode => {
  if (!element) return null

  switch (element.type) {
    case "text": {
      const sizeMap: Record<string, string> = {
        xxs: "text-[10px]",
        xs: "text-[11px]",
        sm: "text-xs",
        md: "text-sm",
        lg: "text-base",
        xl: "text-lg",
        xxl: "text-xl",
        "3xl": "text-2xl",
        "4xl": "text-3xl",
        "5xl": "text-4xl"
      }
      const sizeClass = sizeMap[element.size as string] || "text-sm"
      const weightClass = element.weight === "bold" ? "font-semibold" : ""
      const alignClass =
        element.align === "center"
          ? "text-center"
          : element.align === "end"
            ? "text-right"
            : "text-left"
      const colorStyle = element.color ? { color: element.color } : undefined

      return (
        <p
          key={key}
          className={`${sizeClass} ${weightClass} ${alignClass} leading-relaxed`}
          style={colorStyle}
        >
          {element.text}
        </p>
      )
    }
    case "button": {
      const label =
        element.action?.label ||
        element.action?.text ||
        element.action?.data ||
        element.text ||
        "ボタン"
      return (
        <div
          key={key}
          className="text-xs rounded-md border border-dashed border-border px-3 py-1 inline-flex items-center gap-2"
        >
          <span className="text-muted-foreground">🔘</span>
          <span>{label}</span>
        </div>
      )
    }
    case "image": {
      const url = element.url || element.src || element.previewUrl
      if (!url) return null
      return (
        <div key={key} className="overflow-hidden rounded-md border bg-muted/20">
          <img src={url} alt="" className="w-full object-cover" />
        </div>
      )
    }
    case "box": {
      const layout = element.layout || "vertical"
      const className =
        layout === "horizontal"
          ? "flex flex-wrap items-start gap-2"
          : "space-y-2"

      return (
        <div key={key} className={className}>
          {Array.isArray(element.contents)
            ? element.contents.map((child: any, index: number) =>
                renderElement(child, `${key}-${index}`)
              )
            : null}
        </div>
      )
    }
    case "separator":
      return <div key={key} className="h-px bg-border/60" />
    case "spacer":
      return <div key={key} style={{ height: element.size === "lg" ? 32 : 16 }} />
    case "icon":
      return (
        <div key={key} className="text-lg">
          {element.url ? <img src={element.url} alt="" className="w-6 h-6" /> : "🔆"}
        </div>
      )
    default:
      return (
        <div key={key} className="text-[11px] text-muted-foreground">
          [{element.type || "要素"}]
        </div>
      )
  }
}

export function FlexMessageBubble({ payload, altText }: FlexMessageBubbleProps) {
  if (payload == null) {
    return (
      <div className="rounded-md border bg-background/60 p-3 text-xs text-muted-foreground">
        Flexメッセージの内容を表示できませんでした。
      </div>
    )
  }

  let resolvedPayload: any = payload
  if (typeof resolvedPayload === "string") {
    try {
      resolvedPayload = JSON.parse(resolvedPayload)
    } catch (err) {
      console.warn("Failed to parse Flex payload string:", err)
      resolvedPayload = null
    }
  }

  if (!resolvedPayload || typeof resolvedPayload !== "object") {
    return (
      <div className="rounded-md border bg-background/60 p-3 text-xs text-muted-foreground">
        Flexメッセージをプレビューできませんでした。
      </div>
    )
  }

  const normalized =
    resolvedPayload.type === "flex"
      ? resolvedPayload
      : {
          type: "flex",
          altText: altText || "Flexメッセージ",
          contents: resolvedPayload
        }

  const contents = normalized.contents
  const bubbles =
    contents?.type === "carousel"
      ? Array.isArray(contents.contents)
        ? contents.contents
        : []
      : contents
        ? [contents]
        : []

  return (
    <div className="space-y-3">
      {altText ? (
        <p className="text-[11px] text-muted-foreground leading-snug">通知文: {altText}</p>
      ) : null}

      {bubbles.length === 0 ? (
        <div className="rounded-md border bg-background/60 p-3 text-xs text-muted-foreground">
          表示できるコンテンツがありません。
        </div>
      ) : (
        bubbles.map((bubble: any, idx: number) => (
          <div
            key={`bubble-${idx}`}
            className="rounded-lg border bg-background p-3 space-y-3 shadow-sm"
            style={{ backgroundColor: bubble.body?.backgroundColor || undefined }}
          >
            {bubble.hero ? renderElement(bubble.hero, `hero-${idx}`) : null}
            {bubble.body?.contents
              ? bubble.body.contents.map((element: any, i: number) =>
                  renderElement(element, `body-${idx}-${i}`)
                )
              : null}
            {bubble.footer?.contents && bubble.footer.contents.length > 0 ? (
              <div className="border-t border-border/60 pt-2 space-y-2">
                {bubble.footer.contents.map((element: any, i: number) =>
                  renderElement(element, `footer-${idx}-${i}`)
                )}
              </div>
            ) : null}
          </div>
        ))
      )}
    </div>
  )
}
