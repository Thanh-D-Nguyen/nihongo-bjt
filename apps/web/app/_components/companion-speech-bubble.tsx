"use client";

import { useEffect, useState } from "react";

export type CompanionMood =
  | "idle"
  | "wave"
  | "dance"
  | "talk"
  | "sleep"
  | "happy"
  | "sad"
  | "cheer"
  | "think"
  | "surprise";

/** Motivational quotes — rotated automatically. */
const MOTIVATIONAL_QUOTES = [
  { ja: "頑張って！", vi: "Cố lên nào!" },
  { ja: "一歩ずつ進もう！", vi: "Từng bước một nhé!" },
  { ja: "今日も一緒に学ぼう！", vi: "Hôm nay cùng học nhé!" },
  { ja: "諦めないで！", vi: "Đừng bỏ cuộc!" },
  { ja: "毎日の努力が大切だよ", vi: "Nỗ lực mỗi ngày rất quan trọng" },
  { ja: "すごい！続けてね！", vi: "Giỏi lắm! Tiếp tục nhé!" },
  { ja: "日本語、楽しいね！", vi: "Tiếng Nhật vui nhỉ!" },
  { ja: "今日はどこまで行ける？", vi: "Hôm nay đi được bao xa?" },
  { ja: "一緒に頑張ろう！", vi: "Cùng cố gắng nào!" },
  { ja: "少しずつでいいよ", vi: "Từ từ cũng được mà" },
  { ja: "復習は力なり！", vi: "Ôn tập là sức mạnh!" },
  { ja: "やればできる！", vi: "Làm là được!" },
] as const;

function pickQuote(index: number) {
  return MOTIVATIONAL_QUOTES[index % MOTIVATIONAL_QUOTES.length];
}

export function CompanionSpeechBubble({
  customText,
  locale,
  mood,
  visible,
}: {
  customText?: { ja: string; vi: string } | null;
  locale: string;
  mood: CompanionMood;
  visible: boolean;
}) {
  const [quoteIndex, setQuoteIndex] = useState(() => Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length));
  const [isExiting, setIsExiting] = useState(false);
  const [rendered, setRendered] = useState(visible);

  // Auto-rotate quotes every 12s (only when no custom text)
  useEffect(() => {
    if (!visible || customText) return;
    const timer = setInterval(() => {
      setQuoteIndex((i) => (i + 1) % MOTIVATIONAL_QUOTES.length);
    }, 12000);
    return () => clearInterval(timer);
  }, [visible, customText]);

  // Animate exit
  useEffect(() => {
    if (visible) {
      setIsExiting(false);
      setRendered(true);
    } else if (rendered) {
      setIsExiting(true);
      const t = setTimeout(() => { setRendered(false); setIsExiting(false); }, 300);
      return () => clearTimeout(t);
    }
  }, [visible, rendered]);

  if (!rendered) return null;

  const quote = pickQuote(quoteIndex);
  const displayText = customText
    ? (locale === "ja" ? customText.ja : customText.vi)
    : quote.ja;
  const subText = customText
    ? (locale === "ja" ? customText.vi : (locale === "ja" ? null : quote.vi))
    : (locale === "ja" ? null : quote.vi);

  // Mood-specific emoji prefix
  const moodEmoji: Record<CompanionMood, string> = {
    idle: "",
    wave: "👋",
    dance: "💃",
    talk: "",
    sleep: "💤",
    happy: "✨",
    sad: "😢",
    cheer: "🎉",
    think: "🤔",
    surprise: "😮",
  };

  return (
    <div
      className={`pointer-events-none relative w-max max-w-[20rem] min-w-[10rem] rounded-2xl border border-ink/8 bg-surface px-3.5 py-2 shadow-md ${
        isExiting
          ? "motion-safe:animate-[bubbleFadeOut_0.3s_ease-in_both]"
          : "motion-safe:animate-[bubblePop_0.3s_ease-out_both]"
      }`}
      role="status"
      aria-live="polite"
    >
      {/* Speech bubble tail */}
      <div className="absolute -bottom-[6px] right-5 h-3 w-3 rotate-45 border-b border-r border-ink/10 bg-surface" />

      <p className="text-xs font-semibold leading-relaxed text-ink">
        {moodEmoji[mood] ? `${moodEmoji[mood]} ` : ""}
        {displayText}
      </p>
      {subText ? (
        <p className="mt-0.5 text-[11px] leading-relaxed text-muted">{subText}</p>
      ) : null}
    </div>
  );
}
