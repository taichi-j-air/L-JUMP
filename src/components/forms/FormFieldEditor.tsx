import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { FormField } from "./FormFieldList";

interface Props {
  field: FormField | null;
  onChange: (patch: Partial<FormField>) => void;
}

export default function FormFieldEditor({ field, onChange }: Props) {
  const isChoice = field?.type === "select" || field?.type === "radio" || field?.type === "checkbox";

  const [optionsText, setOptionsText] = useState<string>("");
  useEffect(() => {
    if (isChoice && field) {
      setOptionsText((field.options || []).join("\n"));
    } else {
      setOptionsText("");
    }
  }, [field?.id, isChoice, field?.options]);

  if (!field) {
    return <div className="text-sm text-muted-foreground">左のリストからフィールドを選択、または追加してください。</div>;
  }
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <label className="text-sm">表示ラベル</label>
        <Input value={field.label} onChange={(e) => onChange({ label: e.target.value })} placeholder="氏名 など" />
      </div>


      <div className="grid grid-cols-2 gap-3 items-end">
        <div className="space-y-2">
          <label className="text-sm">タイプ</label>
          <Select value={field.type} onValueChange={(v) => onChange({ type: v })}>
            <SelectTrigger>
              <SelectValue placeholder="タイプ" />
            </SelectTrigger>
            <SelectContent className="bg-background z-[60]">
              
              <SelectItem value="email">メール</SelectItem>
              <SelectItem value="textarea">テキストエリア</SelectItem>
              <SelectItem value="select">ドロップダウン</SelectItem>
              <SelectItem value="radio">ラジオボタン</SelectItem>
              <SelectItem value="checkbox">チェックボックス</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 justify-end">
          <label className="text-sm whitespace-nowrap">回答必須：</label>
          <Switch checked={!!field.required} onCheckedChange={(v) => onChange({ required: v })} />
        </div>
      </div>

      {(field.type === "email" || field.type === "textarea") && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-sm">プレースホルダー</label>
            <Input
              value={field.placeholder ?? ""}
              onChange={(e) => onChange({ placeholder: e.target.value })}
              placeholder={field.type === "email" ? "例）example@example.com" : "例）ご質問をご記入ください"}
            />
          </div>
          {field.type === "textarea" && (
            <div className="space-y-2">
              <label className="text-sm">行数</label>
              <Input
                type="number"
                min={1}
                max={20}
                value={field.rows ?? 3}
                onChange={(e) => onChange({ rows: Math.max(1, Math.min(20, Number(e.target.value) || 1)) })}
              />
            </div>
          )}
        </div>
      )}

      {isChoice && (
        <div className="space-y-2">
          <label className="text-sm">選択肢（1行に1つ）</label>
          <Textarea
            rows={8}
            placeholder={`例）\nはい\nいいえ\nその他`}
            value={optionsText}
            onChange={(e) => {
              const text = e.target.value;
              setOptionsText(text);
              const opts = text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
              onChange({ options: opts });
            }}
            onKeyDown={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
