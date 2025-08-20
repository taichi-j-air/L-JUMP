import { useEffect, useMemo, useRef, useState } from "react";

export type TimerMode = "absolute" | "per_access";
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
  const base = `残り${days}${dayLabel}${hours}${hourLabel}${minutes}${minuteLabel}${seconds}${secondLabel}`;
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
      return new Date(deadline).getTime();
    }
    if (mode === "per_access" && durationSeconds) {
      // In preview mode, always start from now for live reflection
      if (preview) {
        return Date.now() + durationSeconds * 1000;
      }
      // per-visitor start time (local storage) to avoid DB changes for now
      const key = `cms_page_first_access:${shareCode || ""}:${uid || "anon"}`;
      const stored = localStorage.getItem(key);
      let start = stored ? Number(stored) : Date.now();
      if (!stored) localStorage.setItem(key, String(start));
      return start + durationSeconds * 1000;
    }
    return Date.now();
  }, [mode, deadline, durationSeconds, shareCode, uid, preview]);

  useEffect(() => {
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    const tick = () => {
      const now = Date.now();
      setRemainingMs(Math.max(0, targetTime - now));
    };
    tick();
    intervalRef.current = window.setInterval(tick, showMilliseconds ? 50 : 500);
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [targetTime, showMilliseconds]);

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
  return `${endDate.getFullYear()}年${endDate.getMonth() + 1}月${endDate.getDate()}日 ${endDate.getHours()}時${endDate.getMinutes().toString().padStart(2, '0')}分まで`;
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

  return (
    <div className={className}>
      <div className={`${styleClasses[styleVariant]}`} style={containerStyle}>
        <div className="text-xl font-semibold tracking-wide">
          {internalTimer ? timerText : text}
        </div>
        {showEndDate && endDateText && (
          <div className="text-sm mt-1 opacity-80">
            {endDateText}
          </div>
        )}
      </div>
    </div>
  );
};

export default TimerPreview;
