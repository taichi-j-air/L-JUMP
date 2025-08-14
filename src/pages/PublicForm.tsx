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
    window.location.href
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
    console.log('=== フォーム送信開始 ===');
    e.preventDefault();
    console.log('=== バリデーション開始 ===');
    if (!form) {
      console.log('フォームが存在しません');
      return;
    }

    console.log('=== 必須項目チェック開始 ===');
    for (const f of form.fields) {
      const val = values[f.name];
      console.log(`フィールド ${f.name}: ${JSON.stringify(val)} (必須: ${f.required})`);
      if (f.required) {
        if (f.type === 'checkbox') {
          if (!Array.isArray(val) || val.length === 0) {
            console.log(`必須チェックボックスが未入力: ${f.label}`);
            toast.error(`${f.label} は必須です`);
            return;
          }
        } else if (!val) {
          console.log(`必須項目が未入力: ${f.label}`);
          toast.error(`${f.label} は必須です`);
          return;
        }
      }
    }
    console.log('=== 必須項目チェック完了 ===');

    const url = new URL(window.location.href);
    const lineUserId = url.searchParams.get('line_user_id') || 
                       url.searchParams.get('lu') || 
                       url.searchParams.get('user_id');
    const shortUid = url.searchParams.get('uid') || url.searchParams.get('suid') || url.searchParams.get('s');

    console.log(`フォーム送信 - URL: ${window.location.href}`);
    console.log(`フォーム送信パラメーター: lineUserId=${lineUserId}, shortUid=${shortUid}`);
    console.log(`フォーム設定: require_line_friend=${form.require_line_friend}, user_id=${form.user_id}`);

    let friendId: string | null = null;
    let actualLineUserId: string | null = lineUserId;

    // UIDまたはLINE User IDが提供されている場合、友だちを特定する（require_line_friendに関係なく）
    if (shortUid || lineUserId) {
      let friendQuery = (supabase as any)
        .from('line_friends')
        .select('id, line_user_id, short_uid, display_name')
        .eq('user_id', form.user_id);
      
      if (shortUid) {
        friendQuery = friendQuery.eq('short_uid', shortUid);
        console.log(`短縮UIDで友だち検索: ${shortUid}`);
      } else {
        friendQuery = friendQuery.eq('line_user_id', lineUserId);
        console.log(`LINE User IDで友だち検索: ${lineUserId}`);
      }
      
      const { data: friend, error: fErr } = await friendQuery.maybeSingle();
      if (friend) {
        friendId = friend.id;
        actualLineUserId = friend.line_user_id;
        console.log(`友だちを特定: ${friend.display_name} (ID: ${friendId}, Short UID: ${friend.short_uid})`);
      } else {
        console.log('友だちが見つかりませんでした:', fErr);
        console.log(`検索クエリ: user_id=${form.user_id}, ${shortUid ? `short_uid=${shortUid}` : `line_user_id=${lineUserId}`}`);
      }
    }

    // LINE友だち限定チェック（require_line_friendがtrueの場合のみ）
    if (form.require_line_friend) {
      if (!friendId) {
        toast.error('このフォームはLINE友だち限定です。先に友だち追加してください。');
        return;
      }

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
      
    // フォーム送信（友だち情報を含めて保存）
    const { error } = await (supabase as any).from('form_submissions').insert({
      form_id: form.id,
      data: values,
      friend_id: friendId,
      line_user_id: actualLineUserId,
    });
    
    if (error) {
      console.error('フォーム送信エラー:', error);
      toast.error('送信に失敗しました');
      return;
    }
    
    console.log(`フォーム送信成功: friend_id=${friendId}, line_user_id=${actualLineUserId}`);
    
    setSubmitted(true);
    toast.success('送信しました');
    // TODO: 回答後シナリオ遷移の実行（安全な関数を用意してサーバー側で切替）
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
            <form className="space-y-4" onSubmit={handleSubmit} style={{ ['--form-accent' as any]: form.accent_color || '#0cb386' }}>
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
                  {(f.type === 'text' || f.type === 'email') && (
                    <Input id={f.name} name={f.name} type={f.type || 'text'} required={!!f.required} onChange={(e)=>handleChange(f.name, e.target.value)} />
                  )}
                  {f.type === 'select' && Array.isArray(f.options) && (
                    <Select onValueChange={(v)=>handleChange(f.name, v)}>
                      <SelectTrigger className="px-3"><SelectValue placeholder="選択してください" /></SelectTrigger>
                      <SelectContent className="bg-background z-[60]">
                        {(f.options || []).map((opt) => (opt ?? "").trim()).filter(Boolean).map((opt, i) => (
                          <SelectItem key={`${opt}-${i}`} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {f.type === 'radio' && Array.isArray(f.options) && (
                    <RadioGroup value={values[f.name] || ""} onValueChange={(v)=>handleChange(f.name, v)}>
                      <div className="flex flex-col gap-2">
                        {f.options.map((opt)=> (
                          <label key={opt} className="inline-flex items-center gap-2">
                            <RadioGroupItem value={opt} className="border-[var(--form-accent)] data-[state=checked]:bg-[var(--form-accent)] data-[state=checked]:text-white" />
                            <span>{opt}</span>
                          </label>
                        ))}
                      </div>
                    </RadioGroup>
                  )}
                  {f.type === 'checkbox' && Array.isArray(f.options) && (
                    <div className="flex flex-col gap-2">
                      {f.options.map((opt)=> {
                        const checked = Array.isArray(values[f.name]) && values[f.name].includes(opt);
                        return (
                          <label key={opt} className="inline-flex items-center gap-2">
                            <Checkbox
                              className="border-[var(--form-accent)] data-[state=checked]:bg-[var(--form-accent)] data-[state=checked]:text-white"
                              checked={!!checked}
                              onCheckedChange={(v)=>{
                                const prev: string[] = Array.isArray(values[f.name]) ? values[f.name] : [];
                                if (v === true) {
                                  handleChange(f.name, Array.from(new Set([...prev, opt])));
                                } else {
                                  handleChange(f.name, prev.filter((x)=> x !== opt));
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
              <Button type="submit" className="w-full" variant="default" style={{ backgroundColor: form.submit_button_bg_color || '#0cb386', color: form.submit_button_text_color || '#ffffff' }}>{form.submit_button_text || '送信'}</Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
