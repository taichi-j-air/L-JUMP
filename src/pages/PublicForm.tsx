import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
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
    window.location.href
  );

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from('forms')
        .select('id,name,description,fields,success_message,is_public,user_id,require_line_friend,prevent_duplicate_per_friend,post_submit_scenario_id,submit_button_text,submit_button_variant')
        .eq('id', formId)
        .maybeSingle();
      if (error) {
        console.error(error);
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

    const url = new URL(window.location.href);
    const lineUserId = url.searchParams.get('line_user_id') || url.searchParams.get('lu');

    let friendId: string | null = null;
    if (form.require_line_friend) {
      if (!lineUserId) {
        toast.error('LINEアプリから開いてください（友だち限定フォーム）');
        return;
      }
      // Check friend existence for the form owner
      const { data: friend, error: fErr } = await (supabase as any)
        .from('line_friends')
        .select('id')
        .eq('line_user_id', lineUserId)
        .eq('user_id', form.user_id)
        .maybeSingle();
      if (fErr || !friend) {
        toast.error('このフォームはLINE友だち限定です。先に友だち追加してください。');
        return;
      }
      friendId = friend.id;

      if (form.prevent_duplicate_per_friend) {
        const { data: dup } = await (supabase as any)
          .from('form_submissions')
          .select('id')
          .eq('form_id', form.id)
          .eq('friend_id', friendId)
          .maybeSingle();
        if (dup) {
          toast.error('このフォームはお一人様1回までです。');
          return;
        }
      }
    }

    const { error } = await (supabase as any).from('form_submissions').insert({
      form_id: form.id,
      data: values,
      friend_id: friendId,
      line_user_id: lineUserId || null,
    });
    if (error) {
      console.error(error);
      toast.error('送信に失敗しました');
    } else {
      setSubmitted(true);
      toast.success('送信しました');
      // TODO: 回答後シナリオ遷移の実行（安全な関数を用意してサーバー側で切替）
    }
  };

  if (loading) return <div className="container mx-auto max-w-3xl p-4">読み込み中...</div>;
  if (!form) return <div className="container mx-auto max-w-3xl p-4">フォームが見つかりません</div>;
  if (!form.is_public) return <div className="container mx-auto max-w-3xl p-4">このフォームは非公開です</div>;

  return (
    <div className="container mx-auto max-w-3xl p-4">
      <Card>
        <CardHeader>
          <CardTitle>
            {form.name}
          </CardTitle>
          {form.description && <CardDescription>{form.description}</CardDescription>}
        </CardHeader>
        <CardContent>
          {submitted ? (
            <div className="py-8">
              <p className="text-center text-muted-foreground">{form.success_message || '送信ありがとうございました。'}</p>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              {form.require_line_friend && (
                <p className="text-xs text-muted-foreground">
                  このフォームはLINE友だち限定です。LINEから開くと自動で認証されます。
                </p>
              )}
              {form.fields.map((f) => (
                <div key={f.id} className="space-y-2">
                  <label className="text-sm font-medium" htmlFor={f.name}>
                    {f.label}
                    {f.required && (
                      <span className="ml-1 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] bg-destructive text-destructive-foreground">必須</span>
                    )}
                  </label>
                  {f.type === 'textarea' && (
                    <Textarea id={f.name} name={f.name} required={!!f.required} onChange={(e)=>handleChange(f.name, e.target.value)} />
                  )}
                  {f.type === 'text' || f.type === 'email' ? (
                    <Input id={f.name} name={f.name} type={f.type || 'text'} required={!!f.required} onChange={(e)=>handleChange(f.name, e.target.value)} />
                  ) : null}
                  {f.type === 'select' && Array.isArray(f.options) && (
                    <Select onValueChange={(v)=>handleChange(f.name, v)}>
                      <SelectTrigger><SelectValue placeholder="選択してください" /></SelectTrigger>
                      <SelectContent className="bg-background z-[60]">
                        {f.options.map((opt)=> (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {f.type === 'radio' && Array.isArray(f.options) && (
                    <div className="flex flex-col gap-2">
                      {f.options.map((opt)=> (
                        <label key={opt} className="inline-flex items-center gap-2">
                          <input type="radio" name={f.name} value={opt} onChange={(e)=>handleChange(f.name, e.target.value)} />
                          <span>{opt}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  {f.type === 'checkbox' && Array.isArray(f.options) && (
                    <div className="flex flex-col gap-2">
                      {f.options.map((opt)=> {
                        const checked = Array.isArray(values[f.name]) && values[f.name].includes(opt);
                        return (
                          <label key={opt} className="inline-flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={!!checked}
                              onChange={(e)=>{
                                const prev: string[] = Array.isArray(values[f.name]) ? values[f.name] : [];
                                if (e.target.checked) {
                                  handleChange(f.name, Array.from(new Set([...prev, opt])));
                                } else {
                                  handleChange(f.name, prev.filter(v => v !== opt));
                                }
                              }}
                            />
                            <span>{opt}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
              <Button type="submit" className="w-full" variant={(form.submit_button_variant || 'default') as any}>{form.submit_button_text || '送信'}</Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
