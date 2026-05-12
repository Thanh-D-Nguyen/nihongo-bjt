"use client";

import type { BattleBotAnimationState, CompanionEventKind, CompanionHintResponse, CompanionReasonCode } from "@nihongo-bjt/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useKeycloakAuth } from "../../components/auth/keycloak-auth-provider";
import { learnerApiFetch } from "../../lib/learner-api";
import { useCompanionEngine } from "../_hooks/use-companion-engine";
import { BattleBotAvatar } from "./battle-bot-avatar";
import { CompanionChatPanel, type CompanionChatPanelLabels } from "./companion-chat-panel";
import { CompanionCelebrationOverlay } from "./companion-message";
import { CompanionOnboarding, type CompanionOnboardingLabels } from "./companion-onboarding";
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

/* ── Mood → Rive state mapping ── */

function moodToRiveState(mood: CompanionMood): BattleBotAnimationState {
  switch (mood) {
    case "wave": case "happy": case "cheer": case "dance": case "surprise": return "correct";
    case "talk": case "think": return "thinking";
    case "sleep": case "sad": return "abandoned";
    default: return "idle";
  }
}

/* ── Idle expression cycling ── */

const IDLE_MOOD_CYCLE: CompanionMood[] = ["idle", "wave", "idle", "happy", "idle", "dance", "idle", "cheer"];

/* ── Layout constants ── */

const HOME_BOTTOM = 80;
const HOME_RIGHT = 16;
const MASCOT_SIZE = 80;

/* ── Main component ── */

