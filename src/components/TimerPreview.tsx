import { useEffect, useMemo, useRef, useState } from "react";

export type TimerMode = "absolute" | "per_access" | "step_delivery";
export type TimerStyle = "solid" | "glass" | "outline";

interface TimerPreviewProps {
  mode: TimerMode;
  deadline?: string | null; // ISO string when absolute
  durationSeconds?: number | null; // used when per_access
  showMilliseconds?: boolean;
  styleVariant?: TimerStyle;
  bgColor?: string; // hex
  textColor?: string; // hex
  shareCode?: string; // for per_access local storage keying
  uid?: string; // for per_access local storage keying
  className?: string;
  dayLabel?: string;
  hourLabel?: string;
  minuteLabel?: string;
  secondLabel?: string;
  preview?: boolean;
  internalTimer?: boolean; // 内部タイマーモード
  timerText?: string; // 内部タイマー時の表示テキスト
  showEndDate?: boolean; // 終了日時を表示するかどうか
}

function formatRemaining(
  ms: number,
  withMs: boolean,
  labels: { dayLabel: string; hourLabel: string; minuteLabel: string; secondLabel: string }
) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const milli = Math.max(0, ms % 1000);

  const { dayLabel, hourLabel, minuteLabel, secondLabel } = labels;
  
  // 修正: 正しい時間表示ロジック
  let timeStr = "";
  
  // 日数がある場合は日数を表示
  if (days > 0) {
    timeStr += `${days}${dayLabel}`;
  }
  
  // 時間がある場合、または日数がある場合は時間を表示
  if (hours > 0 || days > 0) {
    timeStr += `${hours}${hourLabel}`;
  }
  
  // 分がある場合、または上位単位がある場合は分を表示
  if (minutes > 0 || hours > 0 || days > 0) {
    timeStr += `${minutes}${minuteLabel}`;
  }
  
  // 秒は常に表示
  timeStr += `${seconds}${secondLabel}`;
  
  const base = `残り${timeStr}`;
  if (!withMs) return base;
  return `${base}${milli.toString().padStart(3, "0")}`;
}

export const TimerPreview = ({
  mode,
  deadline,
  durationSeconds,
  showMilliseconds = false,
  styleVariant = "solid",
  bgColor = "#0cb386",
  textColor = "#ffffff",
  shareCode,
  uid,
  className,
  dayLabel = "日",
  hourLabel = "時間",
  minuteLabel = "分",
  secondLabel = "秒",
  preview = false,
  internalTimer = false,
  timerText = "期間限定公開",
  showEndDate = false,
}: TimerPreviewProps) => {
  const [remainingMs, setRemainingMs] = useState<number>(0);
  const intervalRef = useRef<number | null>(null);

  const targetTime = useMemo(() => {
    if (mode === "absolute" && deadline) {
      const deadlineTime = new Date(deadline).getTime();
      // 無効な日付をチェック
      if (isNaN(deadlineTime)) {
        console.warn('Invalid deadline:', deadline);
        return Date.now();
      }
      return deadlineTime;
    }
    
    if (mode === "per_access" && durationSeconds && durationSeconds > 0) {
      // In preview mode, always start from now for live reflection
      if (preview) {
        return Date.now() + durationSeconds * 1000;
      }
      
      // per-visitor start time (local storage) to avoid DB changes for now
      const key = `cms_page_first_access:${shareCode || "preview"}:${uid || "anon"}`;
      
      try {
        const stored = localStorage.getItem(key);
        let start = stored ? Number(stored) : Date.now();
        
        // 無効な値をチェック
        if (isNaN(start)) {
          start = Date.now();
        }
        
        if (!stored || isNaN(Number(stored))) {
          localStorage.setItem(key, String(start));
        }
        return start + durationSeconds * 1000;
      } catch (e) {
        // localStorage使用できない場合のフォールバック
        console.warn('localStorage not available:', e);
        return Date.now() + durationSeconds * 1000;
      }
    }
    
    return Date.now();
  }, [mode, deadline, durationSeconds, shareCode, uid, preview]);

  useEffect(() => {
    // 既存のインターバルをクリア
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    const tick = () => {
      const now = Date.now();
      const remaining = Math.max(0, targetTime - now);
      setRemainingMs(remaining);
    };
    
    // 初回実行
    tick();
    
    // インターバル設定
    const intervalMs = showMilliseconds ? 50 : 500;
    intervalRef.current = window.setInterval(tick, intervalMs);
    
    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [targetTime, showMilliseconds]);

  // コンポーネントアンマウント時のクリーンアップ
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  const text = formatRemaining(remainingMs, showMilliseconds, {
    dayLabel,
    hourLabel,
    minuteLabel,
    secondLabel,
  });

  // 終了日時の表示
  const endDateText = useMemo(() => {
    if (!showEndDate) return null;
    
    const endDate = new Date(targetTime);
    if (isNaN(endDate.getTime())) return null;
    
    const year = endDate.getFullYear();
    const month = endDate.getMonth() + 1;
    const date = endDate.getDate();
    const hours = endDate.getHours();
    const minutes = endDate.getMinutes().toString().padStart(2, '0');
    
    return `${year}年${month}月${date}日 ${hours}時${minutes}分まで`;
  }, [targetTime, showEndDate]);

  const styleClasses = {
    solid: "rounded-md p-3",
    glass: "rounded-md p-3 backdrop-blur border border-white/20",
    outline: "rounded-md p-3 border",
  } as const;

  const containerStyle: React.CSSProperties = {
    background: styleVariant === "glass" ? `${bgColor}20` : bgColor,
    color: textColor,
    borderColor: styleVariant === "outline" ? textColor : undefined,
  };

  // タイマーが0になった場合の表示
  const isExpired = remainingMs <= 0 && (mode === "absolute" || (mode === "per_access" && !preview));

  // デバッグ情報を開発環境でのみ表示
  if (process.env.NODE_ENV === 'development') {
    console.log('Timer Debug:', {
      mode,
      durationSeconds,
      targetTime,
      remainingMs,
      currentTime: Date.now(),
      days: Math.floor(remainingMs / 1000 / 86400),
      hours: Math.floor((remainingMs / 1000 % 86400) / 3600),
      minutes: Math.floor((remainingMs / 1000 % 3600) / 60),
      seconds: Math.floor(remainingMs / 1000 % 60)
    });
  }

  return (
    <div className={className}>
      <div className={`${styleClasses[styleVariant]}`} style={containerStyle}>
        <div className="text-xl font-semibold tracking-wide">
          {isExpired ? (
            "期間終了"
          ) : internalTimer ? (
            timerText
          ) : (
            text
          )}
        </div>
        {showEndDate && endDateText && !isExpired && (
          <div className="text-sm mt-1 opacity-80">
            {endDateText}
          </div>
        )}
      </div>
    </div>
  );
};

export default TimerPreview;