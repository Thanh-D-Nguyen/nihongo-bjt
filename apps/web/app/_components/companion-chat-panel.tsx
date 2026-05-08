"use client";

import type { CompanionActionKind, CompanionHintResponse, CompanionMessage as CompanionMessageData } from "@nihongo-bjt/shared";
import { useCallback, useEffect, useRef, useState } from "react";

import { CompanionMessageItem } from "./companion-message";

export type CompanionChatPanelLabels = {
  title: string;
  guestTitle: string;
  moodIdle: string;
  moodThinking: string;
  close: string;
  guestSubtitle: string;
  guestCta: string;
  hintError: string;
  hintLoading: string;
  primaryCtaAria: string;
  secondaryLabel: string;
  actionAnalytics: string;
  actionBattle: string;
  actionDaily: string;
  actionQuiz: string;
  actionReview: string;
  reasons: Record<string, string>;
  subtitle: string;
  /* New labels */
  messagesEmpty: string;
  tipSectionLabel: string;
  quickActionsLabel: string;
  muteBubble: string;
  unmuteBubble: string;
  chatPlaceholder?: string;
  chatSend?: string;
};

function actionLabel(kind: CompanionActionKind, labels: CompanionChatPanelLabels): string {
  switch (kind) {
    case "analytics_reflect": return labels.actionAnalytics;
    case "battle_bot": return labels.actionBattle;
    case "bjt_quiz": return labels.actionQuiz;
    case "daily_hub": return labels.actionDaily;
    case "srs_review": return labels.actionReview;
    default: return labels.title;
  }
}

const ACTION_ICONS: Record<CompanionActionKind, string> = {
  srs_review: "📚",
  bjt_quiz: "📝",
  battle_bot: "⚔️",
  daily_hub: "☀️",
  analytics_reflect: "📊",
};

type QuickReply = { id: string; labelJa: string; labelVi: string; icon: string };

