import { useEffect, useMemo, useRef, useState } from "react";

export type TimerMode = "absolute" | "per_access";
export type TimerStyle = "solid" | "glass" | "outline";

interface TimerPreviewProps {
  mode: TimerMode;
  deadline?: string | null;              // absolute のときのISO
  durationSeconds?: number | null;       // per_access のときの秒（※秒）
  showMilliseconds?: boolean;
  styleVariant?: TimerStyle;
  bgColor?: string;                       // hex
  textColor?: string;                     // hex
  shareCode?: string;                     // per_access のキー
  uid?: string;                           // per_access のキー
  className?: string;
  dayLabel?: string;
  hourLabel?: string;
  minuteLabel?: string;
  secondLabel?: string;
  preview?: boolean;
  internalTimer?: boolean;                // 非表示モード
  timerText?: string;                     // 非表示モード時テキスト
  showEndDate?: boolean;                  // 終了日時を表示
}

function breakdown(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));

  let days = Math.floor(totalSeconds / 86400);
  let hours = Math.floor((totalSeconds % 86400) / 3600);
  let minutes = Math.floor((totalSeconds % 3600) / 60);
  let seconds = totalSeconds % 60;
  const milli = Math.max(0, ms % 1000);

  // もし何らかの理由で hours が 23 を超える値になっていたら安全側で正規化
  if (hours > 23) {
    days += Math.floor(hours / 24);
    hours = hours % 24;
  }
  return { days, hours, minutes, seconds, milli };
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

  // ✅ durationSeconds がミリ秒で来てしまった場合（1000の倍数&やたら大きい）を秒に補正
  const safeDurationSeconds = useMemo(() => {
    let sec = Number(durationSeconds ?? 0);
    if (sec > 2_592_000 && sec % 1000 === 0) { // 30日(秒)より大きく、かつ1000の倍数 → ms疑い
      sec = Math.floor(sec / 1000);
    }
    return sec;
  }, [durationSeconds]);

  const targetTime = useMemo(() => {
    if (mode === "absolute" && deadline) {
      return new Date(deadline).getTime();
    }
    if (mode === "per_access" && safeDurationSeconds > 0) {
      if (preview) {
        return Date.now() + safeDurationSeconds * 1000;
      }
      const key = `cms_page_first_access:${shareCode || ""}:${uid || "anon"}`;
      const stored = typeof window !== "undefined" ? localStorage.getItem(key) : null;
      const start = stored ? Number(stored) : Date.now();
      if (!stored && typeof window !== "undefined") localStorage.setItem(key, String(start));
      return start + safeDurationSeconds * 1000;
    }
    return Date.now();
  }, [mode, deadline, safeDurationSeconds, shareCode, uid, preview]);

  useEffect(() => {
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    const tick = () => setRemainingMs(Math.max(0, targetTime - Date.now()));
    tick();
    intervalRef.current = window.setInterval(tick, showMilliseconds ? 50 : 500);
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [targetTime, showMilliseconds]);

  const { days, hours, minutes, seconds, milli } = breakdown(remainingMs);

  // ✅ 「日」が1以上なら必ず日を表示。ぴったり1日(= 1d 0h 0m 0s)なら"残り1日"だけ。
  let base = "";
  if (days > 0 && hours === 0 && minutes === 0 && seconds === 0) {
    base = `残り${days}${dayLabel}`;
  } else {
    const parts: string[] = [];
    if (days > 0) parts.push(`${days}${dayLabel}`);
    parts.push(`${hours}${hourLabel}`, `${minutes}${minuteLabel}`, `${seconds}${secondLabel}`);
    base = `残り${parts.join("")}`;
  }
  const text = internalTimer
    ? timerText
    : showMilliseconds
      ? `${base}${milli.toString().padStart(3, "0")}`
      : base;

  const endDateText = useMemo(() => {
    if (!showEndDate) return null;
    const endDate = new Date(targetTime);
    const y = endDate.getFullYear();
    const mo = endDate.getMonth() + 1;
    const d = endDate.getDate();
    const hh = endDate.getHours().toString().padStart(2, "0");
    const mm = endDate.getMinutes().toString().padStart(2, "0");
    return `${y}年${mo}月${d}日 ${hh}時${mm}分まで`;
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
      <div className={styleClasses[styleVariant]} style={containerStyle}>
        <div className="text-xl font-semibold tracking-wide">{text}</div>
        {showEndDate && endDateText && (
          <div className="text-sm mt-1 opacity-80">{endDateText}</div>
        )}
      </div>
    </div>
  );
};

export default TimerPreview;