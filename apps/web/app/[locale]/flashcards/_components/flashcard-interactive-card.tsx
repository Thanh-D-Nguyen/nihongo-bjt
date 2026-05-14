"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@nihongo-bjt/ui";

/* ─── Types ─── */

export interface MentorLabels {
  mentorAgainEmoji: string;
  mentorAgainText: string;
  mentorGoodEmoji: string;
  mentorGoodText: string;
  mentorHardEmoji: string;
  mentorHardText: string;
  mentorMilestone5: string;
  mentorMilestone10: string;
  mentorMilestone25: string;
  mentorName: string;
  streakLabel: string;
}

type Rating = "again" | "hard" | "good";

interface FlashcardInteractiveCardProps {
  /** Main content — rendered inside the card body */
  answerContent: React.ReactNode;
  /** Existing comeback/feedback block */
  comebackContent: React.ReactNode | null;
  /** Whether compact mode is active */
  compact?: boolean;
  /** Unique card id — triggers enter animation on change */
  cardId: string;
  /** Whether answer is revealed */
  revealed: boolean;
  /** Image node (rendered above front text) */
  imageNode: React.ReactNode | null;
  /** Front text (Japanese) */
  frontText: string;
  /** Reading (furigana) */
  reading: string | null;
  /** Phase eyebrow labels */
  phaseLabel: string;
  /** Rating button labels */
  ratingLabels: { again: string; hard: string; good: string };
  /** Reveal button label */
  revealLabel: string;
  /** Mentor i18n labels */
  mentorLabels: MentorLabels;
  /** Image upload section (optional footer) */
  imageUploadNode: React.ReactNode | null;
  /** Callbacks */
  onReveal: () => void;
  onRate: (rating: Rating) => void;
  /** Whether feedback/comeback is active (disables rating buttons) */
  feedbackActive: boolean;
  /** Session progress: reviewed / total */
  sessionReviewed: number;
  sessionTotal: number;
}

/* ─── Streak state (persisted across cards within a session) ─── */

