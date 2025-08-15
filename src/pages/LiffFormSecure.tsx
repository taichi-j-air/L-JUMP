import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useLiff } from "@/hooks/useLiff";

interface PublicFormRow {
  id: string;
  name: string;
  description: string | null;
  is_public: boolean;
  success_message: string | null;
  user_id?: string;
  require_line_friend?: boolean;
  prevent_duplicate_per_friend?: boolean;
  post_submit_scenario_id?: string | null;
  submit_button_text?: string | null;
  submit_button_bg_color?: string | null;
  submit_button_text_color?: string | null;
  accent_color?: string | null;
  fields: Array<{ id: string; label: string; name: string; type: string; required?: boolean; options?: string[]; placeholder?: string; rows?: number }>;
}

const useSEO = (title: string, description: string) => {
  useEffect(() => {
    document.title = title;
    const meta = document.querySelector('meta[name="description"]') || document.createElement('meta');
    meta.setAttribute('name', 'description');
    meta.setAttribute('content', description);
    document.head.appendChild(meta);
  }, [title, description]);
};

export default function LiffFormSecure() {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const formId = params.id as string;
  const liffId = searchParams.get('liffId') || undefined;
  
  const [form, setForm] = useState<PublicFormRow | null>(null);
  const [values, setValues] = useState<Record<string, any>>({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);

  const { 
    isLiffReady: liffReady, 
    isLoggedIn: liffLoggedIn, 
    profile: liffProfile, 
    error: liffError,
    login: liffLogin,
    closeWindow
  } = useLiff(liffId);

  useSEO(
    form ? `${form.name} | LIFFフォーム` : 'LIFFフォーム',
    form?.description || 'LINE認証付きフォーム'
  );

  useEffect(() => {
    const loadForm = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('forms')
        .select('id,name,description,fields,success_message,is_public,user_id,require_line_friend,prevent_duplicate_per_friend,post_submit_scenario_id,submit_button_text,submit_button_bg_color,submit_button_text_color,accent_color')
        .eq('id', formId)
        .maybeSingle();
      
      if (error) {
        console.error('[liff-form.load] error:', error);
        toast.error('フォームの取得に失敗しました');
      }
      if (data) {
        setForm({ ...data, fields: Array.isArray(data.fields) ? data.fields as any : [] });
      }
      setLoading(false);
    };
    if (formId) loadForm();
  }, [formId]);

  const handleChange = (name: string, value: any) => {
    setValues(prev => ({ ...prev, [name]: value }));
  };

  const canSubmit = useMemo(() => {
    if (!form) return false;
    return form.fields.every((f) => {
      if (!f.required) return true;
      const val = values[f.name];
      if (f.type === 'checkbox') {
        return Array.isArray(val) && val.length > 0;
      }
      return val != null && String(val).trim() !== "";
    });
  }, [form, values]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form || !liffProfile) return;

    // 必須チェック
    for (const f of form.fields) {
      const val = values[f.name];
      if (f.required) {
        if (f.type === 'checkbox') {
          if (!Array.isArray(val) || val.length === 0) {
            toast.error(`${f.label} は必須です`);
            return;
          }
        } else if (!val) {
          toast.error(`${f.label} は必須です`);
          return;
        }
      }
    }

    const payload = {
      form_id: form.id,
      data: values,
      user_id: form.user_id,
      line_user_id: liffProfile.userId,
      meta: {
        liff_authentication: true,
        display_name: liffProfile.displayName,
        picture_url: liffProfile.pictureUrl,
        timestamp: new Date().toISOString()
      }
    };

    console.log('[liff-form.submit]', payload);

    const { error } = await supabase
      .from('form_submissions')
      .insert(payload);

    if (error) {
      console.error('[liff-form.error]', error);
      if (error.code === '23505' && error.message?.includes('この友だちは既にこのフォームに回答済みです')) {
        toast.error('この友だちは既にこのフォームに回答済みです。');
      } else {
        toast.error('送信に失敗しました');
      }
      return;
    }

    setSubmitted(true);
    toast.success('送信しました');
    
    // 3秒後にLIFFウィンドウを閉じる
    setTimeout(() => {
      closeWindow();
    }, 3000);
  };

  if (loading) return <div className="container mx-auto max-w-3xl p-4">読み込み中...</div>;
  if (!form) return <div className="container mx-auto max-w-3xl p-4">フォームが見つかりません</div>;
  if (!form.is_public) return <div className="container mx-auto max-w-3xl p-4">このフォームは非公開です</div>;

  if (liffError) {
    return (
      <div className="container mx-auto max-w-3xl p-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-destructive">
              LINEの認証でエラーが発生しました。再度お試しください。
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!liffReady) {
    return (
      <div className="container mx-auto max-w-3xl p-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center">LINE認証を初期化中...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!liffLoggedIn) {
    return (
      <div className="container mx-auto max-w-3xl p-4">
        <Card>
          <CardContent className="pt-6 space-y-4">
            <p className="text-center">LINEでログインしてフォームに回答してください</p>
            <div className="flex justify-center">
              <Button onClick={liffLogin} className="bg-[#06C755] hover:bg-[#05B04A] text-white">
                LINEでログイン
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-3xl p-4">
      <Card>
        <CardHeader>
          <CardTitle>{form.name}</CardTitle>
          {form.description && <CardDescription>{form.description}</CardDescription>}
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
              LINE認証済み
            </span>
            {liffProfile?.displayName}
          </div>
        </CardHeader>
        <CardContent>
          {submitted ? (
            <div className="py-8 text-center space-y-4">
              <div className="text-muted-foreground" 
                   dangerouslySetInnerHTML={{ __html: form.success_message || '送信ありがとうございました。' }} />
              <p className="text-sm text-muted-foreground">
                このウィンドウは自動で閉じます...
              </p>
            </div>
          ) : (
            <form
              className="space-y-4"
              onSubmit={handleSubmit}
              style={{ ['--form-accent' as any]: form.accent_color || '#0cb386' }}
            >
              {form.fields.map((f) => {
                const fieldId = `field-${f.id || f.name}`;
                const isGroup = f.type === 'radio' || f.type === 'checkbox';

                const TopLabel = (
                  <label
                    className="text-sm font-medium"
                    {...(isGroup ? { id: `${fieldId}-label` } : { htmlFor: fieldId })}
                  >
                    {f.label}
                    {f.required && (
                      <span className="ml-1 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] bg-destructive text-destructive-foreground">
                        必須
                      </span>
                    )}
                  </label>
                );

                return (
                  <div key={f.id ?? f.name} className="space-y-2">
                    {TopLabel}

                    {f.type === 'textarea' && (
                      <Textarea
                        id={fieldId}
                        name={f.name}
                        placeholder={f.placeholder}
                        rows={f.rows || 3}
                        required={!!f.required}
                        onChange={(e) => handleChange(f.name, e.target.value)}
                      />
                    )}

                    {(f.type === 'text' || f.type === 'email') && (
                      <Input
                        id={fieldId}
                        name={f.name}
                        type={f.type || 'text'}
                        placeholder={f.placeholder}
                        required={!!f.required}
                        onChange={(e) => handleChange(f.name, e.target.value)}
                      />
                    )}

                    {f.type === 'select' && Array.isArray(f.options) && (
                      <div>
                        <Select onValueChange={(v) => handleChange(f.name, v)}>
                          <SelectTrigger id={fieldId} name={f.name} className="px-3">
                            <SelectValue placeholder="選択してください" />
                          </SelectTrigger>
                          <SelectContent className="bg-background z-[60]">
                            {(f.options || [])
                              .map((opt) => (opt ?? "").trim())
                              .filter(Boolean)
                              .map((opt, i) => (
                                <SelectItem key={`${opt}-${i}`} value={opt}>
                                  {opt}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {f.type === 'radio' && Array.isArray(f.options) && (
                      <fieldset aria-labelledby={`${fieldId}-label`}>
                        <legend className="sr-only">{f.label}</legend>
                        <RadioGroup
                          value={values[f.name] || ""}
                          onValueChange={(v) => handleChange(f.name, v)}
                        >
                          <div className="flex flex-col gap-2">
                            {f.options.map((opt, index) => {
                              const radioId = `${fieldId}-radio-${index}`;
                              return (
                                <div key={opt} className="inline-flex items-center gap-2">
                                  <RadioGroupItem
                                    id={radioId}
                                    value={opt}
                                    className="border-[var(--form-accent)] data-[state=checked]:bg-[var(--form-accent)] data-[state=checked]:text-white"
                                  />
                                  <label htmlFor={radioId} className="text-sm cursor-pointer">
                                    {opt}
                                  </label>
                                </div>
                              );
                            })}
                          </div>
                        </RadioGroup>
                      </fieldset>
                    )}

                    {f.type === 'checkbox' && Array.isArray(f.options) && (
                      <fieldset aria-labelledby={`${fieldId}-label`}>
                        <legend className="sr-only">{f.label}</legend>
                        <div className="flex flex-col gap-2" role="group">
                          {f.options.map((opt, index) => {
                            const checkboxId = `${fieldId}-checkbox-${index}`;
                            const checked = Array.isArray(values[f.name]) && values[f.name].includes(opt);
                            return (
                              <div key={opt} className="inline-flex items-center gap-2">
                                <Checkbox
                                  id={checkboxId}
                                  name={`${f.name}[]`}
                                  className="border-[var(--form-accent)] data-[state=checked]:bg-[var(--form-accent)] data-[state=checked]:text-white"
                                  checked={!!checked}
                                  onCheckedChange={(v) => {
                                    const prev: string[] = Array.isArray(values[f.name]) ? values[f.name] : [];
                                    if (v === true) {
                                      handleChange(f.name, Array.from(new Set([...prev, opt])));
                                    } else {
                                      handleChange(f.name, prev.filter((x) => x !== opt));
                                    }
                                  }}
                                />
                                <label htmlFor={checkboxId} className="text-sm cursor-pointer">
                                  {opt}
                                </label>
                              </div>
                            );
                          })}
                        </div>
                      </fieldset>
                    )}
                  </div>
                );
              })}

              <Button
                type="submit"
                className="w-full"
                variant="default"
                disabled={!canSubmit}
                style={{ backgroundColor: form.submit_button_bg_color || '#0cb386', color: form.submit_button_text_color || '#ffffff' }}
              >
                {form.submit_button_text || '送信'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}