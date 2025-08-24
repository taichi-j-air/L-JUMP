import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { X, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface StepMessage {
  id?: string;
  message_type: "text" | "image" | "flex" | "restore_access";
  content: string;
  media_url?: string | null;
  flex_message_id?: string | null;
  message_order: number;
  restore_config?: {
    type: "button" | "image";
    title?: string;
    button_text?: string;
    target_scenario_id?: string;
  };
}

interface StepMessageEditorProps {
  stepId: string;
  messages: StepMessage[];
  onMessagesChange: (messages: StepMessage[]) => void;
}

export default function StepMessageEditor({ 
  stepId, 
  messages, 
  onMessagesChange 
}: StepMessageEditorProps) {
  const [scenarios, setScenarios] = useState<any[]>([]);
  const [flexMessages, setFlexMessages] = useState<any[]>([]);

  useEffect(() => {
    fetchScenarios();
    fetchFlexMessages();
  }, []);

  const fetchScenarios = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('step_scenarios')
        .select('*')
        .eq('user_id', user.id)
        .order('name');
      setScenarios(data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchFlexMessages = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('flex_messages')
        .select('*')
        .eq('user_id', user.id)
        .order('name');
      setFlexMessages(data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const addMessage = () => {
    const newMessage: StepMessage = {
      message_type: "text",
      content: "",
      message_order: messages.length,
    };
    onMessagesChange([...messages, newMessage]);
  };

  const updateMessage = async (index: number, updates: Partial<StepMessage>) => {
    const message = messages[index];
    if (!message.id) {
      // Local update for new messages
      const updated = messages.map((msg, i) => 
        i === index ? { ...msg, ...updates } : msg
      );
      onMessagesChange(updated);
      return;
    }

    // Database update for existing messages
    try {
      const payload: any = {
        message_type: updates.message_type || message.message_type,
        content: updates.content !== undefined ? updates.content : message.content,
        media_url: updates.media_url !== undefined ? updates.media_url : message.media_url,
        flex_message_id: updates.flex_message_id !== undefined ? updates.flex_message_id : message.flex_message_id,
        message_order: updates.message_order !== undefined ? updates.message_order : message.message_order,
      };

      if (updates.restore_config !== undefined) {
        payload.restore_config = updates.restore_config;
      }

      const { error } = await supabase
        .from('step_messages')
        .update(payload)
        .eq('id', message.id);

      if (error) throw error;

      // Update local state
      const updated = messages.map((msg, i) => 
        i === index ? { ...msg, ...updates } : msg
      );
      onMessagesChange(updated);
      toast.success('メッセージを更新しました');
    } catch (error) {
      console.error('Error updating message:', error);
      toast.error('メッセージの更新に失敗しました');
    }
  };

  const removeMessage = async (index: number) => {
    const message = messages[index];
    if (!message.id) {
      // Local removal for new messages
      const filtered = messages.filter((_, i) => i !== index)
        .map((msg, i) => ({ ...msg, message_order: i }));
      onMessagesChange(filtered);
      return;
    }

    try {
      const { error } = await supabase
        .from('step_messages')
        .delete()
        .eq('id', message.id);

      if (error) throw error;

      const filtered = messages.filter((_, i) => i !== index)
        .map((msg, i) => ({ ...msg, message_order: i }));
      onMessagesChange(filtered);
      toast.success('メッセージを削除しました');
    } catch (error) {
      console.error('Error deleting message:', error);
      toast.error('メッセージの削除に失敗しました');
    }
  };

  const moveMessage = async (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= messages.length) return;

    const reordered = [...messages];
    [reordered[index], reordered[newIndex]] = [reordered[newIndex], reordered[index]];
    
    // Update message_order
    const updated = reordered.map((msg, i) => ({ ...msg, message_order: i }));
    onMessagesChange(updated);

    // Update database if messages have IDs
    try {
      for (const msg of updated) {
        if (msg.id) {
          const { error } = await supabase
            .from('step_messages')
            .update({ message_order: msg.message_order })
            .eq('id', msg.id);

          if (error) throw error;
        }
      }
    } catch (error) {
      console.error('Error reordering messages:', error);
      toast.error('メッセージの並び替えに失敗しました');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">メッセージ設定</h3>
        <Button onClick={addMessage} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          メッセージ追加
        </Button>
      </div>

      {messages.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          メッセージが設定されていません。「メッセージ追加」ボタンで追加してください。
        </p>
      ) : (
        <div className="space-y-3">
          {messages.map((message, index) => (
            <Card key={index}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    メッセージ {index + 1}
                    {message.message_type === "restore_access" && (
                      <Badge className="bg-green-100 text-green-800 text-xs">
                        アクセス解除＆シナリオ再登録
                      </Badge>
                    )}
                  </CardTitle>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => moveMessage(index, 'up')}
                      disabled={index === 0}
                    >
                      ↑
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => moveMessage(index, 'down')}
                      disabled={index === messages.length - 1}
                    >
                      ↓
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeMessage(index)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label>メッセージタイプ</Label>
                  <Select
                    value={message.message_type}
                    onValueChange={(value: any) => updateMessage(index, { message_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">テキストメッセージ</SelectItem>
                      <SelectItem value="image">画像メッセージ</SelectItem>
                      <SelectItem value="flex">Flexメッセージ</SelectItem>
                      <SelectItem value="restore_access">
                        <div className="flex items-center gap-2 bg-green-50 px-2 py-1 rounded-md">
                          <span className="inline-block w-2 h-2 bg-green-500 rounded-full"></span>
                          <span className="text-green-800 font-medium">アクセス解除＆シナリオ再登録</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {message.message_type === "restore_access" && (
                  <div className="space-y-4 p-4 bg-green-50 rounded-lg border border-green-200">
                    <div className="space-y-2">
                      <Label>復活ボタンタイプ</Label>
                      <Select
                        value={message.restore_config?.type || "button"}
                        onValueChange={(value: "button" | "image") => 
                          updateMessage(index, {
                            restore_config: { ...message.restore_config, type: value }
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="button">単一ボタン</SelectItem>
                          <SelectItem value="image">画像（リッチメッセージ）</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {message.restore_config?.type === "button" && (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label>タイトル</Label>
                          <Input
                            value={message.restore_config?.title || ""}
                            onChange={(e) => 
                              updateMessage(index, {
                                restore_config: { ...message.restore_config, title: e.target.value }
                              })
                            }
                            placeholder="復活メッセージのタイトル"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>ボタンテキスト</Label>
                          <Input
                            value={message.restore_config?.button_text || ""}
                            onChange={(e) => 
                              updateMessage(index, {
                                restore_config: { ...message.restore_config, button_text: e.target.value }
                              })
                            }
                            placeholder="復活ボタンのテキスト"
                          />
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label>再登録先シナリオ</Label>
                      <Select
                        value={message.restore_config?.target_scenario_id || ""}
                        onValueChange={(value) => 
                          updateMessage(index, {
                            restore_config: { ...message.restore_config, target_scenario_id: value }
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="シナリオを選択" />
                        </SelectTrigger>
                        <SelectContent>
                          {scenarios.map((scenario) => (
                            <SelectItem key={scenario.id} value={scenario.id}>
                              {scenario.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {message.message_type === "text" && (
                  <div className="space-y-2">
                    <Label>メッセージ内容</Label>
                    <Textarea
                      value={message.content}
                      onChange={(e) => updateMessage(index, { content: e.target.value })}
                      placeholder="メッセージ内容を入力してください"
                      rows={3}
                    />
                  </div>
                )}

                {message.message_type === "image" && (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label>画像URL</Label>
                      <Input
                        value={message.media_url || ""}
                        onChange={(e) => updateMessage(index, { media_url: e.target.value })}
                        placeholder="https://example.com/image.jpg"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>代替テキスト</Label>
                      <Input
                        value={message.content}
                        onChange={(e) => updateMessage(index, { content: e.target.value })}
                        placeholder="画像の説明テキスト"
                      />
                    </div>
                  </div>
                )}

                {message.message_type === "flex" && (
                  <div className="space-y-2">
                    <Label>Flexメッセージ</Label>
                    <Select
                      value={message.flex_message_id || ""}
                      onValueChange={(value) => updateMessage(index, { flex_message_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Flexメッセージを選択" />
                      </SelectTrigger>
                      <SelectContent>
                        {flexMessages.map((flex) => (
                          <SelectItem key={flex.id} value={flex.id}>
                            {flex.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}