export function CompanionChatPanel({
  base,
  hint,
  hintError,
  hintLoading,
  isLoggedIn,
  labels,
  locale,
  messages,
  onClose,
  onMuteToggle,
  isMuted,
  streakDays,
  onSendMessage,
  onQuickReply,
  quickReplies,
}: {
  base: string;
  hint: CompanionHintResponse | null;
  hintError: boolean;
  hintLoading: boolean;
  isLoggedIn: boolean;
  labels: CompanionChatPanelLabels;
  locale: string;
  messages: CompanionMessageData[];
  onClose: () => void;
  onMuteToggle: () => void;
  isMuted: boolean;
  streakDays: number;
  onSendMessage: (text: string) => void;
  onQuickReply: (chipId: string) => void;
  quickReplies: QuickReply[];
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState("");
  const lastSendTime = useRef(0);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  // Focus input when panel opens
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 300);
    return () => clearTimeout(t);
  }, []);

  const handleSend = useCallback(() => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    // Debounce 1s
    if (Date.now() - lastSendTime.current < 1000) return;
    lastSendTime.current = Date.now();
    onSendMessage(trimmed);
    setInputValue("");
  }, [inputValue, onSendMessage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  // Build compact nav from hint actions
  const navActions = hint
    ? [hint.primary, ...hint.alternatives].slice(0, 4)
    : null;

  const placeholder = labels.chatPlaceholder ?? (locale === "ja" ? "メッセージを入力..." : "Nhập tin nhắn...");
  const sendLabel = labels.chatSend ?? (locale === "ja" ? "送信" : "Gửi");

  return (
    <div
      className="pointer-events-auto motion-safe:animate-[panelSlideUp_0.25s_ease-out_both] absolute bottom-full right-0 mb-3 w-[min(22rem,calc(100vw-2rem))]"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex flex-col rounded-2xl border border-ink/10 bg-surface/95 shadow-2xl backdrop-blur-lg">
        {/* ── Header ── */}
        <div className="flex items-center justify-between border-b border-ink/5 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-xs shadow-sm">
              🐕
            </span>
            <div>
              <h2 className="text-sm font-bold text-ink">
                {isLoggedIn ? labels.title : labels.guestTitle}
              </h2>
              <p className="text-[10px] text-muted">
                {hintLoading ? labels.moodThinking : labels.moodIdle}
                {streakDays > 0 && isLoggedIn ? (
                  <span className="ml-1.5 inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700">
                    🔥 {streakDays}
                  </span>
                ) : null}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              aria-label={isMuted ? labels.unmuteBubble : labels.muteBubble}
              className="grid h-7 w-7 place-items-center rounded-full text-xs text-muted transition hover:bg-ink/5 hover:text-ink"
              onClick={onMuteToggle}
              title={isMuted ? labels.unmuteBubble : labels.muteBubble}
              type="button"
            >
              {isMuted ? "🔇" : "🔔"}
            </button>
            <button
              aria-label={labels.close}
              className="grid h-7 w-7 place-items-center rounded-full text-xs font-bold text-muted transition hover:bg-ink/5 hover:text-ink"
              onClick={onClose}
              type="button"
            >
              ✕
            </button>
          </div>
        </div>

        {/* ── Messages body ── */}
        <div ref={scrollRef} className="max-h-[45vh] min-h-[8rem] overflow-y-auto px-3 py-3">
          {isLoggedIn ? (
            <div className="space-y-3">
              {messages.length > 0 ? (
                messages.slice(-12).map((msg) => (
                  <CompanionMessageItem key={msg.id} locale={locale} message={msg} />
                ))
              ) : (
                <div className="flex flex-col items-center gap-2 py-4 text-center">
                  <span className="text-2xl">🐕</span>
                  <p className="text-xs text-muted">{labels.messagesEmpty}</p>
                </div>
              )}

              {/* Loading indicator */}
              {hintLoading ? (
                <div className="flex gap-2">
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[10px]">
                    🐕
                  </span>
                  <div className="rounded-2xl rounded-tl-sm bg-amber-50 px-3 py-2 text-xs text-muted">
                    <span className="inline-flex gap-1">
                      <span className="animate-bounce">.</span>
                      <span className="animate-bounce" style={{ animationDelay: "0.1s" }}>.</span>
                      <span className="animate-bounce" style={{ animationDelay: "0.2s" }}>.</span>
                    </span>
                  </div>
                </div>
              ) : null}

              {hintError ? (
                <p className="text-center text-[11px] text-sakura">{labels.hintError}</p>
              ) : null}
            </div>
          ) : (
            /* Guest state */
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <span className="text-3xl">🐕</span>
              <p className="text-xs text-ink">{labels.guestSubtitle}</p>
              <a
                className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-[#1B2A4A] to-[#2563EB] px-5 py-2 text-xs font-bold text-white shadow-md transition hover:shadow-lg"
                href={`${base}/login`}
              >
                {labels.guestCta}
              </a>
            </div>
          )}
        </div>

        {/* ── Quick reply chips ── */}
        {isLoggedIn ? (
          <div className="flex gap-1.5 overflow-x-auto border-t border-ink/5 px-3 py-2 scrollbar-hide">
            {quickReplies.map((chip) => (
              <button
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-ink/10 bg-paper px-2.5 py-1 text-[11px] font-medium text-ink transition hover:bg-ink/5 active:scale-95"
                key={chip.id}
                onClick={() => onQuickReply(chip.id)}
                type="button"
              >
                <span>{chip.icon}</span>
                <span>{locale === "ja" ? chip.labelJa : chip.labelVi}</span>
              </button>
            ))}
          </div>
        ) : null}

        {/* ── Chat input ── */}
        {isLoggedIn ? (
          <div className="flex items-center gap-2 border-t border-ink/5 px-3 py-2">
            <input
              ref={inputRef}
              className="min-w-0 flex-1 rounded-xl border border-ink/10 bg-paper px-3 py-1.5 text-xs text-ink placeholder:text-muted/60 outline-none transition focus:border-accent/40 focus:ring-1 focus:ring-accent/20"
              maxLength={200}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              type="text"
              value={inputValue}
            />
            <button
              aria-label={sendLabel}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-r from-[#1B2A4A] to-[#2563EB] text-xs text-white shadow-sm transition hover:shadow-md active:scale-95 disabled:opacity-40"
              disabled={!inputValue.trim()}
              onClick={handleSend}
              type="button"
            >
              ➤
            </button>
          </div>
        ) : null}

        {/* ── Compact nav footer ── */}
        {isLoggedIn && navActions && navActions.length > 0 ? (
          <div className="flex items-center justify-around border-t border-ink/5 px-2 py-1.5">
            {navActions.map((act) => (
              <a
                className="flex flex-col items-center gap-0.5 rounded-lg px-2 py-1 text-center transition hover:bg-ink/5"
                href={`${base}${act.hrefSuffix}`}
                key={act.action}
              >
                <span className="text-sm">{ACTION_ICONS[act.action] ?? "📌"}</span>
                <span className="text-[9px] font-medium text-muted">{actionLabel(act.action, labels)}</span>
              </a>
            ))}
          </div>
        ) : isLoggedIn && !hint && !hintLoading ? (
          <div className="flex items-center justify-around border-t border-ink/5 px-2 py-1.5">
            <a className="flex flex-col items-center gap-0.5 rounded-lg px-2 py-1 transition hover:bg-ink/5" href={`${base}/flashcards`}>
              <span className="text-sm">📚</span>
              <span className="text-[9px] font-medium text-muted">{labels.actionReview}</span>
            </a>
            <a className="flex flex-col items-center gap-0.5 rounded-lg px-2 py-1 transition hover:bg-ink/5" href={`${base}/battle`}>
              <span className="text-sm">⚔️</span>
              <span className="text-[9px] font-medium text-muted">{labels.actionBattle}</span>
            </a>
            <a className="flex flex-col items-center gap-0.5 rounded-lg px-2 py-1 transition hover:bg-ink/5" href={`${base}/quiz`}>
              <span className="text-sm">📝</span>
              <span className="text-[9px] font-medium text-muted">{labels.actionQuiz}</span>
            </a>
            <a className="flex flex-col items-center gap-0.5 rounded-lg px-2 py-1 transition hover:bg-ink/5" href={`${base}/analytics`}>
              <span className="text-sm">📊</span>
              <span className="text-[9px] font-medium text-muted">{labels.actionAnalytics}</span>
            </a>
          </div>
        ) : null}

        {/* Tail */}
        <div className="absolute -bottom-[6px] right-8 h-3 w-3 rotate-45 border-b border-r border-ink/10 bg-surface/95" />
      </div>
    </div>
  );
}
