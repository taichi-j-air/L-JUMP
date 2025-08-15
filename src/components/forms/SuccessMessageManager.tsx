import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor } from "@/components/RichTextEditor";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Pencil, Plus, X } from "lucide-react";

interface SuccessMessage {
  id: string;
  name: string;
  content: string;
  isRich: boolean;
}

interface SuccessMessageManagerProps {
  successMessage: string;
  setSuccessMessage: (message: string) => void;
}

export function SuccessMessageManager({ successMessage, setSuccessMessage }: SuccessMessageManagerProps) {
  const [isRichEditor, setIsRichEditor] = useState(false);
  const [showManager, setShowManager] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [savedMessages, setSavedMessages] = useState<SuccessMessage[]>([]);
  const [editingMessage, setEditingMessage] = useState<SuccessMessage | null>(null);
  const [newMessageName, setNewMessageName] = useState("");
  const [newMessageContent, setNewMessageContent] = useState("");

  // Load saved messages from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('form-success-messages');
    if (saved) {
      try {
        setSavedMessages(JSON.parse(saved));
      } catch (error) {
        console.error('Failed to load saved messages:', error);
      }
    }
  }, []);

  // Save messages to localStorage
  const saveMessages = (messages: SuccessMessage[]) => {
    localStorage.setItem('form-success-messages', JSON.stringify(messages));
    setSavedMessages(messages);
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

  const handleSelectMessage = (message: SuccessMessage) => {
    setSuccessMessage(message.content);
    setIsRichEditor(message.isRich);
    setShowManager(false);
  };

  const handleDeleteMessage = (id: string) => {
    const updated = savedMessages.filter(msg => msg.id !== id);
    saveMessages(updated);
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
            <DialogTitle className="flex items-center justify-between">
              成功メッセージ管理
              <Button onClick={handleCreateNew} size="sm">
                <Plus className="h-4 w-4 mr-1" />
                新規作成
              </Button>
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {savedMessages.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                保存されたメッセージがありません
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>名前</TableHead>
                    <TableHead>プレビュー</TableHead>
                    <TableHead>選択</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {savedMessages.map((message) => (
                    <TableRow key={message.id}>
                      <TableCell className="font-medium">{message.name}</TableCell>
                      <TableCell>
                        <div 
                          className="text-sm max-w-xs truncate" 
                          dangerouslySetInnerHTML={{ __html: message.content.substring(0, 100) + '...' }}
                        />
                      </TableCell>
                      <TableCell>
                        <Button 
                          size="sm" 
                          onClick={() => handleSelectMessage(message)}
                        >
                          設定する
                        </Button>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => handleEditMessage(message)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => handleDeleteMessage(message.id)}
                          >
                            <X className="h-3 w-3" />
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