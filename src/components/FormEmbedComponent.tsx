import React, { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface FormEmbedComponentProps {
  formId: string;
  uid?: string;
  className?: string;
}

interface FormField {
  id: string;
  name: string;
  type: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: string[];
}

interface FormData {
  id: string;
  name: string;
  description?: string;
  fields: FormField[];
  success_message: string;
  submit_button_text: string;
  submit_button_bg_color: string;
  submit_button_text_color: string;
  accent_color: string;
  require_line_friend: boolean;
  prevent_duplicate_per_friend: boolean;
  is_public: boolean;
}

export default function FormEmbedComponent({ formId, uid, className }: FormEmbedComponentProps) {
  const [formData, setFormData] = useState<FormData | null>(null);
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFormData = async () => {
      try {
        const { data, error } = await supabase
          .from('forms')
          .select('*')
          .eq('id', formId)
          .maybeSingle();

        if (error || !data) {
          console.error('Error fetching form:', error);
          setError('フォームが見つかりません');
          return;
        }

        if (!data.is_public && !uid) {
          setError('このフォームは外部公開がオフのため表示できません。フォーム編集画面で「外部公開」をオンにしてください。');
          return;
        }

        const parsedFields = Array.isArray(data.fields)
          ? (data.fields as unknown as FormField[])
          : [];

        const formDataTyped: FormData = {
          ...data,
          fields: parsedFields,
          is_public: data.is_public
        };

        setFormData(formDataTyped);
      } catch (err) {
        console.error('Error:', err);
        setError('フォームの読み込みに失敗しました');
      } finally {
        setLoading(false);
      }
    };

    fetchFormData();
  }, [formId]);

  const handleInputChange = (fieldName: string, value: any) => {
    setFormValues(prev => ({
      ...prev,
      [fieldName]: value
    }));
  };

  const validateRequired = (fields: FormField[]) => {
    const missing = fields.filter(field => {
      if (!field.required) return false;
      const v = formValues[field.name];
      if (field.type === 'checkbox') return !Array.isArray(v) || v.length === 0;
      return v == null || String(v).trim() === '';
    });
    return missing.map(f => f.label);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData) return;

    const missingLabels = validateRequired(formData.fields);
    if (missingLabels.length > 0) {
      setError(`以下の項目は必須です: ${missingLabels.join(', ')}`);
      return;
    }

    setSubmitting(true);
    try {
      const submissionData = {
        form_id: formId,
        data: formValues,
        meta: {
          source_uid: uid,
          timestamp: new Date().toISOString(),
          user_agent: navigator.userAgent
        }
      };

      const { error: submitError } = await supabase
        .from('form_submissions')
        .insert(submissionData);

      if (submitError) {
        console.error('Submission error:', submitError);
        if (submitError.code === '23505') {
          setError('既に回答済の為、送信できません。');
        } else if (submitError.message?.includes('友だち限定')) {
          setError('このフォームはLINE友だち限定です。正しいリンクから開いてください。');
        } else {
          setError('送信に失敗しました。もう一度お試しください。');
        }
        return;
      }

      // 成功トーストは出さない（右下の吹き出しを完全排除）
      setSubmitted(true);
    } catch (err) {
      console.error('Submit error:', err);
      setError('送信に失敗しました。もう一度お試しください。');
    } finally {
      setSubmitting(false);
    }
  };

  const renderField = (field: FormField) => {
    const commonProps = {
      id: field.id,
      name: field.name,
      required: field.required,
      placeholder: field.placeholder,
      value: formValues[field.name] ?? '',
      onChange: (e: any) => handleInputChange(field.name, e.target.value)
    };

    switch (field.type) {
      case 'text':
        return <Input {...commonProps} type="text" />;
      case 'email':
        return <Input {...commonProps} type="email" />;
      case 'tel':
        return <Input {...commonProps} type="tel" />;
      case 'number':
        return <Input {...commonProps} type="number" />;
      case 'textarea':
        return <Textarea {...commonProps} onChange={(e) => handleInputChange(field.name, e.target.value)} />;
      case 'select':
        return (
          <Select value={formValues[field.name] ?? ''} onValueChange={(value) => handleInputChange(field.name, value)}>
            <SelectTrigger>
              <SelectValue placeholder={field.placeholder || '選択してください'} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option, index) => (
                <SelectItem key={index} value={option}>{option}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case 'radio':
        return (
          <RadioGroup value={formValues[field.name] ?? ''} onValueChange={(value) => handleInputChange(field.name, value)}>
            {field.options?.map((option, index) => (
              <div key={index} className="flex items-center space-x-2">
                <RadioGroupItem
                  value={option}
                  id={`${field.id}-${index}`}
                  className="border-[var(--form-accent)] data-[state=checked]:bg-[var(--form-accent)] data-[state=checked]:text-white"
                />
                <Label htmlFor={`${field.id}-${index}`}>{option}</Label>
              </div>
            ))}
          </RadioGroup>
        );
      case 'checkbox':
        return (
          <div className="space-y-2">
            {field.options?.map((option, index) => {
              const checked = Array.isArray(formValues[field.name]) && formValues[field.name].includes(option);
              return (
                <div key={index} className="flex items-center space-x-2">
                  <Checkbox
                    id={`${field.id}-${index}`}
                    checked={checked}
                    className="border-[var(--form-accent)] data-[state=checked]:bg-[var(--form-accent)] data-[state=checked]:text-white"
                    onCheckedChange={(isChecked) => {
                      const prev = Array.isArray(formValues[field.name]) ? [...formValues[field.name]] : [];
                      if (isChecked === true) {
                        handleInputChange(field.name, Array.from(new Set([...prev, option])));
                      } else {
                        handleInputChange(field.name, prev.filter((v: string) => v !== option));
                      }
                    }}
                  />
                  <Label htmlFor={`${field.id}-${index}`}>{option}</Label>
                </div>
              );
            })}
          </div>
        );
      default:
        return <Input {...commonProps} type="text" />;
    }
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">フォームを読み込んでいます...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error && !formData) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="text-center">
            <p className="text-destructive">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!formData) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="text-center">
            <p>フォームが見つかりません</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // 送信後の表示（中央だけに完了メッセージを出す／吹き出しなし）
  if (submitted) {
    return (
      <Card className={className} style={{ ['--form-accent' as any]: formData.accent_color || '#0cb386' }}>
        <CardContent className="p-6">
          <div className="text-center">
            <h3 className="text-lg font-semibold mb-2">送信完了</h3>
            <div
              className="prose max-w-none break-words"
              dangerouslySetInnerHTML={{
                __html: formData.success_message || "フォームを送信しました。ありがとうございました。"
              }}
            />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`${className} border-gray-300`} style={{ ['--form-accent' as any]: formData.accent_color || '#0cb386' }}>
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">{formData.name}</h3>
            {formData.description && (
              <p className="text-muted-foreground whitespace-pre-wrap">{formData.description}</p>
            )}
          </div>

          <div className="space-y-4">
            {formData.fields.map((field) => (
              <div key={field.id} className="space-y-2">
                <Label htmlFor={field.id}>
                  {field.label}
                  {field.required && (
                    <span className="ml-1 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] bg-destructive text-destructive-foreground align-middle">
                      必須
                    </span>
                  )}
                </Label>
                {renderField(field)}
              </div>
            ))}
          </div>

          {/* インラインエラー（吹き出しは使わない） */}
          {error && (
            <div className="text-destructive text-sm" aria-live="polite">
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={submitting}
            className="w-full"
            style={{
              backgroundColor: formData.submit_button_bg_color,
              color: formData.submit_button_text_color
            }}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                送信中...
              </>
            ) : (
              formData.submit_button_text
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
