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
import { useToast } from "@/hooks/use-toast";
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
  const { toast } = useToast();

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

        // Parse fields from Json to FormField[] with proper type conversion
        const parsedFields = Array.isArray(data.fields) ? 
          (data.fields as unknown as FormField[]) : 
          [];
        const formDataTyped: FormData = {
          ...data,
          fields: parsedFields
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

  const handleInputChange = (fieldId: string, value: any) => {
    setFormValues(prev => ({
      ...prev,
      [fieldId]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData) return;

    // Validate required fields
    const missingFields = formData.fields
      .filter(field => field.required && !formValues[field.id])
      .map(field => field.label);

    if (missingFields.length > 0) {
      toast({
        title: "入力エラー",
        description: `以下の項目は必須です: ${missingFields.join(', ')}`,
        variant: "destructive"
      });
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
          user_agent: navigator.userAgent
        }
      };

      const { error: submitError } = await supabase
        .from('form_submissions')
        .insert(submissionData);

      if (submitError) {
        console.error('Submission error:', submitError);
        if (submitError.message.includes('既にこのフォームに回答済みです')) {
          setError('このフォームには既に回答いただいています。');
        } else if (submitError.message.includes('友だち限定')) {
          setError('このフォームはLINE友だち限定です。正しいリンクから開いてください。');
        } else {
          setError('送信に失敗しました。もう一度お試しください。');
        }
        return;
      }

      setSubmitted(true);
      toast({
        title: "送信完了",
        description: formData.success_message || "フォームを送信しました。",
      });

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
      required: field.required,
      placeholder: field.placeholder,
      value: formValues[field.id] || '',
      onChange: (e: any) => handleInputChange(field.id, e.target.value)
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
        return (
          <Textarea
            {...commonProps}
            onChange={(e) => handleInputChange(field.id, e.target.value)}
          />
        );
      
      case 'select':
        return (
          <Select
            value={formValues[field.id] || ''}
            onValueChange={(value) => handleInputChange(field.id, value)}
          >
            <SelectTrigger>
              <SelectValue placeholder={field.placeholder || '選択してください'} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option, index) => (
                <SelectItem key={index} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      
      case 'radio':
        return (
          <RadioGroup
            value={formValues[field.id] || ''}
            onValueChange={(value) => handleInputChange(field.id, value)}
          >
            {field.options?.map((option, index) => (
              <div key={index} className="flex items-center space-x-2">
                <RadioGroupItem value={option} id={`${field.id}-${index}`} />
                <Label htmlFor={`${field.id}-${index}`}>{option}</Label>
              </div>
            ))}
          </RadioGroup>
        );
      
      case 'checkbox':
        return (
          <div className="space-y-2">
            {field.options?.map((option, index) => (
              <div key={index} className="flex items-center space-x-2">
                <Checkbox
                  id={`${field.id}-${index}`}
                  checked={formValues[field.id]?.includes(option) || false}
                  onCheckedChange={(checked) => {
                    const currentValues = formValues[field.id] || [];
                    if (checked) {
                      handleInputChange(field.id, [...currentValues, option]);
                    } else {
                      handleInputChange(field.id, currentValues.filter((v: string) => v !== option));
                    }
                  }}
                />
                <Label htmlFor={`${field.id}-${index}`}>{option}</Label>
              </div>
            ))}
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

  if (error) {
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

  if (submitted) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="text-center">
            <h3 className="text-lg font-semibold mb-2">送信完了</h3>
            <div 
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
    <Card className={className}>
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">{formData.name}</h3>
            {formData.description && (
              <p className="text-muted-foreground">{formData.description}</p>
            )}
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

          {error && (
            <div className="text-destructive text-sm">{error}</div>
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