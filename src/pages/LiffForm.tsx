import { useEffect, useState } from "react";
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
import { Loader2, Smartphone, User } from "lucide-react";
import DOMPurify from 'dompurify';

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
  submit_button_variant?: string | null;
  submit_button_bg_color?: string | null;
  submit_button_text_color?: string | null;
  accent_color?: string | null;
  fields: Array<{ id: string; label: string; name: string; type: string; required?: boolean; options?: string[]; placeholder?: string; rows?: number }>;
}

const useSEO = (title: string, description: string, canonical?: string) => {
  useEffect(() => {
    document.title = title;
    const meta = document.querySelector('meta[name="description"]') || document.createElement('meta');
    meta.setAttribute('name', 'description');
    meta.setAttribute('content', description);
    document.head.appendChild(meta);

    if (canonical) {
      let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'canonical';
        document.head.appendChild(link);
      }
      link.href = canonical;
    }
  }, [title, description, canonical]);
};

export default function LiffForm() {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const formId = params.id as string;
  const liffId = searchParams.get('liff_id') || '';
  
  const [form, setForm] = useState<PublicFormRow | null>(null);
  const [values, setValues] = useState<Record<string, any>>({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const { 
    isLiffReady, 
    isLoggedIn, 
    profile, 
    error: liffError, 
    isLoading: liffLoading,
    login,
    closeWindow,
    isInClient
  } = useLiff(liffId);

  useSEO(
    form ? `${form.name} | LIFFフォーム` : 'LIFFフォーム',
    form?.description || 'LINE内で利用できる埋め込みフォーム',
    typeof window !== "undefined" ? window.location.href : undefined
  );

  useEffect(() => {
    const loadForm = async () => {
      setLoading(true);
      
      try {
        // First, try the RPC method
        const { data: formData, error: formError } = await supabase
          .rpc('get_public_form_meta', { p_form_id: formId })
          .maybeSingle();

        if (formError) {
          console.error('[forms.load] RPC error:', formError);
          
          // Fallback to direct table query if RPC fails
          console.log('[forms.load] Trying fallback method...');
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('forms')
            .select('id,name,description,fields,success_message,is_public,user_id,require_line_friend,prevent_duplicate_per_friend,post_submit_scenario_id,submit_button_text,submit_button_variant,submit_button_bg_color,submit_button_text_color,accent_color')
            .eq('id', formId)
            .maybeSingle();
            
          if (fallbackError) {
            console.error('[forms.load] Fallback error:', fallbackError);
            toast.error('フォームの取得に失敗しました');
            return;
          }
          
          if (fallbackData) {
            const formFields = Array.isArray(fallbackData.fields) 
              ? fallbackData.fields as Array<{ id: string; label: string; name: string; type: string; required?: boolean; options?: string[]; placeholder?: string; rows?: number }>
              : [];
            
            setForm({ ...fallbackData, fields: formFields });
            console.log('[forms.load] Fallback method successful');
          }
        } else if (formData) {
          // RPC method successful
          const formFields = Array.isArray(formData.fields) 
            ? formData.fields as Array<{ id: string; label: string; name: string; type: string; required?: boolean; options?: string[]; placeholder?: string; rows?: number }>
            : [];
          
          setForm({ ...formData, fields: formFields });
          console.log('[forms.load] RPC method successful');
        }
      } catch (error) {
        console.error('[forms.load] unexpected error:', error);
        toast.error('フォームの取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };
    
    if (formId) loadForm();
  }, [formId]);

  // Browser translation detection
  useEffect(() => {
    const checkTranslation = () => {
      const isTranslated = document.documentElement.classList.contains('translated-ltr') || 
                          document.documentElement.classList.contains('translated-rtl') ||
                          document.querySelector('[class*="translate"]') ||
                          document.querySelector('font[face]') ||
                          document.body.style.top === '-30000px';
      
      if (isTranslated) {
        console.warn('[Browser Translation] Page translation detected - this may cause errors');
        toast.error('ブラウザの翻訳機能が検出されました。正常に動作しない場合は翻訳をオフにしてください。', {
          duration: 8000
        });
      }
    };

    // Check after component mount
    const timer = setTimeout(checkTranslation, 1000);
    return () => clearTimeout(timer);
  }, []);

  const handleChange = (name: string, value: any) => {
    setValues(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form || !isLiffReady || !isLoggedIn || !profile) return;

    setSubmitting(true);

    // 必須チェック
    for (const f of form.fields) {
      const val = values[f.name];
      if (f.required) {
        if (f.type === 'checkbox') {
          if (!Array.isArray(val) || val.length === 0) {
            toast.error(`${f.label} は必須です`);
            setSubmitting(false);
            return;
          }
        } else if (!val) {
          toast.error(`${f.label} は必須です`);
          setSubmitting(false);
          return;
        }
      }
    }

    // LIFF情報を含むpayload作成
    const payload = {
      form_id: form.id,
      data: values,
      user_id: form.user_id,
      line_user_id: profile.userId,
      meta: {
        source: 'liff',
        liff_id: liffId,
        display_name: profile.displayName,
        picture_url: profile.pictureUrl,
        full_url: window.location.href,
        user_agent: navigator.userAgent,
        timestamp: new Date().toISOString()
      }
    };

    console.log('[liff.insert.payload]', payload);

    const { data, error } = await supabase
      .from('form_submissions')
      .insert(payload);

    if (error) {
      console.error('[liff.insert.error] Full error details:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        payload: payload
      });
      
      if (error.code === '23505') {
        toast.error('既に回答済の為、送信できません。');
      } else {
        toast.error('送信に失敗しました。もう一度お試しください。');
      }
      setSubmitting(false);
      return;
    }

    console.log('[liff.insert.success] Form submitted successfully via LIFF');
    setSubmitted(true);
    toast.success('送信しました');
    setSubmitting(false);

    // 3秒後にLIFFウィンドウを閉じる（オプション）
    setTimeout(() => {
      if (isInClient) {
        closeWindow();
      }
    }, 3000);
  };

  // LIFF読み込み中
  if (liffLoading || loading) {
    return (
      <div className="container mx-auto max-w-md p-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-center text-muted-foreground">
                {liffLoading ? 'LIFF初期化中...' : 'フォーム読み込み中...'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // LIFFエラー
  if (liffError) {
    return (
      <div className="container mx-auto max-w-md p-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-destructive">LIFFエラー</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">{liffError}</p>
            <Button 
              onClick={() => window.location.reload()} 
              className="w-full"
            >
              再読み込み
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // フォームが見つからない
  if (!form) {
    return (
      <div className="container mx-auto max-w-md p-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">フォームが見つかりません</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // フォームが非公開
  if (!form.is_public) {
    return (
      <div className="container mx-auto max-w-md p-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">このフォームは非公開です</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // LINEログインが必要
  if (!isLoggedIn) {
    return (
      <div className="container mx-auto max-w-md p-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-center">LINEログイン</CardTitle>
            <CardDescription className="text-center">
              このフォームを利用するにはLINEログインが必要です
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={login} className="w-full" size="lg">
              <User className="mr-2 h-4 w-4" />
              LINEでログイン
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-md p-4">
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2 mb-2">
            <Smartphone className="h-5 w-5 text-primary" />
            <span className="text-sm text-primary font-medium">LIFF</span>
          </div>
          <CardTitle>{form.name}</CardTitle>
          {form.description && <CardDescription>{form.description}</CardDescription>}
          {profile && (
            <div className="flex items-center space-x-2 p-2 bg-muted rounded-lg">
              {profile.pictureUrl && (
                <img 
                  src={profile.pictureUrl} 
                  alt={profile.displayName}
                  className="w-8 h-8 rounded-full"
                />
              )}
              <div>
                <p className="text-sm font-medium">{profile.displayName}</p>
                <p className="text-xs text-muted-foreground">としてログイン中</p>
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {submitted ? (
            <div className="py-8 text-center space-y-4">
              <div className="text-4xl">✅</div>
              <div className="text-foreground" 
                   dangerouslySetInnerHTML={{ 
                     __html: DOMPurify.sanitize(form.success_message && form.success_message.trim() 
                       ? form.success_message 
                       : '送信ありがとうございました。')
                   }} 
              />
              {isInClient && (
                <p className="text-xs text-muted-foreground">
                  まもなくこのウィンドウが閉じます
                </p>
              )}
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
                disabled={submitting}
                style={{ 
                  backgroundColor: form.submit_button_bg_color || '#0cb386', 
                  color: form.submit_button_text_color || '#ffffff' 
                }}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    送信中...
                  </>
                ) : (
                  form.submit_button_text || '送信'
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}