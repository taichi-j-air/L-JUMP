import React, { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import DOMPurify from "dompurify";
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
}

export default function FormEmbedComponent({ formId, uid, className }: FormEmbedComponentProps) {
  const [formData, setFormData] = useState<FormData | null>(null);
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rootClass = `not-prose ${className ?? ''}`;
  const accentStyle = formData ? ({ ['--form-accent' as any]: formData.accent_color || '#0cb386' }) : undefined;
  const accentInputRing =
    'focus-visible:ring-[var(--form-accent)] focus-visible:ring-2 focus-visible:ring-offset-2';

  useEffect(() => {
    const fetchFormData = async () => {
      try {
        const { data, error } = await supabase
          .from('forms')
          .select('*')
          .eq('id', formId)
          .eq('is_public', true)
          .single();

        if (error) {
          console.error('Error fetching form:', error);
          setError('フォームが見つかりません');
          return;
        }

        const parsedFields = Array.isArray(data.fields)
          ? (data.fields as unknown as FormField[])
          : [];

        setFormData({ ...data, fields: parsedFields });
      } catch (err) {
        console.error('Error:', err);
        setError('フォームの読み込みに失敗しました');
      } finally {
        setLoading(false);
      }
    };

    fetchFormData();
  }, [formId]);

  const handleInputChange = (fieldId: string, value: any) => {
    setFormValues(prev => ({ ...prev, [fieldId]: value }));
    if (error) setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData) return;

    const missingLabels = formData.fields
      .filter(f => f.required)
      .filter(f => {
        const v = formValues[f.id];
        if (f.type === 'checkbox') return !Array.isArray(v) || v.length === 0;
        return v == null || String(v).trim() === '';
      })
      .map(f => f.label);

    if (missingLabels.length > 0) {
      setError(`以下の項目は必須です: ${missingLabels.join(', ')}`);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const submissionData = {
        form_id: formId,
        data: formValues,
        meta: {
          source_uid: uid,
          timestamp: new Date().toISOString(),
          user_agent: navigator.userAgent,
        },
      };

      const { error: submitError } = await supabase
        .from('form_submissions')
        .insert(submissionData);

      if (submitError) {
        console.error('Submission error:', submitError);
        if (submitError.message?.includes('既にこのフォームに回答済みです')) {
          setError('このフォームには既に回答いただいています。');
        } else if (submitError.message?.includes('友だち限定')) {
          setError('このフォームはLINE友だち限定です。正しいリンクから開いてください。');
        } else {
          setError('送信に失敗しました。もう一度お試しください。');
        }
        return;
      }

      // ✅ 右下トーストは使わない（全端末/埋め込み・単体問わず非表示）
      setSubmitted(true);
    } catch (err) {
      console.error('Submit error:', err);
      setError('送信に失敗しました。もう一度お試しください。');
    } finally {
      setSubmitting(false);
    }
  };

  const renderField = (field: FormField) => {
    switch (field.type) {
      case 'text':
        return (
          <Input
            id={field.id}
            required={field.required}
            placeholder={field.placeholder}
            value={formValues[field.id] ?? ''}
            onChange={(e) => handleInputChange(field.id, e.target.value)}
            className={accentInputRing}
          />
        );
      case 'email':
        return (
          <Input
            id={field.id}
            type="email"
            required={field.required}
            placeholder={field.placeholder}
            value={formValues[field.id] ?? ''}
            onChange={(e) => handleInputChange(field.id, e.target.value)}
            className={accentInputRing}
          />
        );
      case 'tel':
        return (
          <Input
            id={field.id}
            type="tel"
            required={field.required}
            placeholder={field.placeholder}
            value={formValues[field.id] ?? ''}
            onChange={(e) => handleInputChange(field.id, e.target.value)}
            className={accentInputRing}
          />
        );
      case 'number':
        return (
          <Input
            id={field.id}
            type="number"
            required={field.required}
            placeholder={field.placeholder}
            value={formValues[field.id] ?? ''}
            onChange={(e) => handleInputChange(field.id, e.target.value)}
            className={accentInputRing}
          />
        );
      case 'textarea':
        return (
          <Textarea
            id={field.id}
            required={field.required}
            placeholder={field.placeholder}
            value={formValues[field.id] ?? ''}
            onChange={(e) => handleInputChange(field.id, e.target.value)}
            className={accentInputRing}
          />
        );
      case 'select':
        return (
          <Select
            value={formValues[field.id] ?? ''}
            onValueChange={(value) => handleInputChange(field.id, value)}
          >
            <SelectTrigger className={accentInputRing}>
              <SelectValue placeholder={field.placeholder || '選択してください'} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option, index) => (
                <SelectItem
                  key={index}
                  value={option}
                  className="
                    data-[state=checked]:bg-[var(--form-accent)]
                    data-[state=checked]:text-white
                    focus:bg-[var(--form-accent)]
                    focus:text-white
                  "
                >
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case 'radio':
        return (
          <RadioGroup
            value={formValues[field.id] ?? ''}
            onValueChange={(value) => handleInputChange(field.id, value)}
          >
            {field.options?.map((option, index) => (
              <div key={index} className="flex items-center space-x-2">
                <RadioGroupItem
                  value={option}
                  id={`${field.id}-${index}`}
                  className="
                    border-[var(--form-accent)]
                    data-[state=checked]:bg-[var(--form-accent)]
                    data-[state=checked]:text-white
                  "
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
              const curr: string[] = Array.isArray(formValues[field.id]) ? formValues[field.id] : [];
              const checked = curr.includes(option);
              return (
                <div key={index} className="flex items-center space-x-2">
                  <Checkbox
                    id={`${field.id}-${index}`}
                    checked={checked}
                    onCheckedChange={(v) => {
                      const next = new Set(curr);
                      if (v === true) next.add(option);
                      else next.delete(option);
                      handleInputChange(field.id, Array.from(next));
                    }}
                    className="
                      border-[var(--form-accent)]
                      data-[state=checked]:bg-[var(--form-accent)]
                      data-[state=checked]:text-white
                    "
                  />
                  <Label htmlFor={`${field.id}-${index}`}>{option}</Label>
                </div>
              );
            })}
          </div>
        );
      default:
        return (
          <Input
            id={field.id}
            required={field.required}
            placeholder={field.placeholder}
            value={formValues[field.id] ?? ''}
            onChange={(e) => handleInputChange(field.id, e.target.value)}
            className={accentInputRing}
          />
        );
    }
  };

  if (loading) {
    return (
      <Card className={rootClass}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">フォームを読み込んでいます...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={rootClass}>
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
      <Card className={rootClass}>
        <CardContent className="p-6">
          <div className="text-center">
            <p>フォームが見つかりません</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (submitted) {
    return (
      <Card className={rootClass} style={accentStyle}>
        <CardContent className="p-6">
          <div className="text-center">
            <h3 className="text-lg font-semibold mb-2">送信完了</h3>
            <div
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(
                  formData.success_message || "フォームを送信しました。ありがとうございました。"
                ),
              }}
            />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={rootClass} style={accentStyle}>
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">{formData.name}</h3>
            {formData.description && <p className="text-muted-foreground">{formData.description}</p>}
          </div>

          <div className="space-y-4">
            {formData.fields.map((field) => (
              <div key={field.id} className="space-y-2">
                <Label htmlFor={field.id}>
                  {field.label}
                  {field.required && <span className="text-destructive ml-1">*</span>}
                </Label>
                {renderField(field)}
              </div>
            ))}
          </div>

          {error && <div className="text-destructive text-sm">{error}</div>}

          <Button
            type="submit"
            disabled={submitting}
            className="w-full"
            style={{ backgroundColor: formData.submit_button_bg_color, color: formData.submit_button_text_color }}
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
