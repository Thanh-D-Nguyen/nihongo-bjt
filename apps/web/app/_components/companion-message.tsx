"use client";

import type { CompanionMessage as CompanionMessageData } from "@nihongo-bjt/shared";

const TYPE_STYLES: Record<string, { bg: string; icon: string }> = {
  greeting: { bg: "bg-amber-50", icon: "👋" },
  hint: { bg: "bg-blue-50", icon: "💡" },
  celebration: { bg: "bg-gradient-to-r from-amber-50 to-orange-50", icon: "🎉" },
  tip: { bg: "bg-emerald-50", icon: "📚" },
  nudge: { bg: "bg-sky-50", icon: "💡" },
  onboarding: { bg: "bg-violet-50", icon: "🐕" },
  reaction: { bg: "bg-rose-50", icon: "✨" },
  context_aware: { bg: "bg-slate-50", icon: "💬" },
};

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return "vừa xong";
  if (diff < 3600) return `${Math.floor(diff / 60)}p trước`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h trước`;
  return `${Math.floor(diff / 86400)}d trước`;
}

export function CompanionMessageItem({
  message,
  locale,
}: {
  message: CompanionMessageData;
  locale: string;
}) {
  const isUser = message.sender === "user";
  const style = TYPE_STYLES[message.type] ?? TYPE_STYLES.context_aware;
  const text = isUser
    ? message.textJa // user messages store the raw text in textJa
    : locale === "ja" ? message.textJa : message.textVi;
  const icon = message.emoji ?? style.icon;

  if (isUser) {
    return (
      <div className="flex justify-end motion-safe:animate-[bubblePop_0.3s_ease-out_both]">
        <div className="max-w-[80%] space-y-1">
          <div className="rounded-2xl rounded-tr-sm bg-gradient-to-r from-[#1B2A4A] to-[#2563EB] px-3 py-2 text-xs leading-relaxed text-white">
            {text}
          </div>
          <p className="text-right text-[9px] text-muted">{timeAgo(message.timestamp)}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2 motion-safe:animate-[bubblePop_0.3s_ease-out_both]">
      <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[10px]">
        {icon}
      </span>
      <div className="max-w-[85%] space-y-1">
        <div
          className={`rounded-2xl rounded-tl-sm px-3 py-2 text-xs leading-relaxed text-ink ${style.bg}`}
        >
          {text}
          {/* Show both languages for tips */}
          {message.type === "tip" && locale !== "ja" ? (
            <p className="mt-1 border-t border-ink/5 pt-1 text-[10px] font-medium text-ink/60">
              {message.textJa}
            </p>
          ) : null}
          {message.type === "tip" && locale === "ja" ? (
            <p className="mt-1 border-t border-ink/5 pt-1 text-[10px] font-medium text-ink/60">
              {message.textVi}
            </p>
          ) : null}
        </div>
        {/* Action button */}
        {message.action ? (
          <a
            className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-[#1B2A4A] to-[#2563EB] px-3 py-1.5 text-[11px] font-bold text-white shadow-sm transition hover:shadow-md"
            href={message.action.href}
          >
            {message.action.label}
          </a>
        ) : null}
        <p className="text-[9px] text-muted">{timeAgo(message.timestamp)}</p>
      </div>
    </div>
  );
}

export function CompanionCelebrationOverlay({
  emoji,
  visible,
}: {
  emoji: string;
  visible: boolean;
}) {
  if (!visible) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center">
      {/* Confetti-like particles */}
      <div className="motion-safe:animate-[celebrationBurst_0.6s_ease-out_both] text-4xl">
        {emoji}
      </div>
      {/* Floating particles */}
      {["🌟", "✨", "⭐"].map((star, i) => (
        <span
          className="absolute motion-safe:animate-[confettiFloat_1s_ease-out_both]"
          key={i}
          style={{
            animationDelay: `${i * 0.15}s`,
            left: `${25 + i * 25}%`,
            top: `${30 + (i % 2) * 20}%`,
          }}
        >
          {star}
        </span>
      ))}
    </div>
  );
}
