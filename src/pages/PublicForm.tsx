import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

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

export default function PublicForm() {
  const params = useParams();
  const formId = params.id as string;
  const [form, setForm] = useState<PublicFormRow | null>(null);
  const [values, setValues] = useState<Record<string, any>>({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);

  useSEO(
    form ? `${form.name} | フォーム` : 'フォーム',
    form?.description || '埋め込みフォーム',
    typeof window !== "undefined" ? window.location.href : undefined
  );

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from('forms')
        .select('id,name,description,fields,success_message,is_public,user_id,require_line_friend,prevent_duplicate_per_friend,post_submit_scenario_id,submit_button_text,submit_button_variant,submit_button_bg_color,submit_button_text_color,accent_color')
        .eq('id', formId)
        .maybeSingle();
      if (error) {
        console.error('[forms.load] error:', error);
        toast.error('フォームの取得に失敗しました');
      }
      if (data) {
        setForm({ ...data, fields: Array.isArray(data.fields) ? data.fields : [] });
      }
      setLoading(false);
    };
    if (formId) load();
  }, [formId]);

  const handleChange = (name: string, value: any) => {
    setValues(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;

    // 必須チェック（checkbox/radioは上で制御）
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

    // URLパラメータ取得 & 正規化
    const url = new URL(window.location.href);
    const lineUserIdParam = url.searchParams.get('line_user_id') || url.searchParams.get('lu') || url.searchParams.get('user_id');

    let shortUid = url.searchParams.get('uid') || url.searchParams.get('suid') || url.searchParams.get('s');
    shortUid = shortUid?.trim() || null;
    if (shortUid && !['[UID]', 'UID'].includes(shortUid)) {
      shortUid = shortUid.toUpperCase(); // 運用規約に合わせて toUpperCase / toLowerCase を選択
    } else {
      shortUid = null;
    }

    console.log('フォーム送信開始 - URL解析:', {
      fullUrl: window.location.href,
      allSearchParams: Object.fromEntries(url.searchParams.entries()),
      extractedParams: { lineUserIdParam, shortUid },
      requireLineFriend: form.require_line_friend,
    });

    // 挿入用の変数（後で共通payloadに詰める）
    let actualFriendId: string | null = null;
    let actualLineUserId: string | null = lineUserIdParam ?? null;

    // 友だち限定フォームの検証
    if (form.require_line_friend) {
      if (!actualLineUserId && !shortUid) {
        toast.error('LINEアプリから開いてください（友だち限定フォーム）');
        return;
      }

      // 所有ユーザー配下で友だち情報を検索
      let friendQuery = (supabase as any)
        .from('line_friends')
        .select('id, line_user_id')
        .eq('user_id', form.user_id);

      if (shortUid) {
        friendQuery = friendQuery.eq('short_uid', shortUid);
      } else if (actualLineUserId) {
        friendQuery = friendQuery.eq('line_user_id', actualLineUserId);
      }

      const { data: friend, error: fErr } = await friendQuery.maybeSingle();
      console.log('[require_friend] friend lookup:', { friend, fErr, shortUid, lineUserIdParam });

      if (fErr || !friend) {
        toast.error('このフォームはLINE友だち限定です。先に友だち追加してください。');
        return;
      }
      actualFriendId = friend.id;
      actualLineUserId = friend.line_user_id || actualLineUserId || null;

      // 重複送信の抑止（友だち単位）
      if (form.prevent_duplicate_per_friend && actualFriendId) {
        const { data: dup, error: dupErr } = await (supabase as any)
          .from('form_submissions')
          .select('id')
          .eq('form_id', form.id)
          .eq('friend_id', actualFriendId)
          .maybeSingle();
        if (dupErr) {
          console.error('[dup.check] error:', dupErr);
        }
        if (dup) {
          toast.error('このフォームはお一人様1回までです。');
          return;
        }
      }
    } else {
      // 一般フォームでも、shortUid があれば可能なら紐づけ
      if (shortUid && !actualLineUserId) {
        console.log('[general] try resolve from shortUid:', shortUid);
        const { data: friendByUid, error: uidErr } = await (supabase as any)
          .from('line_friends')
          .select('line_user_id, id')
          .eq('user_id', form.user_id)
          .eq('short_uid', shortUid)
          .maybeSingle();

        if (friendByUid && !uidErr) {
          actualLineUserId = friendByUid.line_user_id;
          actualFriendId = friendByUid.id;
          console.log('[general] resolve success from shortUid:', { shortUid, actualLineUserId, actualFriendId });
        } else {
          console.info('[general] resolve none (expected case):', { shortUid, uidErr });
        }
      }
    }

    // ここで共通payloadを作って一度だけ挿入
    const payload = {
      form_id: form.id,
      data: values,
      user_id: form.user_id, // ★匿名でも所有者に必ず紐づける（ダッシュボード/RLSで見えるように）
      friend_id: actualFriendId,
      line_user_id: actualLineUserId,
    };

    console.log('[insert.payload]', payload);

    const { error } = await (supabase as any)
      .from('form_submissions')
      .insert(payload);

    if (error) {
      console.error('[insert.error]', error);
      toast.error('送信に失敗しました');
      return;
    }
    console.log('[insert.success] Form submitted successfully');

    setSubmitted(true);
    toast.success('送信しました');
    // TODO: 回答後シナリオ遷移（必要なら安全なサーバ関数経由で）
  };

  if (loading) return <div className="container mx-auto max-w-3xl p-4">読み込み中...</div>;
  if (!form) return <div className="container mx-auto max-w-3xl p-4">フォームが見つかりません</div>;
  if (!form.is_public) return <div className="container mx-auto max-w-3xl p-4">このフォームは非公開です</div>;

  return (
    <div className="container mx-auto max-w-3xl p-4">
      <Card>
        <CardHeader>
          <CardTitle>{form.name}</CardTitle>
          {form.description && <CardDescription>{form.description}</CardDescription>}
        </CardHeader>
        <CardContent>
          {submitted ? (
            <div className="py-8">
              <p className="text-center text-muted-foreground">
                {form.success_message || '送信ありがとうございました。'}
              </p>
            </div>
          ) : (
            <form
              className="space-y-4"
              onSubmit={handleSubmit}
              style={{ ['--form-accent' as any]: form.accent_color || '#0cb386' }}
            >
              {form.require_line_friend && (
                <p className="text-xs text-muted-foreground">
                  このフォームはLINE友だち限定です。LINEから開くと自動で認証されます。
                </p>
              )}

              {form.fields.map((f) => {
                const fieldId = `field-${f.id || f.name}`;
                const isGroup = f.type === 'radio' || f.type === 'checkbox';

                // 上部ラベル：単一入力は htmlFor、グループ入力は id と aria-labelledby を使う
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
                          <SelectTrigger id={fieldId} name={f.name} className="px-3" aria-labelledby={`${fieldId}-label`}>
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
