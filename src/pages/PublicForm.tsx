import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface PublicFormRow {
  id: string;
  name: string;
  description: string | null;
  is_public: boolean;
  success_message: string | null;
  fields: Array<{ id: string; label: string; name: string; type: string; required?: boolean }>;
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
  const [values, setValues] = useState<Record<string, string>>({});
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
        .select('id,name,description,fields,success_message,is_public')
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

  const handleChange = (name: string, value: string) => {
    setValues(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;

    // Basic required validation
    for (const f of form.fields) {
      if (f.required && !values[f.name]) {
        toast.error(`${f.label} は必須です`);
        return;
      }
    }

    const { error } = await (supabase as any).from('form_submissions').insert({
      form_id: form.id,
      data: values,
    });
    if (error) {
      console.error(error);
      toast.error('送信に失敗しました');
    } else {
      setSubmitted(true);
      toast.success('送信しました');
    }
  };

  if (loading) return <div className="container mx-auto max-w-3xl p-4">読み込み中...</div>;
  if (!form) return <div className="container mx-auto max-w-3xl p-4">フォームが見つかりません</div>;
  if (!form.is_public) return <div className="container mx-auto max-w-3xl p-4">このフォームは非公開です</div>;

  return (
    <div className="container mx-auto max-w-3xl p-4">
      <Card>
        <CardHeader>
          <CardTitle asChild>
            <h1 className="text-2xl font-bold tracking-tight">{form.name}</h1>
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
              {form.fields.map((f) => (
                <div key={f.id} className="space-y-2">
                  <label className="text-sm font-medium" htmlFor={f.name}>
                    {f.label}{f.required && <span aria-hidden className="ml-1">*</span>}
                  </label>
                  {f.type === 'textarea' ? (
                    <Textarea id={f.name} name={f.name} required={!!f.required} onChange={(e)=>handleChange(f.name, e.target.value)} />
                  ) : (
                    <Input id={f.name} name={f.name} type={f.type || 'text'} required={!!f.required} onChange={(e)=>handleChange(f.name, e.target.value)} />
                  )}
                </div>
              ))}
              <Button type="submit" className="w-full">送信</Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
