"use client";

import type { BattleBotAnimationState, CompanionEventKind, CompanionReasonCode } from "@nihongo-bjt/shared";
import { useCallback, useEffect, useRef, useState } from "react";

import { BattleBotAvatar } from "./battle-bot-avatar";
import { CompanionSpeechBubble, type CompanionMood } from "./companion-speech-bubble";

export type CompanionBotReasonLabels = Record<CompanionReasonCode, string>;

export type CompanionBotLabels = {
  actionAnalytics: string;
  actionBattle: string;
  actionDaily: string;
  actionQuiz: string;
  actionReview: string;
  ariaLabel: string;
  close: string;
  collapsedLabel: string;
  guestCta: string;
  guestSubtitle: string;
  guestTitle: string;
  hintError: string;
  hintLoading: string;
  moodIdle: string;
  moodThinking: string;
  primaryCtaAria: string;
  reasons: CompanionBotReasonLabels;
  secondaryLabel: string;
  subtitle: string;
  title: string;
  /* New labels for upgraded companion */
  messagesEmpty?: string;
  tipSectionLabel?: string;
  quickActionsLabel?: string;
  muteBubble?: string;
  unmuteBubble?: string;
  onboardingStep1Title?: string;
  onboardingStep1Body?: string;
  onboardingStep2Title?: string;
  onboardingStep2Body?: string;
  onboardingStep3Title?: string;
  onboardingStep3Body?: string;
  onboardingNext?: string;
  onboardingSkip?: string;
  onboardingFinish?: string;
  chatPlaceholder?: string;
  chatSend?: string;
};

const companionRive = {
  artboard: null,
  src: "/assets/battle/bots/18912-35694-lil-guy.riv",
  stateMachine: null
};

type MascotTip = {
  ja: string;
  vi: string;
  en: string;
  mood: CompanionMood;
};

const MASCOT_TIPS: readonly MascotTip[] = [
  {
    ja: "お疲れ様です！今日も一歩ずつ進みましょう。",
    vi: "Chúc bạn giữ nhịp học BJT vững vàng hôm nay!",
    en: "Great work today! One steady BJT step at a time.",
    mood: "cheer"
  },
  {
    ja: "「恐れ入りますが」は職場での丁寧な切り出しに便利です。",
    vi: "Mẹo công sở: mở đầu lịch sự bằng 「恐れ入りますが」.",
    en: "Workplace tip: open polite requests with 「恐れ入りますが」.",
    mood: "wave"
  },
  {
    ja: "毎日の短い復習が、確かな実力につながります。",
    vi: "Ôn nhanh vài thẻ SRS mỗi ngày giúp nhớ lâu hơn hẳn!",
    en: "Short daily SRS reviews build lasting recall.",
    mood: "happy"
  },
  {
    ja: "メールの結びは「よろしくお願いいたします」で丁寧に。",
    vi: "Mẹo công sở: kết email lịch sự với 「よろしくお願いいたします」.",
    en: "Workplace tip: close business emails with 「よろしくお願いいたします」.",
    mood: "wave"
  },
  {
    ja: "連続学習リズムを大切に。応援しています！",
    vi: "Giữ chuỗi học đều đặn nhé — Shiba luôn cổ vũ bạn!",
    en: "Keep your study rhythm going — cheering you on!",
    mood: "cheer"
  }
];

/* ── Mood → Rive state mapping ── */

function moodToRiveState(mood: CompanionMood): BattleBotAnimationState {
  switch (mood) {
    case "wave":
    case "happy":
    case "cheer":
    case "dance":
    case "surprise":
      return "correct";
    case "talk":
    case "think":
      return "thinking";
    case "sleep":
    case "sad":
      return "abandoned";
    default:
      return "idle";
  }
}

/* ── Layout constants ── */

/* The mascot's bottom offset lives in responsive classes on the container:
   below lg it must clear the ~57px mobile bottom navigation plus a gap,
   on lg it keeps the original 24px offset. Both add the safe-area inset. */
const HOME_RIGHT = 20;
const MASCOT_SIZE = 48;
const BUBBLE_AUTO_HIDE_MS = 4000;

/* ── Main component (mascot-only mode on /{locale} and /{locale}/me) ── */

export function CompanionBot({
  labels,
  locale
}: {
  base?: string;
  labels: CompanionBotLabels;
  locale: string;
}) {
  const [tipIndex, setTipIndex] = useState(-1);
  const [bubbleVisible, setBubbleVisible] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current !== null) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  useEffect(() => clearHideTimer, [clearHideTimer]);

  const handleTap = useCallback(() => {
    setTipIndex((prev) => (prev + 1) % MASCOT_TIPS.length);
    setBubbleVisible(true);
    clearHideTimer();
    hideTimerRef.current = setTimeout(() => {
      setBubbleVisible(false);
      hideTimerRef.current = null;
    }, BUBBLE_AUTO_HIDE_MS);
  }, [clearHideTimer]);

  const activeTip = tipIndex >= 0 ? MASCOT_TIPS[tipIndex] : null;
  const mood: CompanionMood = bubbleVisible && activeTip ? activeTip.mood : "idle";
  const riveState = moodToRiveState(mood);

  return (
    <aside
      aria-label={labels.ariaLabel}
      className="pointer-events-none fixed inset-0 z-30"
    >
      {/* Mascot container */}
      <div
        className="pointer-events-auto absolute bottom-[calc(69px_+_env(safe-area-inset-bottom))] lg:bottom-[max(24px,calc(24px_+_env(safe-area-inset-bottom)))]"
        style={{
          height: `${MASCOT_SIZE}px`,
          right: `${HOME_RIGHT}px`,
          width: `${MASCOT_SIZE}px`
        }}
      >
        {/* Tap-to-delight short speech bubble (auto-hides after 4s, zero API calls) */}
        <div className="absolute bottom-full right-[-8px] mb-2">
          <CompanionSpeechBubble
            customText={activeTip ? { ja: activeTip.ja, vi: activeTip.vi, en: activeTip.en } : null}
            locale={locale}
            mood={mood}
            visible={bubbleVisible}
          />
        </div>

        {/* Mascot */}
        <div
          aria-label={bubbleVisible ? labels.close : labels.collapsedLabel}
          className={`h-full w-full cursor-pointer overflow-visible opacity-90 transition-[opacity,filter,transform] duration-200 hover:opacity-100 ${
            bubbleVisible ? "scale-105" : "hover:scale-105 active:scale-95"
          }`}
          onClick={handleTap}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleTap();
            }
          }}
          role="button"
          tabIndex={0}
        >
          <BattleBotAvatar
            className="h-full w-full drop-shadow-[0_4px_12px_rgba(0,0,0,0.15)]"
            fallback="🐕"
            rive={companionRive}
            showSignal={false}
            state={riveState}
            variant="companion"
          />
        </div>
      </div>
    </aside>
  );
}

/* ── Helper to dispatch companion events from anywhere ── */

export function dispatchCompanionEvent(kind: CompanionEventKind, params?: Record<string, string | number>) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("companion:event", { detail: { kind, params } }));
}
