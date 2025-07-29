import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';

const EmailVerify = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const processVerification = async () => {
      try {
        // URLパラメータを取得
        const token = searchParams.get('token');
        const type = searchParams.get('type');
        const redirectTo = searchParams.get('redirect_to');

        console.log('🔍 URL Parameters:');
        console.log('Token:', token);
        console.log('Type:', type);
        console.log('Redirect to:', redirectTo);

        if (!token || !type) {
          setError('認証に必要なパラメータが不足しています。');
          setIsProcessing(false);
          return;
        }

        if (type === 'recovery') {
          console.log('✅ パスワードリセットフローを開始');
          
          // トークンを使用してセッションを確認
          const { data, error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: token,
            type: 'recovery'
          });

          if (verifyError) {
            console.error('認証エラー:', verifyError);
            setError('認証リンクが無効または期限切れです。');
            setIsProcessing(false);
            return;
          }

          console.log('🔑 認証成功:', data);
          setSuccess('認証が完了しました。パスワードリセットページに移動します...');
          
          // 2秒後にリダイレクト
          setTimeout(() => {
            if (redirectTo) {
              window.location.href = decodeURIComponent(redirectTo);
            } else {
              navigate('/reset-password');
            }
          }, 2000);

        } else if (type === 'signup') {
          console.log('✅ サインアップ確認フローを開始');
          
          const { data, error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: token,
            type: 'signup'
          });

          if (verifyError) {
            console.error('認証エラー:', verifyError);
            setError('認証リンクが無効または期限切れです。');
            setIsProcessing(false);
            return;
          }

          console.log('🔑 サインアップ認証成功:', data);
          setSuccess('アカウント確認が完了しました。ホームページに移動します...');
          
          // 2秒後にリダイレクト
          setTimeout(() => {
            if (redirectTo) {
              window.location.href = decodeURIComponent(redirectTo);
            } else {
              navigate('/');
            }
          }, 2000);

        } else {
          setError('不明な認証タイプです。');
          setIsProcessing(false);
        }

      } catch (error) {
        console.error('処理エラー:', error);
        setError('認証処理中にエラーが発生しました。');
        setIsProcessing(false);
      }
    };

    processVerification();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">メール認証</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isProcessing && (
            <div className="flex items-center justify-center space-x-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>認証処理中...</span>
            </div>
          )}
          
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {success && (
            <Alert>
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default EmailVerify;