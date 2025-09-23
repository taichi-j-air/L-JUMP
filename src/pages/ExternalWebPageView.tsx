import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DOMPurify from "dompurify";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TimerPreview } from "@/components/TimerPreview";
import { Block } from "@/components/EnhancedBlockEditor";
import FormEmbedComponent from "@/components/FormEmbedComponent";
import { Lightbulb } from "lucide-react";

interface PagePayload {
  title: string;
  tag_label?: string | null;
  content?: string | null;
  content_blocks?: Block[];
  timer_enabled?: boolean;
  timer_mode?: "absolute" | "per_access" | "step_delivery";
  timer_deadline?: string | null;
  timer_duration_seconds?: number | null;
  show_milliseconds?: boolean;
  timer_style?: "solid" | "glass" | "outline" | "minimal";
  timer_bg_color?: string;
  timer_text_color?: string;
  internal_timer?: boolean;
  timer_text?: string | null;
  timer_day_label?: string | null;
  timer_hour_label?: string | null;
  timer_minute_label?: string | null;
  timer_second_label?: string | null;
  timer_scenario_id?: string | null;
  timer_step_id?: string | null;
  expire_action?: "hide_page" | "hide" | "keep_public";
  show_remaining_text?: boolean;
  show_end_date?: boolean;
}



const isHideAction = (action?: string | null) => action === "hide" || action === "hide_page";

type KnownErrors =
  | "not_found"
  | "access_denied"
  | "timer_expired"
  | "not_published"
  | "tag_blocked"
  | "tag_required";

