import { useState } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { RichTextEditor } from "./RichTextEditor";

interface RichTextBlocksEditorProps {
  value: string[];
  onChange: (blocks: string[]) => void;
}

export default function RichTextBlocksEditor({ value, onChange }: RichTextBlocksEditorProps) {
  const [openItem, setOpenItem] = useState<string | undefined>(value.length ? `b-${0}` : undefined);

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
          {value.map((html, idx) => (
            <AccordionItem key={idx} value={`b-${idx}`}>
              <AccordionTrigger>
                <div className="flex-1 text-left">コンテンツ {idx + 1}</div>
                <Button type="button" size="sm" variant="destructive" onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeBlock(idx); }}>削除</Button>
              </AccordionTrigger>
              <AccordionContent>
                <RichTextEditor
                  value={html}
                  onChange={(nextHtml) => {
                    const arr = [...value];
                    arr[idx] = nextHtml;
                    onChange(arr);
                  }}
                />
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
}