function useStreak() {
  const [streak, setStreak] = useState(0);
  const [milestone, setMilestone] = useState<number | null>(null);
  const milestoneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bump = useCallback((rating: Rating) => {
    if (rating === "again") {
      setStreak(0);
      return;
    }
    setStreak((prev) => {
      const next = prev + 1;
      if (next === 5 || next === 10 || next === 25 || next === 50) {
        setMilestone(next);
        if (milestoneTimer.current) clearTimeout(milestoneTimer.current);
        milestoneTimer.current = setTimeout(() => {
          setMilestone(null);
          milestoneTimer.current = null;
        }, 2200);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    return () => {
      if (milestoneTimer.current) clearTimeout(milestoneTimer.current);
    };
  }, []);

  return { bump, milestone, streak };
}

/* ─── Mentor reaction ─── */

function MentorBubble({
  exiting,
  labels,
  milestone,
  rating,
}: {
  exiting: boolean;
  labels: MentorLabels;
  milestone: number | null;
  rating: Rating;
}) {
  const emoji =
    rating === "good"
      ? labels.mentorGoodEmoji
      : rating === "hard"
        ? labels.mentorHardEmoji
        : labels.mentorAgainEmoji;

  const text =
    rating === "good"
      ? labels.mentorGoodText
      : rating === "hard"
        ? labels.mentorHardText
        : labels.mentorAgainText;

  const milestoneText =
    milestone === 5
      ? labels.mentorMilestone5
      : milestone === 10
        ? labels.mentorMilestone10
        : milestone === 25
          ? labels.mentorMilestone25
          : null;

  const borderColor =
    rating === "good"
      ? "border-leaf/30 bg-leaf-soft/50"
      : rating === "hard"
        ? "border-sun/30 bg-sun/10"
        : "border-sakura/25 bg-sakura/8";

  return (
    <div
      className={cn(
        "relative mt-3 flex items-start gap-3 rounded-2xl border px-4 py-3",
        borderColor,
        exiting ? "fc-mentor-exit" : "fc-mentor-enter"
      )}
      role="status"
      aria-live="polite"
    >
      {/* Mentor avatar */}
      <div className="fc-avatar-pulse flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-lg shadow-sm ring-1 ring-ink/10">
        {emoji}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
          {labels.mentorName}
        </p>
        <p className="mt-0.5 text-sm leading-relaxed text-ink">{text}</p>
        {milestoneText && milestone ? (
          <div className="fc-milestone-burst mt-2 inline-flex items-center gap-1.5 rounded-lg bg-white/80 px-2.5 py-1 text-xs font-bold text-leaf shadow-sm ring-1 ring-leaf/20">
            <span className="fc-confetti">
              🔥
              <span className="fc-confetti-extra" aria-hidden />
            </span>
            {milestoneText.replace("{n}", String(milestone))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ─── Progress Ring ─── */

function ProgressRing({
  reviewed,
  total,
  size = 44,
  strokeWidth = 3.5,
}: {
  reviewed: number;
  size?: number;
  strokeWidth?: number;
  total: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = total > 0 ? Math.min(reviewed / total, 1) : 0;
  const offset = circumference * (1 - progress);

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle
          className="fc-progress-ring-track"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
        />
        <circle
          className="fc-progress-ring-fill"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          style={{
            "--fc-ring-circumference": circumference,
            "--fc-ring-offset": offset,
          } as React.CSSProperties}
        />
      </svg>
      <span className="absolute text-[10px] font-bold tabular-nums text-ink">
        {reviewed}
      </span>
    </div>
  );
}

/* ─── Streak Badge ─── */

function StreakBadge({ label, streak }: { label: string; streak: number }) {
  if (streak < 2) return null;
  return (
    <span
      className={cn(
        "fc-streak-pop inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold tabular-nums shadow-sm ring-1",
        streak >= 10
          ? "bg-gradient-to-r from-leaf/90 to-leaf text-white ring-leaf/30"
          : streak >= 5
            ? "bg-leaf-soft/70 text-leaf ring-leaf/25"
            : "bg-paper text-muted ring-ink/10"
      )}
      key={streak}
    >
      <span aria-hidden>{streak >= 10 ? "🔥" : streak >= 5 ? "⚡" : "✦"}</span>
      {label}: {streak}
    </span>
  );
}

/* ─── Main Component ─── */

const btnBase =
  "inline-flex min-h-10 items-center justify-center rounded-xl px-4 text-sm font-bold outline-none ring-offset-2 transition focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-45";
const btnPrimary = `${btnBase} bg-leaf text-white hover:bg-leaf/90 fc-btn-press`;
const btnSecondary = `${btnBase} border border-ink/15 bg-surface text-ink hover:border-ink/25 hover:bg-paper fc-btn-press`;
const btnNeutral = `${btnBase} border border-ink/12 bg-paper/80 text-ink hover:bg-paper fc-btn-press`;

export function FlashcardInteractiveCard({
  answerContent,
  cardId,
  comebackContent,
  compact = false,
  feedbackActive,
  frontText,
  imageNode,
  imageUploadNode,
  mentorLabels,
  onRate,
  onReveal,
  phaseLabel,
  ratingLabels,
  reading,
  revealed,
  revealLabel,
  sessionReviewed,
  sessionTotal,
}: FlashcardInteractiveCardProps) {
  const { bump, milestone, streak } = useStreak();
  const [cardAnim, setCardAnim] = useState<"enter" | "exit" | "idle">("enter");
  const [mentorState, setMentorState] = useState<{
    exiting: boolean;
    rating: Rating;
  } | null>(null);
  const mentorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevCardId = useRef(cardId);

  // Trigger enter animation on card change
  useEffect(() => {
    if (cardId !== prevCardId.current) {
      setCardAnim("enter");
      prevCardId.current = cardId;
      const t = setTimeout(() => setCardAnim("idle"), 400);
      return () => clearTimeout(t);
    }
  }, [cardId]);

  // Clean up mentor timer
  useEffect(() => {
    return () => {
      if (mentorTimer.current) clearTimeout(mentorTimer.current);
    };
  }, []);

  const handleRate = useCallback(
    (rating: Rating) => {
      bump(rating);

      // Show mentor bubble briefly for "good" and "hard"
      if (rating !== "again") {
        setMentorState({ exiting: false, rating });
        if (mentorTimer.current) clearTimeout(mentorTimer.current);
        mentorTimer.current = setTimeout(() => {
          setMentorState((prev) => (prev ? { ...prev, exiting: true } : null));
          setTimeout(() => {
            setMentorState(null);
          }, 280);
        }, 1600);
      }

      // Exit animation then call parent
      setCardAnim("exit");
      const exitDelay = rating === "again" ? 100 : 350;
      setTimeout(() => {
        onRate(rating);
        setCardAnim("enter");
        setTimeout(() => setCardAnim("idle"), 400);
      }, exitDelay);
    },
    [bump, onRate]
  );

  return (
    <div
      className={cn(
        "max-w-3xl",
        cardAnim === "enter" && "fc-card-enter",
        cardAnim === "exit" && "fc-card-exit"
      )}
    >
      <div
        className={cn(
          "border border-ink/10 bg-surface",
          compact
            ? "rounded-3xl p-5 shadow-md ring-1 ring-ink/[0.05] sm:p-6"
            : "rounded-2xl p-4 shadow-sm sm:p-5",
          revealed && "fc-card-reveal"
        )}
      >
        <article className="space-y-4">
          {/* Header: phase label + streak + progress */}
          <div className="flex items-center justify-between gap-2">
            {!feedbackActive ? (
              <p className="text-[11px] font-black uppercase tracking-wider text-leaf">
                {phaseLabel}
              </p>
            ) : (
              <div />
            )}
            <div className="flex items-center gap-2">
              <StreakBadge label={mentorLabels.streakLabel} streak={streak} />
              <ProgressRing
                reviewed={sessionReviewed}
                total={sessionTotal}
              />
            </div>
          </div>

          {/* Card front */}
          <div className="min-h-[7rem]">
            {imageNode}
            <p
              className={`font-bold leading-snug text-ink ${compact ? "text-lg sm:text-xl" : "text-xl sm:text-2xl"}`}
              lang="ja"
            >
              {frontText}
            </p>
            {reading ? (
              <p className="mt-2 min-h-[1.25rem] text-sm text-muted" lang="ja">
                {reading}
              </p>
            ) : (
              <div className="min-h-[1.25rem]" />
            )}
          </div>

          {/* Answer (animated entrance) */}
          {revealed ? (
            <div className="fc-answer-enter min-h-[7rem] rounded-xl border border-ink/10 bg-paper/50 p-4">
              {answerContent}
            </div>
          ) : null}

          {/* Mentor reaction bubble */}
          {mentorState ? (
            <MentorBubble
              exiting={mentorState.exiting}
              labels={mentorLabels}
              milestone={milestone}
              rating={mentorState.rating}
            />
          ) : null}

          {/* Existing comeback content (for "again" rating) */}
          {comebackContent}

          {/* Action buttons */}
          <div className="fc-btn-stagger flex flex-wrap gap-2 pt-1">
            {!revealed && !feedbackActive ? (
              <button
                className={`${btnPrimary} min-h-11 px-6 text-base sm:min-h-12`}
                onClick={onReveal}
                type="button"
              >
                {revealLabel}
              </button>
            ) : !feedbackActive ? (
              <>
                <button
                  className={`${btnNeutral} min-h-10`}
                  onClick={() => handleRate("again")}
                  type="button"
                >
                  {ratingLabels.again}
                </button>
                <button
                  className={`${btnSecondary} min-h-10`}
                  onClick={() => handleRate("hard")}
                  type="button"
                >
                  {ratingLabels.hard}
                </button>
                <button
                  className={`${btnPrimary} min-h-10`}
                  onClick={() => handleRate("good")}
                  type="button"
                >
                  {ratingLabels.good}
                </button>
              </>
            ) : null}
          </div>

          {/* Image upload section */}
          {imageUploadNode}
        </article>
      </div>
    </div>
  );
}
