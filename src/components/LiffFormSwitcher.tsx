import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Smartphone, Globe, Copy, Check } from "lucide-react";
import { toast } from "sonner";

interface LiffFormSwitcherProps {
  formId: string;
  formName: string;
  hasLiffId?: boolean;
  liffId?: string;
}

export function LiffFormSwitcher({ formId, formName, hasLiffId = false, liffId }: LiffFormSwitcherProps) {
  const [copied, setCopied] = useState<'web' | 'liff' | null>(null);

  const baseUrl = window.location.origin;
  const webFormUrl = `${baseUrl}/form/${formId}`;
  const liffFormUrl = hasLiffId && liffId ? `${baseUrl}/liff-form/${formId}?liff_id=${liffId}` : null;

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

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="text-lg font-semibold mb-2">{formName}</h2>
        <p className="text-sm text-muted-foreground">フォームのアクセス方法を選択してください</p>
      </div>

      {/* Web版フォーム */}
      <Card className="border-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Globe className="h-5 w-5 text-blue-500" />
              <CardTitle className="text-lg">通常のWebフォーム</CardTitle>
            </div>
            <Badge variant="secondary">推奨</Badge>
          </div>
          <CardDescription>
            ブラウザで開くことができる標準的なフォーム。どのデバイスからでもアクセス可能です。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center space-x-2 p-2 bg-muted rounded text-sm font-mono break-all">
            <span className="flex-1">{webFormUrl}</span>
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
              フォームを開く
            </Button>
            <Button 
              variant="outline" 
              onClick={() => copyToClipboard(webFormUrl, 'web')}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* LIFF版フォーム */}
      <Card className={`border-2 ${hasLiffId ? 'border-green-200' : 'border-gray-200 opacity-60'}`}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Smartphone className="h-5 w-5 text-green-500" />
              <CardTitle className="text-lg">LIFF版フォーム</CardTitle>
            </div>
            {hasLiffId ? (
              <Badge variant="default" className="bg-green-500">
                利用可能
              </Badge>
            ) : (
              <Badge variant="secondary">
                未設定
              </Badge>
            )}
          </div>
          <CardDescription>
            LINEアプリ内で開くことができるフォーム。LINE IDが自動的に取得されます。
            {!hasLiffId && " (LIFF IDの設定が必要です)"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {hasLiffId && liffFormUrl ? (
            <>
              <div className="flex items-center space-x-2 p-2 bg-muted rounded text-sm font-mono break-all">
                <span className="flex-1">{liffFormUrl}</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(liffFormUrl, 'liff')}
                >
                  {copied === 'liff' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <div className="flex space-x-2">
                <Button 
                  onClick={() => openForm(liffFormUrl)} 
                  className="flex-1"
                  variant="default"
                >
                  <Smartphone className="mr-2 h-4 w-4" />
                  LIFFフォームを開く
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => copyToClipboard(liffFormUrl, 'liff')}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground mb-3">
                LIFFフォームを利用するには、LINE開発者コンソールでLIFF IDを設定してください。
              </p>
              <Button 
                variant="outline" 
                onClick={() => window.open('/line-login-settings', '_blank')}
              >
                LIFF設定を行う
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 利用メリット・デメリット */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">利用方法の比較</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-semibold text-blue-600 mb-2">
                <Globe className="inline h-4 w-4 mr-1" />
                通常のWebフォーム
              </h4>
              <div className="space-y-1">
                <p className="text-green-600">✓ どのデバイスからでもアクセス可能</p>
                <p className="text-green-600">✓ ブラウザで直接開ける</p>
                <p className="text-green-600">✓ SNSでシェアしやすい</p>
                <p className="text-orange-600">- LINE IDは手動取得が必要</p>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-green-600 mb-2">
                <Smartphone className="inline h-4 w-4 mr-1" />
                LIFF版フォーム
              </h4>
              <div className="space-y-1">
                <p className="text-green-600">✓ LINE IDが自動取得される</p>
                <p className="text-green-600">✓ LINEアプリ内でネイティブ体験</p>
                <p className="text-green-600">✓ ユーザー情報の自動入力</p>
                <p className="text-orange-600">- LINEアプリからのみアクセス可能</p>
                <p className="text-orange-600">- LIFF設定が必要</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}