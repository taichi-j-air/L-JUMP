import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

interface FormEmbedSelectorProps {
  onInsert: (formHtml: string) => void;
  onClose: () => void;
}

export const FormEmbedSelector = ({ onInsert, onClose }: FormEmbedSelectorProps) => {
  const [forms, setForms] = useState<any[]>([]);
  const [selectedFormId, setSelectedFormId] = useState("");

  useEffect(() => {
    fetchForms();
  }, []);

  const fetchForms = async () => {
    try {
      const { data } = await supabase.from('forms').select('*').order('name');
      setForms(data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const handleInsert = () => {
    if (!selectedFormId) return;
    
    const selectedForm = forms.find(f => f.id === selectedFormId);
    if (!selectedForm) return;

    // フォーム埋め込み用のHTML（特殊なdata属性付き）
    const formHtml = `<div class="form-embed-container" data-form-id="${selectedFormId}" data-form-type="embedded">
      <div class="form-embed-placeholder">
        <h3>${selectedForm.name}</h3>
        <p>${selectedForm.description || 'フォームが埋め込まれます'}</p>
      </div>
    </div>`;

    onInsert(formHtml);
    onClose();
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>フォームを埋め込み</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">フォームを選択</label>
          <Select value={selectedFormId} onValueChange={setSelectedFormId}>
            <SelectTrigger>
              <SelectValue placeholder="フォームを選択してください" />
            </SelectTrigger>
            <SelectContent>
              {forms.map((form) => (
                <SelectItem key={form.id} value={form.id}>
                  {form.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={onClose}>
            キャンセル
          </Button>
          <Button onClick={handleInsert} disabled={!selectedFormId}>
            埋め込み
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};