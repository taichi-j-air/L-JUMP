import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Smartphone, Globe, MessageCircle, Shield } from "lucide-react";

interface FormAccessSelectorProps {
  formId: string;
  formName: string;
  requireLineFriend: boolean;
  onAccessMethodSelect: (method: 'web' | 'liff') => void;
}

export default function FormAccessSelector({ 
  formId, 
  formName, 
  requireLineFriend, 
  onAccessMethodSelect 
}: FormAccessSelectorProps) {
  const [selectedMethod, setSelectedMethod] = useState<'web' | 'liff' | null>(null);

  const handleSelect = (method: 'web' | 'liff') => {
    setSelectedMethod(method);
    onAccessMethodSelect(method);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">{formName}</h1>
        <p className="text-muted-foreground">アクセス方法を選択してください</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Web版フォーム */}
        <Card className={`cursor-pointer transition-all ${
          selectedMethod === 'web' ? 'ring-2 ring-primary' : 'hover:shadow-lg'
        }`} onClick={() => handleSelect('web')}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-blue-500" />
              <CardTitle className="text-lg">Web版フォーム</CardTitle>
              <Badge variant="secondary">推奨</Badge>
            </div>
            <CardDescription>
              ブラウザから直接アクセスできる一般的なフォーム
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm space-y-2">
              <div className="flex items-center gap-2 text-green-600">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                どのブラウザからでもアクセス可能
              </div>
              <div className="flex items-center gap-2 text-green-600">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                URLの共有が簡単
              </div>
              <div className="flex items-center gap-2 text-green-600">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                SEO対応済み
              </div>
              {!requireLineFriend && (
                <div className="flex items-center gap-2 text-green-600">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  誰でも回答可能
                </div>
              )}
              {requireLineFriend && (
                <div className="flex items-center gap-2 text-orange-600">
                  <Shield className="w-4 h-4" />
                  LINE友だち限定
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* LIFF版フォーム */}
        <Card className={`cursor-pointer transition-all ${
          selectedMethod === 'liff' ? 'ring-2 ring-primary' : 'hover:shadow-lg'
        }`} onClick={() => handleSelect('liff')}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-green-500" />
              <CardTitle className="text-lg">LIFF版フォーム</CardTitle>
              <Badge variant="outline">LINE専用</Badge>
            </div>
            <CardDescription>
              LINEアプリ内で動作する高機能フォーム
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm space-y-2">
              <div className="flex items-center gap-2 text-green-600">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                LINE情報を自動取得
              </div>
              <div className="flex items-center gap-2 text-green-600">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                送信後に即座にLINE通知
              </div>
              <div className="flex items-center gap-2 text-green-600">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                ネイティブアプリ感覚
              </div>
              <div className="flex items-center gap-2 text-orange-600">
                <MessageCircle className="w-4 h-4" />
                LINEアプリ内でのみ動作
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {selectedMethod && (
        <div className="text-center pt-4">
          <Button size="lg" className="px-8">
            {selectedMethod === 'web' ? 'Web版フォームを開く' : 'LIFF版フォームを開く'}
          </Button>
        </div>
      )}

      <div className="text-center text-sm text-muted-foreground">
        <p>※ 後からでも別の方法でアクセスできます</p>
      </div>
    </div>
  );
}