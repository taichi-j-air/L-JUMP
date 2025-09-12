import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type TimerMode = "absolute" | "per_access" | "step_delivery";
export type TimerStyle = "solid" | "glass" | "outline" | "minimal";

interface TimerPreviewProps {
  mode: TimerMode;
  deadline?: string | null;                // absoluteの締切ISO
  durationSeconds?: number | null;         // per_access/step_delivery用
  showMilliseconds?: boolean;
  styleVariant?: TimerStyle;
  bgColor?: string;                         // 背景（hex）
  textColor?: string;                       // 文字色（hex）
  shareCode?: string;                       // サーバ同期用
  uid?: string;                             // サーバ同期用
  className?: string;
  dayLabel?: string;
  hourLabel?: string;
  minuteLabel?: string;
  secondLabel?: string;
  preview?: boolean;                        // ビルダープレビューか
  internalTimer?: boolean;                  // 内部タイマー
  timerText?: string;                       // 内部タイマー表示文言
  showEndDate?: boolean;                    // 終了日時の表示
  scenarioId?: string;                      // step_delivery
  stepId?: string;                          // step_delivery
}

/* ===== ユーティリティ ===== */
function splitParts(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const milli = Math.max(0, ms % 1000);
  return { days, hours, minutes, seconds, milli };
}

function hexToRgb(hex: string) {
  const m = hex.replace("#", "").match(/^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!m) return { r: 12, g: 179, b: 134 }; // #0cb386 fallback
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}

function mix(hex: string, ratio = 0.25) {
  // 背景色→白へ寄せて明るいアクセント色を作る（画像②のリング色用）
  const { r, g, b } = hexToRgb(hex);
  const rr = Math.round(r + (255 - r) * ratio);
  const gg = Math.round(g + (255 - g) * ratio);
  const bb = Math.round(b + (255 - b) * ratio);
  return `rgb(${rr}, ${gg}, ${bb})`;
}

function formatRemainingText(
  ms: number,
  withMs: boolean,
  labels: { dayLabel: string; hourLabel: string; minuteLabel: string; secondLabel: string }
) {
  const { days, hours, minutes, seconds, milli } = splitParts(ms);
  const { dayLabel, hourLabel, minuteLabel, secondLabel } = labels;

  let t = "";
  if (days > 0) t += `${days}${dayLabel}`;
  if (hours > 0 || days > 0) t += `${hours}${hourLabel}`;
  if (minutes > 0 || hours > 0 || days > 0) t += `${minutes}${minuteLabel}`;
  t += `${seconds}${secondLabel}`;
  const base = `残り${t}`;
  return withMs ? `${base}${milli.toString().padStart(3, "0")}` : base;
}

