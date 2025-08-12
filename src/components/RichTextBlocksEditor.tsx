import { useState } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { RichTextEditor } from "./RichTextEditor";

interface RichTextBlocksEditorProps {
  value: string[];
  onChange: (blocks: string[]) => void;
}

export default function RichTextBlocksEditor({ value, onChange }: RichTextBlocksEditorProps) {
  const [openItem, setOpenItem] = useState<string | undefined>(value.length ? `b-${0}` : undefined);

  const parse = (html: string): { title: string; body: string } => {
    const m = html.match(/^<!--\s*title:(.*?)\s*-->\s*/i);
    if (m) {
      return { title: m[1].trim(), body: html.replace(m[0], "") };
    }
    return { title: "", body: html };
  };
  const build = (title: string, body: string) => {
    return title ? `<!--title:${title}-->` + body : body;
  };

  const addBlock = () => {
    const next = [...value, ""];
    onChange(next);
    setOpenItem(`b-${next.length - 1}`);
  };

  const removeBlock = (idx: number) => {
    const next = value.filter((_, i) => i !== idx);
    onChange(next);
    if (openItem === `b-${idx}`) setOpenItem(undefined);
  };

  const moveBlock = (from: number, to: number) => {
    if (to < 0 || to >= value.length) return;
    const next = [...value];
    const [spliced] = next.splice(from, 1);
    next.splice(to, 0, spliced);
    onChange(next);
    setOpenItem(`b-${to}`);
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">コンテンツを複数追加できます（折り畳み式）</div>
        <Button size="sm" onClick={addBlock}>＋ 追加</Button>
      </div>
      <Separator />
      {value.length === 0 ? (
        <div className="text-sm text-muted-foreground">まだコンテンツがありません。「追加」から作成してください。</div>
      ) : (
        <Accordion type="single" collapsible value={openItem} onValueChange={setOpenItem} className="w-full">
          {value.map((raw, idx) => {
            const { title, body } = parse(raw);
            const header = title || `コンテンツ ${idx + 1}`;
            return (
              <AccordionItem key={idx} value={`b-${idx}`}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex-1 text-left truncate">{header}</div>
                  <div className="flex items-center gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={(e) => { e.preventDefault(); e.stopPropagation(); moveBlock(idx, idx - 1); }}>↑</Button>
                    <Button type="button" size="sm" variant="outline" onClick={(e) => { e.preventDefault(); e.stopPropagation(); moveBlock(idx, idx + 1); }}>↓</Button>
                    <Button type="button" size="sm" variant="destructive" onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeBlock(idx); }}>削除</Button>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2">
                    <Input
                      value={title}
                      placeholder={`コンテンツ名（例：セクション${idx + 1})`}
                      onChange={(e) => {
                        const next = [...value];
                        next[idx] = build(e.target.value, parse(next[idx]).body);
                        onChange(next);
                      }}
                    />
                    <RichTextEditor
                      value={body}
                      onChange={(nextBody) => {
                        const next = [...value];
                        next[idx] = build(parse(next[idx]).title, nextBody);
                        onChange(next);
                      }}
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}
    </div>
  );
}