// Block renderer function
const renderBlock = (block: Block) => {
  const { type, content } = block;

  const textStyle = (block.type === 'paragraph' || block.type === 'heading' || block.type === 'note') ? {
    fontSize: content.fontSize,
    color: content.color,
    fontWeight: content.bold ? 'bold' : 'normal',
    fontStyle: content.italic ? 'italic' : 'normal',
    textDecoration: content.underline ? 'underline' : 'none',
    textAlign: content.alignment || 'left',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  } as React.CSSProperties : {};

  switch (type) {
    case 'background':
      return null;

    case 'paragraph':
      return <p style={textStyle}>{content.text}</p>;

    case 'heading': {
      const Tag = `h${content.level || 1}` as keyof JSX.IntrinsicElements;
      const headingStyle = {
        '--heading-color-1': content.color1,
        '--heading-color-2': content.color2,
        '--heading-color-3': content.color3,
        ...textStyle
      } as React.CSSProperties;

      if (content.design_style === 3) {
        return (
          <div className="flex items-center my-6" style={{ color: content.color3 || '#333333' }}>
            <div className="relative mr-4 flex-shrink-0">
              <div 
                className="flex items-center justify-center rounded-full w-[25px] h-[25px]"
                style={{ backgroundColor: content.color1 || '#ffca2c' }}
              >
                <Lightbulb size={15} color={content.color2 || 'white'} />
              </div>
              <div 
                className="absolute top-1/2 -translate-y-1/2 left-[20px] w-0 h-0 border-t-[7px] border-t-transparent border-b-[7px] border-b-transparent border-l-[12px]"
                style={{ borderLeftColor: content.color1 || '#ffca2c' }}
              ></div>
            </div>
            <Tag style={textStyle}>{content.text}</Tag>
          </div>
        );
      }

      return (
        <Tag
          className={`heading-style-${content.design_style || 1}`}
          style={headingStyle}
        >
          {content.text}
        </Tag>
      );
    }

    case 'image': {
      const sharedImageClasses = [
        content.rounded ? 'rounded-lg' : '',
        content.hoverEffect ? 'transition-opacity duration-300 hover:opacity-70' : ''
      ].filter(Boolean).join(' ');
      if (content.removeMargins) {
        const fullWidthImage = (
          <img
            src={content.url}
            alt={content.alt}
            className={['w-full', sharedImageClasses].filter(Boolean).join(' ')}
          />
        );
        return (
          <div className="-mx-4">
            {content.linkUrl ? <a href={content.linkUrl} target="_blank" rel="noopener noreferrer">{fullWidthImage}</a> : fullWidthImage}
          </div>
        );
      }

      const sizeClasses: { [key: string]: string } = {
        small: 'w-1/4',
        medium: 'w-1/2',
        large: 'w-3/4',
        full: 'w-full'
      };
      const alignClasses: { [key: string]: string } = {
        left: 'mx-0',
        center: 'mx-auto',
        right: 'ml-auto mr-0'
      }
      const image = (
        <img
          src={content.url}
          alt={content.alt}
          className={[sizeClasses[content.size] || 'w-1/2', alignClasses[content.alignment] || 'mx-auto', sharedImageClasses].filter(Boolean).join(' ')}
        />
      );
      return (
        <figure className="my-4">
          {content.linkUrl ? <a href={content.linkUrl} target="_blank" rel="noopener noreferrer">{image}</a> : image}
          {content.caption && <figcaption className="text-center text-sm text-gray-600 mt-2">{content.caption}</figcaption>}
        </figure>
      );
    }

    case 'video':
        const convertYouTubeUrl = (url: string) => {
          const youtubeRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?#]+)/;
          const match = url.match(youtubeRegex);
          if (match) return `https://www.youtube.com/embed/${match[1]}`;
          return url;
        };
      return (
        <figure className="my-4 aspect-video">
          <iframe
            src={convertYouTubeUrl(content.url)}
            className={`w-full h-full ${content.rounded ? 'rounded-lg' : ''}`}
            style={{ border: `3px solid ${content.borderColor || '#000000'}` }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          ></iframe>
          {content.caption && <figcaption className="text-center text-sm text-gray-600 mt-2">{content.caption}</figcaption>}
        </figure>
      );

    case 'list':
      const ListTag = content.type === 'numbered' ? 'ol' : 'ul';
      return (
        <ListTag className={content.type === 'numbered' ? 'list-decimal pl-6' : 'list-disc pl-6'}>
          {content.items.map((item: string, index: number) => <li key={index}>{item}</li>)}
        </ListTag>
      );

    case 'code':
      return (
        <pre className="bg-gray-900 text-white p-4 rounded-md my-4 overflow-x-auto">
          <code>{content.code}</code>
        </pre>
      );

    case 'form_embed':
      return (
        <div className="my-4">
          <FormEmbedComponent formId={content.formId} />
        </div>
      );

    case 'separator':
      return <hr className="my-6" />;

    case 'note':
      return (
        <div className="note-box" style={textStyle}>
          <p>{content.text}</p>
        </div>
      );

    case 'dialogue':
      return (
        <div className="space-y-4 my-4">
          {content.items.map((item: any, index: number) => (
            <div key={index} className={`flex items-start gap-3 ${item.alignment === 'right' ? 'flex-row-reverse' : ''}`}>
              <img src={item.alignment === 'left' ? content.leftIcon : content.rightIcon} alt="icon" className="w-12 h-12 rounded-full object-cover" />
              <div className="flex-1">
                <p
                  className={`text-xs mb-1 ${item.alignment === 'right' ? 'text-right' : ''}`}
                  style={{ color: 'rgb(69, 69, 69)' }}
                >
                  {item.alignment === 'left' ? content.leftName : content.rightName}
                </p>
                <div 
                  className={`relative inline-block p-3 rounded-lg w-64 ${item.alignment === 'right' ? 'float-right' : ''}`}
                  style={{ backgroundColor: content.bubbleBackgroundColor || '#f2f2f2' }}
                >
                  <p className="text-sm whitespace-pre-wrap break-words">{item.text}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      );

    case 'button': {
      const buttonStyle: React.CSSProperties = {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 1.5rem',
        textDecoration: 'none',
        fontWeight: 600,
        color: content.textColor || '#ffffff',
        backgroundColor: content.backgroundColor || '#2563eb',
        borderRadius: `${content.borderRadius ?? 6}px`,
        fontSize: `${content.textSize || 16}px`,
        height: `${content.height || 40}px`,
        transition: 'opacity 0.2s',
      };

      if (content.shadow) {
        buttonStyle.boxShadow = '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)';
      }
      
      if (content.width === 'full') {
        buttonStyle.width = '100%';
      } else if (content.width === 'medium') {
        buttonStyle.width = '50%';
      }

      if (content.borderEnabled) {
        buttonStyle.border = `${content.borderWidth || 1}px solid ${content.borderColor || '#000000'}`;
      }

      const alignClasses: { [key: string]: string } = {
        left: 'text-left',
        center: 'text-center',
        right: 'text-right',
      };

      return (
        <div className={`my-4 ${alignClasses[content.alignment] || 'text-center'}`}>
          <a
            href={content.url || '#'}
            target="_blank"
            rel="noopener noreferrer"
            style={buttonStyle}
            onMouseOver={(e) => e.currentTarget.style.opacity = '0.8'}
            onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
          >
            {content.text}
          </a>
        </div>
      );
    }

    default:
      return null;
  }
};

const HeadingDesignStyles = (
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
      font-size: 0.7em;
      line-height: 1;
      letter-spacing: 0.05em;
    }

    .heading-style-3 {
      position: relative;
      padding-left: 35px;
      margin: 1.5em 0;
    }

    .heading-style-3::before {
      position: absolute;
      content: '💡';
      background: var(--heading-color-1, #ffca2c);
      color: var(--heading-color-2, #fff);
      font-weight: 900;
      font-size: 15px;
      border-radius: 50%;
      left: 0;
      width: 25px;
      height: 25px;
      line-height: 25px;
      text-align: center;
      top: 50%;
      transform: translateY(-50%);
    }

    .heading-style-3::after {
      content: '';
      display: block;
      position: absolute;
      left: 20px;
      height: 0;
      width: 0;
      border-top: 7px solid transparent;
      border-bottom: 7px solid transparent;
      border-left: 12px solid var(--heading-color-1, #ffca2c);
      top: 50%;
      transform: translateY(-50%);
    }

    .heading-style-4 {
      position: relative;
      padding: 0.25em 0.5em 0.25em 1.2em;
      color: var(--heading-color-1, #494949);
      background: transparent;
      margin: 1.5em 0;
    }

    .heading-style-4::before {
      content: '';
      position: absolute;
      left: 0.25em;
      top: 0;
      bottom: 0;
      width: 5px;
      background-color: var(--heading-color-2, #7db4e6);
      border-radius: 9999px;
    }
  `}</style>
);

export default function ExternalWebPageView() {
  const params = useParams();

  const shareCode = params.shareCode;
  const pageId = params.pageId;

  const [data, setData] = useState<PagePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<KnownErrors | null>(null);
  const [passcode, setPasscode] = useState("");
  const [requirePass, setRequirePass] = useState(false);

  const isPreview = window.location.pathname.includes("/preview/") && !!pageId;

  const sanitizeHtml = (raw: string) => {
    const clean = DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } });
    return clean.replace(/<a\s+([^>]*href=[\'"][^\'"]+[\'"][^>]*>/gi, (m, attrs) => {
      if (!/rel=/.test(attrs)) {
        return `<a ${attrs} rel="noopener noreferrer">`;
      }
      return m;
    });
  };

  useEffect(() => {
    document.title = data?.title ? `${data.title} | ページ` : "ページ";
    const meta = document.querySelector('meta[name="description"]');
    if (meta && data?.tag_label) meta.setAttribute("content", data.tag_label);
    const link = document.querySelector(
      'link[rel="canonical"]'
    ) as HTMLLinkElement | null;
    if (link) link.href = window.location.href;
  }, [data?.title, data?.tag_label]);

  const parseFnError = (fnErr: any) => {
    let status: number | undefined = fnErr?.context?.status ?? fnErr?.status;
    let code: string | undefined = fnErr?.context?.body?.error ?? fnErr?.code;
    let message: string | undefined = fnErr?.context?.body?.message || fnErr?.message;

    if (!status && typeof fnErr?.message === "string") {
      const m = fnErr.message.toLowerCase();
      if (m.includes("401") || m.includes("unauthorized")) status = 401;
      else if (m.includes("423") || m.includes("locked")) status = 423;
      else if (m.includes("404") || m.includes("not found")) {
        status = 404;
      }
    }
    return { status: status ?? 0, code, message };
  };

  const fetchData = async (withPasscode?: string) => {
    setLoading(true);
    setError(null);
    setRequirePass(false);

    try {
      if (isPreview) {
        const { data: page, error: pageError } = await supabase
          .from("cms_pages")
          .select("*")
          .eq("id", pageId)
          .maybeSingle();

        if (pageError || !page) {
          setError("not_found");
          setLoading(false);
          return;
        }

        if (!page.is_published) {
          setError("not_published");
          setLoading(false);
          return;
        }

        if (page.require_passcode && page.passcode) {
          const urlParams = new URLSearchParams(window.location.search);
          const urlPasscode = urlParams.get("passcode");
          const provided = withPasscode || urlPasscode || "";
          if (!provided || provided !== page.passcode) {
            setRequirePass(true);
            setLoading(false);
            return;
          }
        }

        setData({
          ...page,
          content_blocks: Array.isArray(page.content_blocks) 
            ? page.content_blocks 
            : (typeof page.content_blocks === 'string' 
                ? JSON.parse(page.content_blocks) 
                : []
              )
        } as PagePayload);
        setLoading(false);
        return;
      }

      if (!shareCode) {
        setError("not_found");
        setLoading(false);
        return;
      }

      console.log(`🔍 Calling cms-page-view with shareCode: ${shareCode}`);
      
      const { data: res, error: fnErr } = await supabase.functions.invoke(
        "cms-page-view",
        { body: { shareCode, passcode: withPasscode } }
      );

      if (fnErr) {
        const { status } = parseFnError(fnErr);
        if (status === 401) { setRequirePass(true); setLoading(false); return; }
        if (status === 423) { setError("not_published"); setLoading(false); return; }
        if (status === 404) { setError("not_found"); setLoading(false); return; }
        if (status === 410) { setError("timer_expired"); setLoading(false); return; }
        setError("not_found"); setLoading(false); return;
      }

      if (!res) { setError("not_found"); setLoading(false); return; }
      if ((res as any).error) {
        const code = (res as any).error as KnownErrors | string;
        if (code === "passcode_required") { setRequirePass(true); setLoading(false); return; }
        if (
          code === "not_published" || code === "not_found" || code === "timer_expired"
        ) { setError(code as KnownErrors); setLoading(false); return; }
        setError("not_found"); setLoading(false); return;
      }

      setData(res as PagePayload);
      setLoading(false);
    } catch {
      setError("not_found");
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareCode, pageId]);

  if (loading) return <div className="container mx-auto p-6">読み込み中…</div>;

  if (error === "not_published") {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="w-full max-w-md p-6 rounded-lg" style={{ backgroundColor: "#999999" }}>
            <div className="text-center space-y-4">
              <h3 className="text-2xl font-semibold text-white">非公開ページ</h3>
              <p className="text-white">このページは現在非公開に設定されています。</p>
            </div>
          </div>
        </div>
        <div className="py-2 text-center" style={{ backgroundColor: "rgb(12, 179, 134)" }}>
          <div className="flex flex-col items-center justify-center">
            <span className="font-bold text-lg text-white">L-JUMP</span>
            <span className="text-xs text-white opacity-90">LINE公式アカウント拡張ツール</span>
          </div>
        </div>
      </div>
    );
  }



  if (!data) return null;

  const sortedBlocks = Array.isArray(data.content_blocks)
    ? [...data.content_blocks].sort((a, b) => a.order - b.order)
    : [];
  const backgroundBlock = sortedBlocks.find((block) => block.type === 'background');
  const filteredBlocks = sortedBlocks.filter((block) => block.type !== 'background');
  const resolveBackgroundColor = (value?: string | null) => {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const normalized = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
    return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(normalized) ? normalized : undefined;
  };
  const pageBackgroundColor = resolveBackgroundColor((backgroundBlock?.content as any)?.color);

  return (
    <div className="min-h-screen bg-gray-100 flex justify-center">
      {HeadingDesignStyles}
      <div className="w-full max-w-3xl bg-white border-x border-gray-200 flex flex-col" style={pageBackgroundColor ? { backgroundColor: pageBackgroundColor } : undefined}>
        {data.timer_enabled && (
          <TimerPreview
            mode={data.timer_mode || "absolute"}
            deadline={data.timer_mode === "absolute" ? data.timer_deadline || undefined : undefined}
            durationSeconds={
              data.timer_mode === "per_access" || data.timer_mode === "step_delivery"
                ? data.timer_duration_seconds || undefined
                : undefined
            }
            showMilliseconds={!!data.show_milliseconds}
            styleVariant={data.timer_style || "solid"}
            bgColor={data.timer_bg_color || "#0cb386"}
            textColor={data.timer_text_color || "#ffffff"}
            shareCode={shareCode}
            dayLabel={data.timer_day_label || "日"}
            hourLabel={data.timer_hour_label || "時間"}
            minuteLabel={data.timer_minute_label || "分"}
            secondLabel={data.timer_second_label || "秒"}
            internalTimer={!!data.internal_timer}
            timerText={data.timer_text || "期間限定公開"}
            showEndDate={data.show_end_date ?? true}
            showRemainingText={data.show_remaining_text ?? true}
            scenarioId={data.timer_scenario_id || undefined}
            stepId={data.timer_step_id || undefined}
            onExpire={
              isHideAction(data.expire_action)
                ? () => {
                    setError("timer_expired");
                    setData(null);
                  }
                : undefined
            }
          />
        )}

        <article className="prose max-w-none dark:prose-invert flex-1 p-4 ql-content">
          {filteredBlocks.length > 0 ? (
            filteredBlocks.map((block) => (
              <div key={block.id} className="not-prose">{renderBlock(block)}</div>
            ))
          ) : (
            <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(data.content || "") }} />
          )}
        </article>
      </div>
    </div>
  );
}