export function CompanionBot({ base, labels, locale }: { base: string; labels: CompanionBotLabels; locale: string }) {
  const { accessToken } = useKeycloakAuth();
  const isLoggedIn = Boolean(accessToken);
  const [open, setOpen] = useState(false);
  const [hint, setHint] = useState<CompanionHintResponse | null>(null);
  const [hintLoading, setHintLoading] = useState(false);
  const [hintError, setHintError] = useState(false);
  const [showBubble, setShowBubble] = useState(false);
  const [moodIndex, setMoodIndex] = useState(0);
  const bubbleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Engine ──
  const engine = useCompanionEngine({
    hint,
    isLoggedIn,
    locale,
    base,
  });

  const handleTap = useCallback(() => {
    engine.wakeUp();
    setOpen((prev) => {
      if (!prev) engine.memory.incrementPanelOpen();
      return !prev;
    });
  }, [engine]);

  // ── Expression cycling (every 6s when idle, deferred to engine mood when active) ──
  useEffect(() => {
    if (open || engine.sleeping) return;
    const t = setInterval(() => {
      setMoodIndex((i) => (i + 1) % IDLE_MOOD_CYCLE.length);
    }, 6000);
    return () => clearInterval(t);
  }, [open, engine.sleeping]);

  // ── Auto speech bubble (context-aware from engine) ──
  useEffect(() => {
    if (open || engine.memory.memory.bubbleMuted) { setShowBubble(false); return; }
    const show = () => {
      setShowBubble(true);
      bubbleTimer.current = setTimeout(() => {
        setShowBubble(false);
        bubbleTimer.current = setTimeout(show, 20000);
      }, 6000);
    };
    const initial = setTimeout(show, 3000);
    return () => {
      clearTimeout(initial);
      if (bubbleTimer.current) clearTimeout(bubbleTimer.current);
    };
  }, [open, engine.memory.memory.bubbleMuted]);

  // ── Hint API ──
  const loadHint = useCallback(async () => {
    setHintLoading(true);
    setHintError(false);
    try {
      const res = await learnerApiFetch("/api/companion/hint?days=7");
      if (!res.ok) { setHintError(true); setHint(null); return; }
      setHint((await res.json()) as CompanionHintResponse);
    } catch {
      setHintError(true); setHint(null);
    } finally {
      setHintLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open || !isLoggedIn) return;
    void loadHint();
  }, [isLoggedIn, loadHint, open]);

  // ── Mood computation ──
  const mood = useMemo<CompanionMood>(() => {
    // Engine mood takes priority for celebrations/reactions
    if (engine.mood !== "idle") return engine.mood;
    if (engine.sleeping) return "sleep";
    if (hintLoading) return "think";
    if (open) return "talk";
    return IDLE_MOOD_CYCLE[moodIndex] ?? "idle";
  }, [engine.mood, engine.sleeping, hintLoading, moodIndex, open]);

  const riveState = useMemo(() => moodToRiveState(mood), [mood]);

  // ── Bubble text from engine ──
  const bubbleTextForSpeech = engine.bubbleText;
  const bubbleMoodForSpeech = engine.bubbleMood;

  // ── Chat panel labels (map from existing labels + new defaults) ──
  const chatLabels = useMemo<CompanionChatPanelLabels>(() => ({
    ...labels,
    messagesEmpty: labels.messagesEmpty ?? (locale === "ja" ? "メッセージはまだありません" : "Chưa có tin nhắn"),
    tipSectionLabel: labels.tipSectionLabel ?? (locale === "ja" ? "今日のヒント" : "Mẹo hôm nay"),
    quickActionsLabel: labels.quickActionsLabel ?? labels.secondaryLabel,
    muteBubble: labels.muteBubble ?? (locale === "ja" ? "通知をオフ" : "Tắt bong bóng"),
    unmuteBubble: labels.unmuteBubble ?? (locale === "ja" ? "通知をオン" : "Bật bong bóng"),
  }), [labels, locale]);

  // ── Onboarding labels ──
  const onboardingLabels = useMemo<CompanionOnboardingLabels>(() => ({
    step1Title: labels.onboardingStep1Title ?? (locale === "ja" ? "こんにちは！🐕" : "Xin chào! 🐕"),
    step1Body: labels.onboardingStep1Body ?? (locale === "ja" ? "私はシバ、あなたの学習パートナーです。一緒に日本語を学びましょう！" : "Mình là Shiba, bạn đồng hành học tập của bạn. Cùng học tiếng Nhật nhé!"),
    step2Title: labels.onboardingStep2Title ?? (locale === "ja" ? "私にできること 📚" : "Mình có thể giúp gì 📚"),
    step2Body: labels.onboardingStep2Body ?? (locale === "ja" ? "復習リマインダー、BJTヒント、日本語ミニレッスン、達成のお祝いなど！" : "Nhắc ôn tập, gợi ý BJT, mini bài học tiếng Nhật, chúc mừng thành tích!"),
    step3Title: labels.onboardingStep3Title ?? (locale === "ja" ? "始めましょう！ 🚀" : "Bắt đầu nào! 🚀"),
    step3Body: labels.onboardingStep3Body ?? (locale === "ja" ? "いつでもクリックして話しかけてね。ドラッグで移動もできるよ！" : "Click vào mình bất cứ lúc nào để trò chuyện. Kéo thả để di chuyển nhé!"),
    next: labels.onboardingNext ?? (locale === "ja" ? "次へ" : "Tiếp"),
    skip: labels.onboardingSkip ?? (locale === "ja" ? "スキップ" : "Bỏ qua"),
    finish: labels.onboardingFinish ?? (locale === "ja" ? "始める！" : "Bắt đầu!"),
  }), [labels, locale]);

  const handleMuteToggle = useCallback(() => {
    engine.memory.update({ bubbleMuted: !engine.memory.memory.bubbleMuted });
  }, [engine.memory]);

  // ── Expose pushEvent globally for other components ──
  useEffect(() => {
    const handler = (e: CustomEvent<{ kind: CompanionEventKind; params?: Record<string, string | number> }>) => {
      engine.pushEvent(e.detail.kind, e.detail.params);
    };
    window.addEventListener("companion:event" as string, handler as EventListener);
    return () => window.removeEventListener("companion:event" as string, handler as EventListener);
  }, [engine]);

  return (
    <aside
      aria-label={labels.ariaLabel}
      className="pointer-events-none fixed inset-0 z-30"
    >
      {/* Celebration overlay */}
      <CompanionCelebrationOverlay emoji={engine.celebrationEmoji} visible={engine.showCelebration} />

      {/* Mascot container */}
      <div
        className="pointer-events-auto absolute"
        style={{
          bottom: `max(${HOME_BOTTOM}px, calc(${HOME_BOTTOM}px + env(safe-area-inset-bottom)))`,
          right: `${HOME_RIGHT}px`,
          width: `${MASCOT_SIZE}px`,
        }}
      >
        {/* Chat panel */}
        {open ? (
          <CompanionChatPanel
            base={base}
            hint={hint}
            hintError={hintError}
            hintLoading={hintLoading}
            isLoggedIn={isLoggedIn}
            isMuted={engine.memory.memory.bubbleMuted}
            labels={chatLabels}
            locale={locale}
            messages={engine.messages}
            onClose={() => setOpen(false)}
            onMuteToggle={handleMuteToggle}
            onQuickReply={engine.handleQuickReply}
            onSendMessage={engine.handleUserMessage}
            quickReplies={engine.quickReplies}
            streakDays={engine.memory.memory.localStreakDays}
          />
        ) : null}

        {/* Onboarding overlay */}
        {!open && engine.isOnboarding ? (
          <CompanionOnboarding
            currentStep={engine.onboardingStep}
            labels={onboardingLabels}
            onAdvance={engine.advanceOnboarding}
            onDismiss={engine.dismissOnboarding}
          />
        ) : null}

        {/* Speech bubble (context-aware from engine) */}
        {!open && !engine.isOnboarding ? (
          <div className="absolute bottom-full right-[-8px] mb-2">
            <CompanionSpeechBubble
              customText={bubbleTextForSpeech}
              locale={locale}
              mood={bubbleMoodForSpeech}
              visible={showBubble}
            />
          </div>
        ) : null}

        {/* Mascot */}
        <div
          className={`cursor-pointer transition-[opacity,filter,transform] duration-300 ${engine.sleeping ? "opacity-50 grayscale-[40%]" : "opacity-100"} ${open ? "scale-110" : "hover:scale-110 active:scale-95"} ${engine.showCelebration ? "motion-safe:animate-[bounce_0.5s_ease-in-out_2]" : ""}`}
          onClick={handleTap}
          tabIndex={0}
          aria-label={open ? labels.close : labels.collapsedLabel}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleTap(); } }}
        >
          <BattleBotAvatar
            className="h-full w-full drop-shadow-[0_4px_12px_rgba(0,0,0,0.15)]"
            fallback="🐕"
            rive={companionRive}
            showSignal={!open && isLoggedIn}
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
