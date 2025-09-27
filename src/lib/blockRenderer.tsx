import React from "react";
import { Lightbulb } from "lucide-react";
import type { Block } from "@/components/EnhancedBlockEditor";
import FormEmbedComponent from "@/components/FormEmbedComponent";

const sizeClasses: Record<string, string> = {
  small: "w-1/4",
  medium: "w-1/2",
  large: "w-3/4",
  full: "w-full",
};

const alignClasses: Record<string, string> = {
  left: "mx-0",
  center: "mx-auto",
  right: "ml-auto mr-0",
};

const buttonAlignment: Record<string, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

export const HeadingDesignStyles = (
  <style>{`
    .heading-style-1 {
      padding: 0.5em 0.7em;
      border-left: 5px solid var(--heading-color-1, #2589d0);
      background-color: var(--heading-color-2, #f2f2f2);
      color: var(--heading-color-3, #333333);
      margin: 1.5em 0;
    }

    .heading-style-2 {
      position: relative;
      border-top: 2px solid var(--heading-color-1, #80c8d1);
      border-bottom: 2px solid var(--heading-color-1, #80c8d1);
      background: var(--heading-color-2, #f4f4f4);
      line-height: 1.4;
      padding: 0.4em 0.5em;
      margin: 1.5em 0;
    }

    .heading-style-2::after {
      position: absolute;
      content: 'POINT';
      background: var(--heading-color-1, #80c8d1);
      color: var(--heading-color-3, #fff);
      left: 0;
      bottom: 100%;
      border-radius: 5px 5px 0 0;
      padding: 5px 7px 3px;
      font-size: 0.75em;
    }

    .heading-style-3 {
      position: relative;
      margin: 1.5em 0;
      padding: 0.7em 0.5em 0.7em 1.2em;
      background: var(--heading-color-2, #f2f2f2);
      color: var(--heading-color-3, #333333);
      border-left: 6px solid var(--heading-color-1, #2589d0);
    }

    .heading-style-3::before {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      width: 0;
      height: 0;
      border-top: 12px solid var(--heading-color-1, #2589d0);
      border-right: 12px solid transparent;
    }
  `}</style>
);

const convertYouTubeUrl = (url: string) => {
  const youtubeRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?#]+)/;
  const match = url.match(youtubeRegex);
  if (match) return `https://www.youtube.com/embed/${match[1]}`;
  return url;
};

