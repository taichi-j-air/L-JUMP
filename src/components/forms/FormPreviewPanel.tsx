import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ColorPicker } from "@/components/ui/color-picker";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useLiffValidation } from "@/hooks/useLiffValidation";

// Keep props same to avoid refactor ripple, but name/description editing moved to middle column
type Field = { id: string; label: string; name: string; type: string; required?: boolean; options?: string[]; placeholder?: string; rows?: number };

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
  submitButtonBgColor: string;
  setSubmitButtonBgColor: (v: string) => void;
  submitButtonTextColor: string;
  setSubmitButtonTextColor: (v: string) => void;
  accentColor: string;
  setAccentColor: (v: string) => void;
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
  submitButtonBgColor,
  setSubmitButtonBgColor,
  submitButtonTextColor,
  setSubmitButtonTextColor,
  accentColor,
  setAccentColor,
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
  const [showLiffDialog, setShowLiffDialog] = useState(false);
  const { hasLiffConfig, loading: liffLoading } = useLiffValidation();

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
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-base font-semibold">プレビュー</h3>
        <p className="text-xs text-muted-foreground">右側は実際の公開フォームの見た目です</p>
      </div>

      <div className="rounded-md border p-3 space-y-3" style={{ ['--form-accent' as any]: accentColor }}>
        <div className="space-y-1">
          <h4 className="text-lg font-medium">{formName || "フォーム名"}</h4>
          {description && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{description}</p>}
        </div>

        <div className="space-y-3">
          {fields.map((f) => (
            <div key={f.id} className="space-y-1">
              <label className="text-sm">
                {f.label || f.name || "未設定"}
                {f.required && (
                  <span className="ml-1 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] bg-destructive text-destructive-foreground">必須</span>
                )}
              </label>
              {f.type === "text" || f.type === "email" ? (
                <Input
                  type={f.type === "email" ? "email" : "text"}
                  value={values[f.name] || ""}
                  onChange={(e) => setValue(f.name, e.target.value)}
                  placeholder={f.placeholder || undefined}
                />
              ) : f.type === "textarea" ? (
                <Textarea
                  value={values[f.name] || ""}
                  onChange={(e) => setValue(f.name, e.target.value)}
                  rows={f.rows || 3}
                  placeholder={f.placeholder || undefined}
                />
              ) : f.type === "select" ? (
                <Select value={values[f.name] ?? undefined} onValueChange={(v) => setValue(f.name, v)}>
                  <SelectTrigger className="px-3">
                    <SelectValue placeholder="選択してください" />
                  </SelectTrigger>
                    <SelectContent className="bg-background z-[60]">
                      {((f.options || []).map((o) => (o ?? "").trim()).filter(Boolean)).map((o, i) => (
                        <SelectItem key={`${o}-${i}`} value={o}>{o}</SelectItem>
                      ))}
                    </SelectContent>
                </Select>
              ) : f.type === "radio" ? (
                <RadioGroup value={values[f.name] || ""} onValueChange={(v) => setValue(f.name, v)}>
                  <div className="flex flex-col gap-2">
                    {(f.options || []).map((o, i) => (
                      <label key={i} className="inline-flex items-center gap-2 text-sm">
                        <RadioGroupItem value={o} className="border-[var(--form-accent)] data-[state=checked]:bg-[var(--form-accent)] data-[state=checked]:text-white" />
                        {o}
                      </label>
                    ))}
                  </div>
                </RadioGroup>
              ) : f.type === "checkbox" ? (
                <div className="flex flex-col gap-2">
                  {(f.options || []).map((o, i) => {
                    const checked = Array.isArray(values[f.name]) && values[f.name].includes(o);
                    return (
                      <label key={i} className="inline-flex items-center gap-2 text-sm">
                        <Checkbox
                          className="border-[var(--form-accent)] data-[state=checked]:bg-[var(--form-accent)] data-[state=checked]:text-white"
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

        <div className="pt-2 flex justify-center">
          <Button disabled={!canSubmit} variant="default" style={{ backgroundColor: submitButtonBgColor, color: submitButtonTextColor }}>
            {submitButtonText || "送信"}
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-medium">回答後の動作と制限</h4>
        <div className="grid gap-3">
          <div className="flex items-center gap-2 text-sm">
            <Switch id="is-public" checked={isPublic} onCheckedChange={setIsPublic} />
            <label htmlFor="is-public">公開</label>
          </div>
          <div className="space-y-1">
            <label className="text-sm">送信成功メッセージ</label>
            <Input value={successMessage} onChange={(e) => setSuccessMessage(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-sm">送信ボタンのテキスト</label>
            <Input value={submitButtonText} onChange={(e) => setSubmitButtonText(e.target.value)} placeholder="送信 / 申し込み など" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm">送信ボタン 背景色</label>
              <ColorPicker color={submitButtonBgColor} onChange={setSubmitButtonBgColor} />
            </div>
            <div className="space-y-1">
              <label className="text-sm">送信ボタン テキスト色</label>
              <ColorPicker color={submitButtonTextColor} onChange={setSubmitButtonTextColor} />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm">アクセントカラー（ラジオ/チェック）</label>
            <ColorPicker color={accentColor} onChange={setAccentColor} />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span>LINE友だち限定</span>
              <Switch 
                checked={requireLineFriend} 
                onCheckedChange={(checked) => {
                  if (checked && !liffLoading && !hasLiffConfig) {
                    setShowLiffDialog(true);
                    return;
                  }
                  setRequireLineFriend(checked);
                }} 
              />
            </div>
            <p className="text-xs text-muted-foreground">
              オンにすると、LINEから開いた友だちのみ回答可能になり、匿名での回答ができなくなります。
              LIFFが未設定の場合は設定が必要です。
            </p>
          </div>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span>同一友だちの重複回答を禁止</span>
            <Switch disabled={!requireLineFriend} checked={preventDuplicate} onCheckedChange={setPreventDuplicate} />
          </div>
          <div className="space-y-2">
            <label className="text-sm">回答後のシナリオ遷移（任意）</label>
            <Select value={postScenario ?? "none"} onValueChange={(v) => setPostScenario(v === "none" ? null : v)}>
              <SelectTrigger className="px-3">
                <SelectValue placeholder="シナリオを選択" />
              </SelectTrigger>
              <SelectContent className="bg-background z-[60]">
                <SelectItem value="none">なし</SelectItem>
                {scenarios.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <AlertDialog open={showLiffDialog} onOpenChange={setShowLiffDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>LIFF設定が必要です</AlertDialogTitle>
            <AlertDialogDescription>
              LINE友だち限定フォームを有効にするには、LINEログインチャネルとLIFFの設定が必要です。
              設定画面に移動しますか？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              window.open('/line-login-settings', '_blank');
              setShowLiffDialog(false);
            }}>
              設定画面を開く
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
