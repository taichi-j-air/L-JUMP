import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
type Field = { id: string; label: string; name: string; type: string; required?: boolean; options?: string[] };

interface Props {
  formName: string;
  setFormName: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  fields: Field[];
  submitButtonText: string;
  setSubmitButtonText: (v: string) => void;
  submitButtonVariant: string;
  setSubmitButtonVariant: (v: string) => void;
  successMessage: string;
  setSuccessMessage: (v: string) => void;
  isPublic: boolean;
  setIsPublic: (v: boolean) => void;
  requireLineFriend: boolean;
  setRequireLineFriend: (v: boolean) => void;
  preventDuplicate: boolean;
  setPreventDuplicate: (v: boolean) => void;
  postScenario: string | null;
  setPostScenario: (v: string | null) => void;
  scenarios: Array<{ id: string; name: string }>;
}

export default function FormPreviewPanel({
  formName,
  setFormName,
  description,
  setDescription,
  fields,
  submitButtonText,
  setSubmitButtonText,
  submitButtonVariant,
  setSubmitButtonVariant,
  successMessage,
  setSuccessMessage,
  isPublic,
  setIsPublic,
  requireLineFriend,
  setRequireLineFriend,
  preventDuplicate,
  setPreventDuplicate,
  postScenario,
  setPostScenario,
  scenarios,
}: Props) {
  const [values, setValues] = useState<Record<string, any>>({});

  const canSubmit = useMemo(() => {
    return fields.every((f) => {
      if (!f.required) return true;
      const v = values[f.name];
      if (f.type === "checkbox") return Array.isArray(v) && v.length > 0;
      return v != null && String(v).trim() !== "";
    });
  }, [fields, values]);

  const setValue = (name: string, v: any) => setValues((prev) => ({ ...prev, [name]: v }));

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h3 className="text-base font-semibold">フォーム設定</h3>
        <div className="grid gap-3">
          <div className="space-y-1">
            <label className="text-sm">フォーム名</label>
            <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="お問い合わせ など" />
          </div>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span>公開</span>
            <Switch checked={isPublic} onCheckedChange={setIsPublic} />
          </div>
          <div className="space-y-1">
            <label className="text-sm">説明（任意）</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="space-y-1">
            <label className="text-sm">送信成功メッセージ</label>
            <Input value={successMessage} onChange={(e) => setSuccessMessage(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-sm">送信ボタンのテキスト</label>
            <Input value={submitButtonText} onChange={(e) => setSubmitButtonText(e.target.value)} placeholder="送信 / 申し込み など" />
          </div>
          <div className="space-y-1">
            <label className="text-sm">送信ボタンのデザイン</label>
            <Select value={submitButtonVariant} onValueChange={setSubmitButtonVariant}>
              <SelectTrigger>
                <SelectValue placeholder="ボタンスタイル" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">標準</SelectItem>
                <SelectItem value="secondary">セカンダリ</SelectItem>
                <SelectItem value="outline">アウトライン</SelectItem>
                <SelectItem value="destructive">警告</SelectItem>
                <SelectItem value="ghost">ゴースト</SelectItem>
                <SelectItem value="link">リンク</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="space-y-1">
        <h3 className="text-base font-semibold">プレビュー</h3>
        <p className="text-xs text-muted-foreground">右側は実際の公開フォームの見た目です</p>
      </div>

      <div className="rounded-md border p-3 space-y-3">
        <div className="space-y-1">
          <h4 className="text-lg font-medium">{formName || "フォーム名"}</h4>
          {description && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{description}</p>}
        </div>

        <div className="space-y-3">
          {fields.map((f) => (
            <div key={f.id} className="space-y-1">
              <label className="text-sm">
                {f.label || f.name || "未設定"}
                {f.required && <span className="ml-1 text-destructive">*</span>}
              </label>
              {f.type === "text" || f.type === "email" ? (
                <Input
                  type={f.type === "email" ? "email" : "text"}
                  value={values[f.name] || ""}
                  onChange={(e) => setValue(f.name, e.target.value)}
                />
              ) : f.type === "textarea" ? (
                <Textarea
                  value={values[f.name] || ""}
                  onChange={(e) => setValue(f.name, e.target.value)}
                  rows={3}
                />
              ) : f.type === "select" ? (
                <Select value={values[f.name] || ""} onValueChange={(v) => setValue(f.name, v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="選択してください" />
                  </SelectTrigger>
                  <SelectContent>
                    {(f.options || []).map((o, i) => (
                      <SelectItem key={i} value={o}>{o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : f.type === "radio" ? (
                <RadioGroup value={values[f.name] || ""} onValueChange={(v) => setValue(f.name, v)}>
                  <div className="flex flex-wrap gap-3">
                    {(f.options || []).map((o, i) => (
                      <label key={i} className="flex items-center gap-2 text-sm">
                        <RadioGroupItem value={o} />
                        {o}
                      </label>
                    ))}
                  </div>
                </RadioGroup>
              ) : f.type === "checkbox" ? (
                <div className="flex flex-wrap gap-3">
                  {(f.options || []).map((o, i) => {
                    const checked = Array.isArray(values[f.name]) && values[f.name].includes(o);
                    return (
                      <label key={i} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => {
                            const checkedVal = v === true;
                            setValues((prev) => {
                              const arr = Array.isArray(prev[f.name]) ? [...prev[f.name]] : [];
                              if (checkedVal) {
                                arr.push(o);
                                return { ...prev, [f.name]: Array.from(new Set(arr)) };
                              }
                              return { ...prev, [f.name]: arr.filter((x) => x !== o) };
                            });
                          }}
                        />
                        {o}
                      </label>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ))}
        </div>

        <div className="pt-2">
          <Button disabled={!canSubmit} variant={submitButtonVariant as any}>
            {submitButtonText || "送信"}
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-medium">回答後の動作と制限</h4>
        <div className="grid gap-3">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span>LINE友だち限定</span>
            <Switch checked={requireLineFriend} onCheckedChange={setRequireLineFriend} />
          </div>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span>同一友だちの重複回答を禁止</span>
            <Switch checked={preventDuplicate} onCheckedChange={setPreventDuplicate} />
          </div>
          <div className="space-y-2">
            <label className="text-sm">回答後のシナリオ遷移（任意）</label>
            <Select value={postScenario ?? "none"} onValueChange={(v) => setPostScenario(v === "none" ? null : v)}>
              <SelectTrigger>
                <SelectValue placeholder="シナリオを選択" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">なし</SelectItem>
                {scenarios.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
}
