import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Eye, Send, Plus, Trash2, Image, MessageSquare, MousePointer } from "lucide-react";

interface FlexMessage {
  id: string;
  name: string;
  type: 'bubble' | 'carousel';
  content: any;
  created_at: string;
  updated_at: string;
}

interface BubbleContent {
  title: string;
  subtitle: string;
  text: string;
  imageUrl: string;
  buttons: Array<{
    type: 'message' | 'uri' | 'postback';
    label: string;
    text?: string;
    uri?: string;
    data?: string;
  }>;
}

const FlexMessageDesigner = () => {
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [messages, setMessages] = useState<FlexMessage[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<FlexMessage | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  
  // フォーム状態
  const [messageName, setMessageName] = useState("");
  const [messageType, setMessageType] = useState<'bubble' | 'carousel'>('bubble');
  const [bubbleContent, setBubbleContent] = useState<BubbleContent>({
    title: "",
    subtitle: "",
    text: "",
    imageUrl: "",
    buttons: []
  });

  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAuthAndLoadMessages();
  }, []);

  const checkAuthAndLoadMessages = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/auth");
        return;
      }

      // 今後、データベースからFlexメッセージを読み込む
      // 現在はサンプルデータを表示
      setMessages([]);
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "エラー",
        description: "データの読み込みに失敗しました",
        variant: "destructive",
      });
    } finally {
      setInitialLoading(false);
    }
  };

  const addButton = () => {
    if (bubbleContent.buttons.length >= 4) {
      toast({
        title: "制限エラー",
        description: "ボタンは最大4個まで追加できます",
        variant: "destructive",
      });
      return;
    }

    setBubbleContent(prev => ({
      ...prev,
      buttons: [
        ...prev.buttons,
        {
          type: 'message',
          label: '',
          text: ''
        }
      ]
    }));
  };

  const removeButton = (index: number) => {
    setBubbleContent(prev => ({
      ...prev,
      buttons: prev.buttons.filter((_, i) => i !== index)
    }));
  };

  const updateButton = (index: number, field: string, value: string) => {
    setBubbleContent(prev => ({
      ...prev,
      buttons: prev.buttons.map((button, i) => 
        i === index ? { ...button, [field]: value } : button
      )
    }));
  };

  const generateFlexJson = () => {
    const flexMessage = {
      type: "flex",
      altText: bubbleContent.title || "Flexメッセージ",
      contents: {
        type: "bubble",
        hero: bubbleContent.imageUrl ? {
          type: "image",
          url: bubbleContent.imageUrl,
          size: "full",
          aspectRatio: "20:13",
          aspectMode: "cover"
        } : undefined,
        body: {
          type: "box",
          layout: "vertical",
          contents: [
            bubbleContent.title ? {
              type: "text",
              text: bubbleContent.title,
              weight: "bold",
              size: "xl"
            } : undefined,
            bubbleContent.subtitle ? {
              type: "text",
              text: bubbleContent.subtitle,
              size: "sm",
              color: "#666666",
              margin: "md"
            } : undefined,
            bubbleContent.text ? {
              type: "text",
              text: bubbleContent.text,
              size: "sm",
              color: "#666666",
              margin: "md",
              wrap: true
            } : undefined
          ].filter(Boolean)
        },
        footer: bubbleContent.buttons.length > 0 ? {
          type: "box",
          layout: "vertical",
          spacing: "sm",
          contents: bubbleContent.buttons.map(button => ({
            type: "button",
            style: "link",
            height: "sm",
            action: {
              type: button.type,
              label: button.label,
              ...(button.type === 'message' && { text: button.text }),
              ...(button.type === 'uri' && { uri: button.uri }),
              ...(button.type === 'postback' && { data: button.data })
            }
          }))
        } : undefined
      }
    };

    return flexMessage;
  };

  const saveMessage = async () => {
    if (!messageName.trim()) {
      toast({
        title: "入力エラー",
        description: "メッセージ名を入力してください",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const flexJson = generateFlexJson();
      
      // 今後、データベースに保存する機能を実装
      console.log('Flex Message JSON:', JSON.stringify(flexJson, null, 2));
      
      toast({
        title: "成功",
        description: "Flexメッセージを保存しました",
      });

      // フォームをリセット
      setMessageName("");
      setBubbleContent({
        title: "",
        subtitle: "",
        text: "",
        imageUrl: "",
        buttons: []
      });
    } catch (error) {
      console.error('Error saving message:', error);
      toast({
        title: "エラー",
        description: "メッセージの保存に失敗しました",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const testSendMessage = async () => {
    const flexJson = generateFlexJson();
    
    toast({
      title: "テスト送信",
      description: "実際の送信機能は今後実装予定です",
    });
    
    console.log('Test send:', JSON.stringify(flexJson, null, 2));
  };

  if (initialLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-xl text-muted-foreground">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/")}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              ダッシュボードに戻る
            </Button>
            <h1 className="text-2xl font-bold">Flexメッセージデザイナー</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* 左側：デザイナー */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  メッセージ作成
                </CardTitle>
                <CardDescription>
                  インタラクティブなFlexメッセージを作成します
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="basic" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="basic">基本情報</TabsTrigger>
                    <TabsTrigger value="content">コンテンツ</TabsTrigger>
                    <TabsTrigger value="buttons">ボタン</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="basic" className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="message-name">メッセージ名</Label>
                      <Input
                        id="message-name"
                        value={messageName}
                        onChange={(e) => setMessageName(e.target.value)}
                        placeholder="メッセージに名前を付けてください"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="message-type">メッセージタイプ</Label>
                      <Select value={messageType} onValueChange={(value: 'bubble' | 'carousel') => setMessageType(value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bubble">バブル（単一カード）</SelectItem>
                          <SelectItem value="carousel" disabled>カルーセル（複数カード）- 今後対応</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="content" className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="image-url">画像URL（オプション）</Label>
                      <Input
                        id="image-url"
                        value={bubbleContent.imageUrl}
                        onChange={(e) => setBubbleContent(prev => ({ ...prev, imageUrl: e.target.value }))}
                        placeholder="https://example.com/image.jpg"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="title">タイトル</Label>
                      <Input
                        id="title"
                        value={bubbleContent.title}
                        onChange={(e) => setBubbleContent(prev => ({ ...prev, title: e.target.value }))}
                        placeholder="メッセージのタイトル"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="subtitle">サブタイトル</Label>
                      <Input
                        id="subtitle"
                        value={bubbleContent.subtitle}
                        onChange={(e) => setBubbleContent(prev => ({ ...prev, subtitle: e.target.value }))}
                        placeholder="サブタイトル（オプション）"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="text">本文</Label>
                      <Textarea
                        id="text"
                        value={bubbleContent.text}
                        onChange={(e) => setBubbleContent(prev => ({ ...prev, text: e.target.value }))}
                        placeholder="メッセージの本文を入力してください"
                        rows={4}
                      />
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="buttons" className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-medium">アクションボタン</h3>
                      <Button
                        onClick={addButton}
                        size="sm"
                        disabled={bubbleContent.buttons.length >= 4}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        ボタン追加
                      </Button>
                    </div>
                    
                    {bubbleContent.buttons.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        ボタンが追加されていません。「ボタン追加」をクリックして開始してください。
                      </p>
                    )}
                    
                    {bubbleContent.buttons.map((button, index) => (
                      <Card key={index} className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <Badge variant="outline">ボタン {index + 1}</Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeButton(index)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                        
                        <div className="space-y-3">
                          <div className="space-y-2">
                            <Label>ボタンタイプ</Label>
                            <Select
                              value={button.type}
                              onValueChange={(value) => updateButton(index, 'type', value)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="message">メッセージ送信</SelectItem>
                                <SelectItem value="uri">URL開く</SelectItem>
                                <SelectItem value="postback">ポストバック</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div className="space-y-2">
                            <Label>ボタンラベル</Label>
                            <Input
                              value={button.label}
                              onChange={(e) => updateButton(index, 'label', e.target.value)}
                              placeholder="ボタンに表示するテキスト"
                            />
                          </div>
                          
                          {button.type === 'message' && (
                            <div className="space-y-2">
                              <Label>送信メッセージ</Label>
                              <Input
                                value={button.text || ''}
                                onChange={(e) => updateButton(index, 'text', e.target.value)}
                                placeholder="ボタンクリック時に送信されるメッセージ"
                              />
                            </div>
                          )}
                          
                          {button.type === 'uri' && (
                            <div className="space-y-2">
                              <Label>リンクURL</Label>
                              <Input
                                value={button.uri || ''}
                                onChange={(e) => updateButton(index, 'uri', e.target.value)}
                                placeholder="https://example.com"
                              />
                            </div>
                          )}
                          
                          {button.type === 'postback' && (
                            <div className="space-y-2">
                              <Label>ポストバックデータ</Label>
                              <Input
                                value={button.data || ''}
                                onChange={(e) => updateButton(index, 'data', e.target.value)}
                                placeholder="action=buy&item=123"
                              />
                            </div>
                          )}
                        </div>
                      </Card>
                    ))}
                  </TabsContent>
                </Tabs>
                
                <div className="flex gap-3 mt-6">
                  <Button onClick={saveMessage} disabled={loading} className="flex-1">
                    {loading ? "保存中..." : "メッセージを保存"}
                  </Button>
                  <Button onClick={testSendMessage} variant="outline">
                    <Send className="w-4 h-4 mr-2" />
                    テスト送信
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 右側：プレビュー */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="w-5 h-5" />
                  プレビュー
                </CardTitle>
                <CardDescription>
                  作成中のメッセージのプレビューです
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-slate-100 p-4 rounded-lg max-w-sm mx-auto">
                  <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                    {bubbleContent.imageUrl && (
                      <div className="aspect-[20/13] bg-gray-200 flex items-center justify-center">
                        <img 
                          src={bubbleContent.imageUrl} 
                          alt="プレビュー画像" 
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                        <Image className="w-8 h-8 text-gray-400" />
                      </div>
                    )}
                    
                    <div className="p-4">
                      {bubbleContent.title && (
                        <h3 className="font-bold text-lg mb-2">{bubbleContent.title}</h3>
                      )}
                      
                      {bubbleContent.subtitle && (
                        <p className="text-sm text-gray-600 mb-2">{bubbleContent.subtitle}</p>
                      )}
                      
                      {bubbleContent.text && (
                        <p className="text-sm text-gray-600 mb-4">{bubbleContent.text}</p>
                      )}
                      
                      {bubbleContent.buttons.length > 0 && (
                        <div className="space-y-2">
                          {bubbleContent.buttons.map((button, index) => (
                            <div key={index} className="border border-blue-500 text-blue-500 text-center py-2 px-4 rounded text-sm">
                              {button.label || `ボタン ${index + 1}`}
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {!bubbleContent.title && !bubbleContent.subtitle && !bubbleContent.text && !bubbleContent.imageUrl && bubbleContent.buttons.length === 0 && (
                        <div className="text-center py-8 text-gray-400">
                          <MessageSquare className="w-8 h-8 mx-auto mb-2" />
                          <p className="text-sm">コンテンツを追加すると<br />ここにプレビューが表示されます</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* JSON出力 */}
            <Card>
              <CardHeader>
                <CardTitle>JSON出力</CardTitle>
                <CardDescription>
                  生成されるFlexメッセージのJSON
                </CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="bg-muted p-4 rounded-lg text-xs overflow-auto max-h-60">
                  {JSON.stringify(generateFlexJson(), null, 2)}
                </pre>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default FlexMessageDesigner;