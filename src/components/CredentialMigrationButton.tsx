import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Shield, CheckCircle } from 'lucide-react';

interface CredentialMigrationButtonProps {
  onMigrationComplete?: () => void;
}

export function CredentialMigrationButton({ onMigrationComplete }: CredentialMigrationButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [migrationComplete, setMigrationComplete] = useState(false);
  const { toast } = useToast();

  const handleMigration = async () => {
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('migrate-credentials');
      
      if (error) {
        throw error;
      }

      if (data?.success) {
        setMigrationComplete(true);
        toast({
          title: "認証情報の移行完了",
          description: `${data.migrated_count}件の認証情報を安全に移行しました`,
          variant: "default",
        });
        onMigrationComplete?.();
      } else {
        throw new Error(data?.error || '移行に失敗しました');
      }
    } catch (error) {
      console.error('Migration error:', error);
      toast({
        title: "移行エラー",
        description: "認証情報の移行中にエラーが発生しました",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (migrationComplete) {
    return (
      <Button variant="outline" disabled className="w-full">
        <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
        移行完了
      </Button>
    );
  }

  return (
    <Button 
      onClick={handleMigration} 
      disabled={isLoading}
      variant="outline"
      className="w-full"
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      ) : (
        <Shield className="w-4 h-4 mr-2" />
      )}
      {isLoading ? '移行中...' : '認証情報を安全に移行'}
    </Button>
  );
}