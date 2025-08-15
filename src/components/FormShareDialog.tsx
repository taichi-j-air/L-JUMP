import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Copy, Check, ExternalLink, Smartphone, Globe, QrCode } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface FormShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formId: string;
  formName: string;
}

export function FormShareDialog({ open, onOpenChange, formId, formName }: FormShareDialogProps) {
  const [copied, setCopied] = useState<'web' | 'liff' | null>(null);
  const [liffId, setLiffId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const baseUrl = window.location.origin;
  const webFormUrl = `${baseUrl}/form/${formId}`;
  const liffFormUrl = liffId ? `${baseUrl}/liff-form/${formId}?liff_id=${liffId}` : null;

  useEffect(() => {
    const fetchLiffId = async () => {
      setLoading(true);
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('liff_id')
          .single();
        
        if (profile?.liff_id) {
          setLiffId(profile.liff_id);
        }
      } catch (error) {
        console.error('LIFF ID取得エラー:', error);
      } finally {
        setLoading(false);
      }
    };

    if (open) {
      fetchLiffId();
    }
  }, [open]);

  const copyToClipboard = async (url: string, type: 'web' | 'liff') => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(type);
      toast.success('URLをコピーしました');
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      toast.error('コピーに失敗しました');
    }
  };

  const openForm = (url: string) => {
    window.open(url, '_blank');
  };

  const generateQRCode = (url: string) => {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;
    window.open(qrUrl, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <span>フォームを共有</span>
          </DialogTitle>
          <DialogDescription>
            「{formName}」のアクセス方法を選択してシェアしてください
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-muted-foreground">設定を確認中...</div>
          </div>
        ) : (
          <Tabs defaultValue="web" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="web" className="flex items-center space-x-2">
                <Globe className="h-4 w-4" />
                <span>Webフォーム</span>
              </TabsTrigger>
              <TabsTrigger value="liff" className="flex items-center space-x-2" disabled={!liffId}>
                <Smartphone className="h-4 w-4" />
                <span>LIFFフォーム</span>
                {!liffId && <Badge variant="secondary" className="ml-2">未設定</Badge>}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="web" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Globe className="h-5 w-5 text-blue-500" />
                    <span>通常のWebフォーム</span>
                    <Badge variant="secondary">推奨</Badge>
                  </CardTitle>
                  <CardDescription>
                    ブラウザで開くことができる標準的なフォーム。どのデバイスからでもアクセス可能です。
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Input 
                      value={webFormUrl}
                      readOnly
                      className="font-mono text-sm"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(webFormUrl, 'web')}
                    >
                      {copied === 'web' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  
                  <div className="flex space-x-2">
                    <Button onClick={() => openForm(webFormUrl)} className="flex-1">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      プレビュー
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => generateQRCode(webFormUrl)}
                    >
                      <QrCode className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="bg-muted p-3 rounded-lg text-sm">
                    <p className="font-medium text-green-600 mb-1">メリット</p>
                    <ul className="text-muted-foreground space-y-1">
                      <li>• どのデバイスからでもアクセス可能</li>
                      <li>• SNSやメールで簡単にシェア</li>
                      <li>• ブラウザで直接開ける</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="liff" className="space-y-4">
              {liffId && liffFormUrl ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Smartphone className="h-5 w-5 text-green-500" />
                      <span>LIFF版フォーム</span>
                      <Badge variant="default" className="bg-green-500">利用可能</Badge>
                    </CardTitle>
                    <CardDescription>
                      LINEアプリ内で開くことができるフォーム。LINE IDが自動的に取得されます。
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Input 
                        value={liffFormUrl}
                        readOnly
                        className="font-mono text-sm"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyToClipboard(liffFormUrl, 'liff')}
                      >
                        {copied === 'liff' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                    
                    <div className="flex space-x-2">
                      <Button onClick={() => openForm(liffFormUrl)} className="flex-1">
                        <Smartphone className="mr-2 h-4 w-4" />
                        プレビュー
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => generateQRCode(liffFormUrl)}
                      >
                        <QrCode className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="bg-muted p-3 rounded-lg text-sm">
                      <p className="font-medium text-green-600 mb-1">メリット</p>
                      <ul className="text-muted-foreground space-y-1">
                        <li>• LINE IDが自動取得される</li>
                        <li>• LINEアプリ内でネイティブ体験</li>
                        <li>• ユーザー情報の自動入力</li>
                      </ul>
                      <p className="font-medium text-orange-600 mt-2 mb-1">注意点</p>
                      <ul className="text-muted-foreground space-y-1">
                        <li>• LINEアプリからのみアクセス可能</li>
                        <li>• LINEトーク経由での共有が必要</li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Smartphone className="h-5 w-5 text-gray-400" />
                      <span>LIFF版フォーム</span>
                      <Badge variant="secondary">未設定</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-center py-8">
                    <p className="text-muted-foreground mb-4">
                      LIFFフォームを利用するには、LINE開発者コンソールでLIFF IDを設定してください。
                    </p>
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        window.open('/line-login-settings', '_blank');
                        onOpenChange(false);
                      }}
                    >
                      LIFF設定を行う
                    </Button>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}