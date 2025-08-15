import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor } from "@/components/RichTextEditor";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Plus, X, Trash2 } from "lucide-react";

interface SuccessMessage {
  id: string;
  name: string;
  content: string;
  isRich: boolean;
}

interface SuccessMessageManagerProps {
  successMessage: string;
  setSuccessMessage: (message: string) => void;
  formId?: string; // To track per-form selection
}

export function SuccessMessageManager({ successMessage, setSuccessMessage, formId = 'default' }: SuccessMessageManagerProps) {
  const [isRichEditor, setIsRichEditor] = useState(false);
  const [showManager, setShowManager] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [savedMessages, setSavedMessages] = useState<SuccessMessage[]>([]);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [editingMessage, setEditingMessage] = useState<SuccessMessage | null>(null);
  const [newMessageName, setNewMessageName] = useState("");
  const [newMessageContent, setNewMessageContent] = useState("");

  // Load saved messages from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('form-success-messages');
    const savedSelections = localStorage.getItem('form-success-selections');
    
    if (saved) {
      try {
        setSavedMessages(JSON.parse(saved));
      } catch (error) {
        console.error('Failed to load saved messages:', error);
      }
    }
    
    if (savedSelections) {
      try {
        const selections = JSON.parse(savedSelections);
        const currentSelection = selections[formId];
        if (currentSelection) {
          setSelectedMessageId(currentSelection);
          setIsRichEditor(true);
        }
      } catch (error) {
        console.error('Failed to load saved selections:', error);
      }
    }
  }, [formId]);

  // Save messages to localStorage
  const saveMessages = (messages: SuccessMessage[]) => {
    localStorage.setItem('form-success-messages', JSON.stringify(messages));
    setSavedMessages(messages);
  };

  // Save selection per form
  const saveSelection = (messageId: string | null) => {
    const saved = localStorage.getItem('form-success-selections');
    let selections = {};
    if (saved) {
      try {
        selections = JSON.parse(saved);
      } catch (error) {
        console.error('Failed to load selections:', error);
      }
    }
    
    if (messageId) {
      selections[formId] = messageId;
    } else {
      delete selections[formId];
    }
    
    localStorage.setItem('form-success-selections', JSON.stringify(selections));
    setSelectedMessageId(messageId);
  };

  const handleCreateNew = () => {
    setEditingMessage(null);
    setNewMessageName("");
    setNewMessageContent("");
    setShowEditor(true);
  };

  const handleEditMessage = (message: SuccessMessage) => {
    setEditingMessage(message);
    setNewMessageName(message.name);
    setNewMessageContent(message.content);
    setShowEditor(true);
  };

  const handleSaveMessage = () => {
    if (!newMessageName.trim()) return;
    
    const messageData: SuccessMessage = {
      id: editingMessage?.id || Date.now().toString(),
      name: newMessageName,
      content: newMessageContent,
      isRich: true
    };

    if (editingMessage) {
      // Update existing message
      const updated = savedMessages.map(msg => 
        msg.id === editingMessage.id ? messageData : msg
      );
      saveMessages(updated);
    } else {
      // Create new message
      saveMessages([...savedMessages, messageData]);
    }
    
    setShowEditor(false);
  };

  const handleToggleMessage = (message: SuccessMessage, isSelected: boolean) => {
    if (isSelected) {
      setSuccessMessage(message.content);
      saveSelection(message.id);
    } else {
      setSuccessMessage("");
      saveSelection(null);
    }
  };

  const handleDeleteMessage = (id: string) => {
    const updated = savedMessages.filter(msg => msg.id !== id);
    saveMessages(updated);
    
    // If deleting the currently selected message, clear selection
    if (selectedMessageId === id) {
      setSuccessMessage("");
      saveSelection(null);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm">送信成功メッセージ</label>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">リッチエディタ</span>
          <Switch 
            checked={isRichEditor} 
            onCheckedChange={(checked) => {
              setIsRichEditor(checked);
              if (checked) {
                setShowManager(true);
              } else {
                // Clear selection when switching to plain text
                setSuccessMessage("");
                saveSelection(null);
              }
            }} 
          />
        </div>
      </div>

      {isRichEditor ? (
        <Button 
          variant="outline" 
          onClick={() => setShowManager(true)}
          className="w-full"
        >
          フォーム成功画面の新規作成
        </Button>
      ) : (
        <Textarea 
          value={successMessage} 
          onChange={(e) => setSuccessMessage(e.target.value)}
          rows={3}
          placeholder="送信完了メッセージを入力してください"
        />
      )}

      {/* Success Message Manager Dialog */}
      <Dialog open={showManager} onOpenChange={setShowManager}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between pr-8">
              <span>成功メッセージ管理</span>
              <Button onClick={handleCreateNew} size="sm" className="mr-4">
                <Plus className="h-4 w-4 mr-1" />
                新規作成
              </Button>
            </DialogTitle>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setShowManager(false)}
              className="absolute top-2 right-2 text-destructive font-bold text-lg hover:bg-destructive/10"
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogHeader>
          
          <div className="space-y-2">
            {savedMessages.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">
                保存されたメッセージがありません
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="text-xs">
                    <TableHead className="w-12 text-xs">選択</TableHead>
                    <TableHead className="text-xs">名前</TableHead>
                    <TableHead className="text-xs">プレビュー</TableHead>
                    <TableHead className="w-24 text-xs">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {savedMessages.map((message) => (
                    <TableRow key={message.id} className="h-12">
                      <TableCell className="py-2">
                        <Switch 
                          checked={selectedMessageId === message.id}
                          onCheckedChange={(checked) => handleToggleMessage(message, checked)}
                        />
                      </TableCell>
                      <TableCell className="font-medium text-sm py-2">{message.name}</TableCell>
                      <TableCell className="py-2">
                        <div 
                          className="text-xs max-w-xs truncate" 
                          dangerouslySetInnerHTML={{ __html: message.content.substring(0, 60) + '...' }}
                        />
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="flex gap-1">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => handleEditMessage(message)}
                            className="h-7 px-2 text-xs"
                          >
                            編集
                          </Button>
                          <Button 
                            size="sm" 
                            variant="destructive" 
                            onClick={() => handleDeleteMessage(message.id)}
                            className="h-7 px-2"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Message Editor Dialog */}
      <Dialog open={showEditor} onOpenChange={setShowEditor}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingMessage ? 'メッセージを編集' : '新しいメッセージを作成'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">メッセージ名</label>
              <Input 
                value={newMessageName}
                onChange={(e) => setNewMessageName(e.target.value)}
                placeholder="メッセージの名前を入力"
              />
            </div>
            
            <div className="space-y-1">
              <label className="text-sm font-medium">メッセージ内容</label>
              <RichTextEditor 
                value={newMessageContent}
                onChange={setNewMessageContent}
                className="min-h-[300px]"
              />
            </div>
            
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowEditor(false)}>
                キャンセル
              </Button>
              <Button onClick={handleSaveMessage} disabled={!newMessageName.trim()}>
                {editingMessage ? '更新' : '新規保存'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}