/* ====== コンポーネント本体 ====== */
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
  scenarioId,
  stepId,
}: TimerPreviewProps) => {
  const [remainingMs, setRemainingMs] = useState<number>(0);
  const [serverSyncedStart, setServerSyncedStart] = useState<Date | null>(null);
  const [serverSyncExpired, setServerSyncExpired] = useState<boolean>(false);
  const [showEndDateLocal, setShowEndDateLocal] = useState<boolean>(showEndDate); // プレビュー用のローカル切替
  const intervalRef = useRef<number | null>(null);

  useEffect(() => setShowEndDateLocal(showEndDate), [showEndDate]);

  // サーバー同期
  useEffect(() => {
    const fetchTimerInfo = async () => {
      if (shareCode && (mode === "per_access" || mode === "step_delivery") && !preview) {
        try {
          const { data, error } = await supabase.functions.invoke("get-timer-info", {
            body: { pageShareCode: shareCode, uid },
          });
          if (error) return;
          if (data?.success && data?.timer_start_at) {
            setServerSyncedStart(new Date(data.timer_start_at));
            setServerSyncExpired(Boolean(data.expired));
          }
        } catch (e) {
          // ignore
        }
      }
    };
    fetchTimerInfo();
  }, [shareCode, uid, mode, preview]);

  const targetTime = useMemo(() => {
    if (mode === "absolute" && deadline) {
      const t = new Date(deadline).getTime();
      return isNaN(t) ? Date.now() : t;
    }

    if ((mode === "per_access" || mode === "step_delivery") && durationSeconds && durationSeconds > 0) {
      if (preview) return Date.now() + durationSeconds * 1000;

      if (serverSyncedStart) {
        return serverSyncedStart.getTime() + durationSeconds * 1000;
      }

      if (mode === "step_delivery" && scenarioId && stepId && uid && shareCode) {
        const key = `step_delivery_timer:${shareCode}:${uid}:${scenarioId}:${stepId}`;
        try {
          const stored = localStorage.getItem(key);
          if (stored) {
            const startTime = Number(stored);
            if (!isNaN(startTime)) return startTime + durationSeconds * 1000;
          }
          const fallbackStart = Date.now();
          localStorage.setItem(key, String(fallbackStart));
          return fallbackStart + durationSeconds * 1000;
        } catch {
          return Date.now() + durationSeconds * 1000;
        }
      } else {
        const key = `cms_page_first_access:${shareCode || "preview"}:${uid || "anon"}`;
        try {
          const stored = localStorage.getItem(key);
          let start = stored ? Number(stored) : Date.now();
          if (isNaN(start)) start = Date.now();
          if (!stored || isNaN(Number(stored))) localStorage.setItem(key, String(start));
          return start + durationSeconds * 1000;
        } catch {
          return Date.now() + durationSeconds * 1000;
        }
      }
    }
    return Date.now();
  }, [mode, deadline, durationSeconds, shareCode, uid, preview, scenarioId, stepId, serverSyncedStart]);

  useEffect(() => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    const tick = () => setRemainingMs(Math.max(0, targetTime - Date.now()));
    tick();
    intervalRef.current = window.setInterval(tick, showMilliseconds ? 50 : 500);
    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [targetTime, showMilliseconds]);

  const endDateText = useMemo(() => {
    const d = new Date(targetTime);
    if (isNaN(d.getTime())) return null;
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const dd = d.getDate();
    const hh = d.getHours();
    const mm = d.getMinutes().toString().padStart(2, "0");
    return `${y}年${m}月${dd}日 ${hh}時${mm}分まで`;
  }, [targetTime]);

  const isExpired =
    (remainingMs <= 0 &&
      (mode === "absolute" || ((mode === "per_access" || mode === "step_delivery") && !preview))) ||
    serverSyncExpired;

  const txt = formatRemainingText(remainingMs, showMilliseconds, {
    dayLabel,
    hourLabel,
    minuteLabel,
    secondLabel,
  });

  const { days, hours, minutes, seconds } = splitParts(remainingMs);

  /* ====== スタイル別ビュー ====== */

  // 画像②: 円リング（中央配置・1列・スマホで改行させない・余白付与・上に見出し）
  const OutlineView = () => {
    const accent = mix(bgColor, 0.35);
    const track = mix(bgColor, 0.85);

    const Circle = ({
      value,
      max,
      label,
    }: {
      value: number;
      max: number;
      label: string;
    }) => {
      const r = 28;
      const c = 2 * Math.PI * r;
      const pct = Math.max(0, Math.min(1, value / max));
      const dash = c * pct;
      return (
        <div className="flex flex-col items-center justify-center w-16 h-20 sm:w-20 sm:h-24">
          <svg width="64" height="64" viewBox="0 0 72 72" className="block">
            <circle
              cx="36"
              cy="36"
              r={r}
              stroke={track}
              strokeWidth="8"
              fill="none"
              strokeLinecap="round"
              opacity={0.5}
            />
            <circle
              cx="36"
              cy="36"
              r={r}
              stroke={accent}
              strokeWidth="8"
              fill="none"
              strokeLinecap="round"
              transform="rotate(-90 36 36)"
              strokeDasharray={`${dash} ${c}`}
            />
            <text
              x="50%"
              y="50%"
              dominantBaseline="middle"
              textAnchor="middle"
              fontSize="18"
              fontWeight={800}
              style={{ fill: textColor }}
            >
              {String(value).padStart(2, "0")}
            </text>
          </svg>
          <div className="text-xs mt-1 opacity-90" style={{ color: textColor }}>
            {label}
          </div>
        </div>
      );
    };

    return (
      <div className="pt-3 px-4">
        <div className="mb-2 text-sm font-medium" style={{ color: textColor }}>
          終了まで残り
        </div>
        <div
          className="flex items-center justify-between gap-3 flex-nowrap overflow-x-auto whitespace-nowrap"
          style={{ color: textColor }}
        >
          <Circle value={days % 365} max={365} label={dayLabel} />
          <Circle value={hours} max={24} label={hourLabel} />
          <Circle value={minutes} max={60} label={minuteLabel} />
          <Circle value={seconds} max={60} label={secondLabel} />
        </div>
      </div>
    );
  };

  // 画像③: ミニマル（大きな数字＋下にラベル・1列・余白・上に見出し）
  const MinimalView = () => {
    const Cell = ({ v, l }: { v: number; l: string }) => (
      <div className="flex flex-col items-center justify-center min-w-[64px]">
        <div className="text-4xl sm:text-5xl font-semibold leading-none" style={{ color: textColor }}>
          {String(v).padStart(2, "0")}
        </div>
        <div className="text-xs mt-1 opacity-80" style={{ color: textColor }}>
          {l}
        </div>
      </div>
    );
    return (
      <div className="pt-3 px-4">
        <div className="mb-2 text-sm font-medium" style={{ color: textColor }}>
          終了まで残り
        </div>
        <div className="flex items-end justify-between gap-4 flex-nowrap overflow-x-auto whitespace-nowrap">
          <Cell v={days} l={dayLabel} />
          <Cell v={hours} l={hourLabel} />
          <Cell v={minutes} l={minuteLabel} />
          <Cell v={seconds} l={secondLabel} />
        </div>
      </div>
    );
  };

  // 画像①: 横並び（数字を文字より大きく）
  const GlassInlineView = () => {
    return (
      <div className="p-3">
        <div className="flex items-baseline gap-2 flex-wrap" style={{ color: textColor }}>
          <span className="text-sm opacity-90">終了まで</span>
          <span className="text-2xl font-extrabold">{days}</span>
          <span className="text-sm font-medium opacity-90">{dayLabel}</span>
          <span className="text-2xl font-extrabold">{String(hours).padStart(2, "0")}</span>
          <span className="text-sm font-medium opacity-90">{hourLabel}</span>
          <span className="text-2xl font-extrabold">{String(minutes).padStart(2, "0")}</span>
          <span className="text-sm font-medium opacity-90">{minuteLabel}</span>
          <span className="text-2xl font-extrabold">{String(seconds).padStart(2, "0")}</span>
          <span className="text-sm font-medium opacity-90">{secondLabel}</span>
        </div>
      </div>
    );
  };

  const styleClasses = {
    solid: "rounded-none p-3",
    glass: "rounded-md p-0 backdrop-blur border border-white/20", // 本体はGlassInlineView側でp-3
    outline: "rounded-md p-0",                                    // 内側で pt/px を付与
    minimal: "rounded-md p-0",                                    // 内側で pt/px を付与
  } as const;

  const containerStyle: React.CSSProperties = {
    background: styleVariant === "glass" ? `${bgColor}20` : bgColor,
    color: textColor,
    borderColor: styleVariant === "outline" ? textColor : undefined,
    borderWidth: styleVariant === "outline" ? 1 : undefined,
    borderStyle: styleVariant === "outline" ? "solid" : undefined,
  };

  return (
    <div className={className}>
      <div className={`${styleClasses[styleVariant]}`} style={containerStyle}>
        {/* 共通：満了 or 内部テキスト or 通常テキスト（solidのみテキスト単体表示） */}
        {styleVariant === "solid" && (
          <>
            <div className="text-xl font-semibold tracking-wide">
              {isExpired ? "期間終了" : internalTimer ? timerText : txt}
            </div>
          </>
        )}

        {styleVariant === "glass" && <GlassInlineView />}

        {styleVariant === "outline" && <OutlineView />}

        {styleVariant === "minimal" && <MinimalView />}

        {/* 終了日時（プレビュー時はローカル切替） */}
        {!isExpired && (preview ? showEndDateLocal : showEndDate) && endDateText && (
          <div className="text-sm mt-2 opacity-80 px-3 pb-3" style={{ color: textColor }}>
            {endDateText}
          </div>
        )}

        {/* プレビュー限定：終了日時の表示ON/OFFトグル */}
        {preview && (
          <div className="px-3 pb-3">
            <button
              type="button"
              onClick={() => setShowEndDateLocal((v) => !v)}
              className="text-xs underline opacity-80"
              style={{ color: textColor }}
            >
              終了日時を{showEndDateLocal ? "非表示" : "表示"}にする
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TimerPreview;
