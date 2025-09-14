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
      {/* フィールド名 */}
      <div className="space-y-1">
        <Label className="text-xs">フィールド名</Label>
        <span className="text-[10px] text-red-500 block">
          ※フィールド名は基本的には変更不要です
        </span>
        <Input
          value={field.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="例）name"
        />
      </div>

      {/* 横線 */}
      <hr className="border-t border-gray-200 my-2" />

      {/* 質問名 */}
      <div className="space-y-1">
        <Label className="text-xs">質問名 [タイトル]</Label>
        <Input
          value={field.label}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder="例）お名前"
        />
      </div>

      {/* 回答形式 */}
      <div className="space-y-1">
        <Label className="text-xs">回答形式</Label>
        <Select value={field.type} onValueChange={(v) => onChange({ type: v })}>
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

      {/* 回答必須 */}
      <div className="flex items-center gap-2">
        <Label className="text-xs whitespace-nowrap">回答必須：</Label>
        <Switch checked={!!field.required} onCheckedChange={(v) => onChange({ required: !!v })} />
      </div>

      {/* プレースホルダー */}
      {(field.type === "text" || field.type === "email" || field.type === "textarea") && (
        <div className="space-y-1">
          <Label className="text-xs">プレースホルダー</Label>
          <Input
            value={field.placeholder || ""}
            onChange={(e) => onChange({ placeholder: e.target.value })}
          />
        </div>
      )}

      {/* 行数 */}
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

      {/* 選択肢 */}
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