export const renderBlock = (block: Block) => {
  const type = (block as any)?.type as string | undefined;
  const rawContent = (block as any)?.content;
  const content: Record<string, any> =
    rawContent && typeof rawContent === "object" ? (rawContent as Record<string, any>) : {};
  const legacyValue = typeof rawContent === "string" ? rawContent : undefined;

  if (!type) return null;

  const textStyle: React.CSSProperties =
    type === "paragraph" || type === "heading" || type === "note"
      ? {
          fontSize: content.fontSize,
          color: content.color,
          fontWeight: content.bold ? "bold" : "normal",
          fontStyle: content.italic ? "italic" : "normal",
          textDecoration: content.underline ? "underline" : "none",
          textAlign: content.alignment || "left",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }
      : {};

  switch (type) {
    case "background":
      return null;

    case "paragraph": {
      const text = content.text ?? legacyValue ?? "";
      return <p style={textStyle}>{text}</p>;
    }

    case "heading": {
      const text = content.text ?? content.title ?? legacyValue ?? "";
      const Tag = (`h${content.level || 1}` as unknown) as keyof JSX.IntrinsicElements;
      const headingStyle = {
        "--heading-color-1": content.color1,
        "--heading-color-2": content.color2,
        "--heading-color-3": content.color3,
        ...textStyle,
      } as React.CSSProperties;

      if (content.design_style === 3) {
        return (
          <div className="flex items-center my-6" style={{ color: content.color3 || "#333333" }}>
            <div className="relative mr-4 flex-shrink-0">
              <div
                className="flex items-center justify-center rounded-full w-[25px] h-[25px]"
                style={{ backgroundColor: content.color1 || "#ffca2c" }}
              >
                <Lightbulb size={15} color={content.color2 || "white"} />
              </div>
              <div
                className="absolute top-1/2 -translate-y-1/2 left-[20px] w-0 h-0 border-t-[7px] border-t-transparent border-b-[7px] border-b-transparent border-l-[12px]"
                style={{ borderLeftColor: content.color1 || "#ffca2c" }}
              ></div>
            </div>
            <Tag style={textStyle}>{text}</Tag>
          </div>
        );
      }

      return (
        <Tag className={`heading-style-${content.design_style || 1}`} style={headingStyle}>
          {text}
        </Tag>
      );
    }

    case "image": {
      const url = content.url || legacyValue;
      if (!url) return null;
      const sharedImageClasses = [
        content.rounded ? "rounded-lg" : "",
        content.hoverEffect ? "transition-opacity duration-300 hover:opacity-70" : "",
      ]
        .filter(Boolean)
        .join(" ");

      if (content.removeMargins) {
        const fullWidthImage = (
          <img src={url} alt={content.alt || ""} className={["w-full", sharedImageClasses].filter(Boolean).join(" ")} />
        );
        return (
          <div className="-mx-4">
            {content.linkUrl ? (
              <a href={content.linkUrl} target="_blank" rel="noopener noreferrer">
                {fullWidthImage}
              </a>
            ) : (
              fullWidthImage
            )}
          </div>
        );
      }

      const image = (
        <img
          src={url}
          alt={content.alt || ""}
          className={[
            sizeClasses[content.size] || "w-1/2",
            alignClasses[content.alignment] || "mx-auto",
            sharedImageClasses,
          ]
            .filter(Boolean)
            .join(" ")}
        />
      );

      return (
        <figure className="my-4">
          {content.linkUrl ? (
            <a href={content.linkUrl} target="_blank" rel="noopener noreferrer">
              {image}
            </a>
          ) : (
            image
          )}
          {content.caption && (
            <figcaption className="text-center text-sm text-gray-600 mt-2">{content.caption}</figcaption>
          )}
        </figure>
      );
    }

    case "video": {
      const url = content.url || legacyValue;
      if (!url) return null;
      return (
        <figure className={`my-4 mx-auto ${sizeClasses[content.size] || 'w-1/2'}`}>
          <div className="aspect-video w-full">
            <iframe
              src={convertYouTubeUrl(url)}
              className={`w-full h-full ${content.rounded ? "rounded-lg" : ""}`}
              style={{ border: content.borderEnabled !== false ? `3px solid ${content.borderColor || "#000000"}` : 'none' }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            ></iframe>
          </div>
          {content.caption && (
            <figcaption className="text-center text-sm text-gray-600 mt-2">{content.caption}</figcaption>
          )}
        </figure>
      );
    }

    case "list": {
      const items = Array.isArray(content.items)
        ? content.items
        : legacyValue
        ? [legacyValue]
        : [];
      const ListTag = (content.type === "numbered" ? "ol" : "ul") as "ol" | "ul";
      return (
        <ListTag className={content.type === "numbered" ? "list-decimal pl-6" : "list-disc pl-6"}>
          {items.map((item: any, index: number) => (
            <li key={index}>{String(item)}</li>
          ))}
        </ListTag>
      );
    }

    case "code":
      return (
        <pre className="bg-gray-900 text-white p-4 rounded-md my-4 overflow-x-auto">
          <code>{content.code ?? legacyValue ?? ""}</code>
        </pre>
      );

    case "form_embed": {
      const formId = content.formId || legacyValue;
      if (!formId) return null;
      return (
        <div className="my-4">
          <FormEmbedComponent formId={formId} />
        </div>
      );
    }

    case "separator":
      return <hr className="my-6" />;

    case "note": {
      const text = content.text ?? legacyValue ?? "";
      return (
        <div className="note-box" style={textStyle}>
          <p>{text}</p>
        </div>
      );
    }

    case "dialogue": {
      const items = Array.isArray(content.items) ? content.items : [];
      if (items.length === 0) return null;
      return (
        <div className="space-y-4 my-4">
          {items.map((item: any, index: number) => (
            <div
              key={index}
              className={`flex items-start gap-3 ${item.alignment === "right" ? "flex-row-reverse" : ""}`}
            >
              {(item.avatar || (item.alignment === "left" ? content.leftIcon : content.rightIcon)) && (
                <img
                  src={item.avatar || (item.alignment === "left" ? content.leftIcon : content.rightIcon)}
                  alt="icon"
                  className="w-12 h-12 rounded-full object-cover"
                />
              )}
              <div className="flex-1">
                <p
                  className={`text-xs mb-1 ${item.alignment === "right" ? "text-right" : ""}`}
                  style={{ color: "rgb(69, 69, 69)" }}
                >
                  {item.alignment === "left" ? content.leftName : content.rightName}
                </p>
                <div
                  className={`relative inline-block p-3 rounded-lg w-64 ${
                    item.alignment === "right" ? "float-right" : ""
                  }`}
                  style={{ backgroundColor: content.bubbleBackgroundColor || "#f2f2f2" }}
                >
                  <p className="text-sm whitespace-pre-wrap break-words">{item.text}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    }

    case "button": {
      const buttonStyle: React.CSSProperties = {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 1.5rem",
        textDecoration: "none",
        fontWeight: 600,
        color: content.textColor || "#ffffff",
        backgroundColor: content.backgroundColor || "#2563eb",
        borderRadius: `${content.borderRadius ?? 6}px`,
        fontSize: `${content.textSize || 16}px`,
        height: `${content.height || 40}px`,
        transition: "opacity 0.2s",
      };

      if (content.shadow) {
        buttonStyle.boxShadow = "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)";
      }

      if (content.width === "full") {
        buttonStyle.width = "100%";
      } else if (content.width === "medium") {
        buttonStyle.width = "50%";
      }

      if (content.borderEnabled) {
        buttonStyle.border = `${content.borderWidth || 1}px solid ${content.borderColor || "#000000"}`;
      }

      const alignment = buttonAlignment[content.alignment] || "text-center";
      const textValue = content.text ?? legacyValue ?? "";

      return (
        <div className={`my-4 ${alignment}`}>
          <a
            href={content.url || "#"}
            target="_blank"
            rel="noopener noreferrer"
            style={buttonStyle}
            onMouseOver={(e) => (e.currentTarget.style.opacity = "0.8")}
            onMouseOut={(e) => (e.currentTarget.style.opacity = "1")}
          >
            {textValue}
          </a>
        </div>
      );
    }

    default:
      return null;
  }
};

export const renderBlocks = (blocks: Block[]) =>
  blocks.map((block) => {
    const key = block.id || `${block.type}-${Math.random().toString(36).slice(2)}`;
    return (
      <div key={key} className="not-prose">
        {renderBlock(block)}
      </div>
    );
  });
