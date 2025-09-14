import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export type EditField = {
  id: string;
  label: string;
  name: string;
  type: string;
  required?: boolean;
  options?: string[];
  placeholder?: string;
  rows?: number;
};

interface Props {
  field: EditField | null;
  onChange: (patch: Partial<EditField>) => void;
}

export default function FieldEditorPanel({ field, onChange }: Props) {
  if (!field) {
    return <p className="text-xs text-muted-foreground">左の一覧からフィールドを選択してください。</p>;
  }

  const isOptionType = field.type === "select" || field.type === "radio" || field.type === "checkbox";
  const optionsText = (field.options || []).join("\n");

  return (
    <div className="space-y-4">
      {/* ① フィールド名 */}
      <div className="space-y-1">
        <Label className="text-xs">フィールド名</Label>
        <Input
          value={field.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="例）name"
        />
        <p className="text-[11px] text-red-500 mt-1">※フィールド名は基本的には変更不要です</p>
      </div>

      <hr className="border-t border-border" />

      {/* ② 質問名（ラベル） */}
      <div className="space-y-1">
        <Label className="text-xs">質問名［タイトル］</Label>
        <Input
          value={field.label}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder="例）お名前"
        />
      </div>

      {/* ③ 回答形式 */}
      <div className="space-y-1">
        <Label className="text-xs">回答形式</Label>
        <Select
          value={field.type}
          onValueChange={(v) =>
            onChange({
              type: v,
              // ✅ select に切り替えたら placeholder は空にして残らないようにする
              ...(v === "select" ? { placeholder: "" } : {}),
            })
          }
        >
          <SelectTrigger className="px-3">
            <SelectValue placeholder="タイプを選択" />
          </SelectTrigger>
          <SelectContent className="bg-background z-[60]">
            <SelectItem value="text">テキスト</SelectItem>
            <SelectItem value="email">メール</SelectItem>
            <SelectItem value="textarea">テキストエリア</SelectItem>
            <SelectItem value="select">ドロップダウン</SelectItem>
            <SelectItem value="radio">ラジオボタン</SelectItem>
            <SelectItem value="checkbox">チェックボックス</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* ④ 回答必須 */}
      <div className="flex items-center gap-2">
        <Label className="text-xs">回答必須：</Label>
        <Switch checked={!!field.required} onCheckedChange={(v) => onChange({ required: !!v })} />
      </div>

      {/* プレースホルダー（text / email / textarea のみ） */}
      {(field.type === "text" || field.type === "email" || field.type === "textarea") && (
        <div className="space-y-1">
          <Label className="text-xs">プレースホルダー</Label>
          <Input
            value={field.placeholder || ""}
            onChange={(e) => onChange({ placeholder: e.target.value })}
            placeholder="入力例）山田太郎"
          />
        </div>
      )}

      {/* 行数（textarea のみ） */}
      {field.type === "textarea" && (
        <div className="space-y-1">
          <Label className="text-xs">行数</Label>
          <Input
            type="number"
            min={1}
            value={field.rows ?? 3}
            onChange={(e) => onChange({ rows: Number(e.target.value || 3) })}
          />
        </div>
      )}

      {/* 選択肢（select / radio / checkbox のみ） */}
      {isOptionType && (
        <div className="space-y-1">
          <Label className="text-xs">選択肢（1行に1つ、改行で追加）</Label>
          <Textarea
            value={optionsText}
            onChange={(e) => {
              const lines = e.target.value.split(/\r?\n/);
              onChange({ options: lines });
            }}
            rows={6}
            placeholder={"例)\nはい\nいいえ\nわからない"}
          />
        </div>
      )}
    </div>
  );
}
