import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function LoadingSpinner({ 
  message = '読み込み中...', 
  size = 'md',
  className = '' 
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8', 
    lg: 'h-12 w-12'
  };

  return (
    <div className={`flex flex-col items-center justify-center p-8 ${className}`}>
      <Loader2 className={`animate-spin text-primary ${sizeClasses[size]}`} />
      {message && (
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      )}
    </div>
  );
}

export default LoadingSpinner;