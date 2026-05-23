"use client";

import { cn } from "@nihongo-bjt/ui";
import { useCallback, useEffect, useState } from "react";
import { learnerApiFetch } from "../../../../lib/learner-api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OnboardingFlowProps {
  onComplete: (didComplete?: boolean) => void;
}

type Step = "level" | "goal" | "topics" | "time" | "style";

interface Answers {
  currentLevel: number;
  goal: string;
  topics: string[];
  dailyMinutes: number;
  style: string;
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const LEVELS = [
  { value: 5, label: "N5 — Mới bắt đầu", desc: "Hiragana, từ cơ bản", emoji: "🌱" },
  { value: 4, label: "N4 — Sơ cấp", desc: "Giao tiếp đơn giản", emoji: "📗" },
  { value: 3, label: "N3 — Trung cấp", desc: "Đọc báo dễ, hội thoại", emoji: "📘" },
  { value: 2, label: "N2 — Trung-cao cấp", desc: "Làm việc bằng tiếng Nhật", emoji: "📙" },
  { value: 1, label: "N1 — Cao cấp", desc: "Tiếng Nhật gần native", emoji: "🎓" },
  { value: 0, label: "Chưa biết", desc: "Để hệ thống đánh giá sau", emoji: "🤔" },
];

const GOALS = [
  { value: "pass_bjt", label: "Thi đỗ BJT", desc: "Chuẩn bị cho kỳ thi BJT", emoji: "🏆" },
  { value: "business_japanese", label: "Tiếng Nhật công sở", desc: "Email, họp, thuyết trình", emoji: "💼" },
  { value: "daily_conversation", label: "Giao tiếp hàng ngày", desc: "Mua sắm, nhà hàng, giao thông", emoji: "🗣️" },
  { value: "reading_news", label: "Đọc hiểu tin tức", desc: "NHK, báo chí, tài liệu", emoji: "📰" },
  { value: "jlpt_prep", label: "Ôn thi JLPT", desc: "Ngữ pháp, từ vựng, đọc hiểu", emoji: "📝" },
  { value: "travel", label: "Du lịch Nhật Bản", desc: "Hỏi đường, đặt phòng, giao tiếp", emoji: "✈️" },
  { value: "general", label: "Học chung", desc: "Không mục tiêu cụ thể", emoji: "🌸" },
];

const TOPICS = [
  { value: "business_meeting", label: "Họp hành", emoji: "🤝" },
  { value: "business_email", label: "Viết email", emoji: "📧" },
  { value: "business_phone", label: "Điện thoại", emoji: "📞" },
  { value: "business_presentation", label: "Thuyết trình", emoji: "📊" },
  { value: "daily_greetings", label: "Chào hỏi", emoji: "👋" },
  { value: "daily_shopping", label: "Mua sắm", emoji: "🛍️" },
  { value: "daily_restaurant", label: "Nhà hàng", emoji: "🍜" },
  { value: "daily_transport", label: "Đi lại", emoji: "🚃" },
  { value: "news_economy", label: "Kinh tế", emoji: "📈" },
  { value: "news_technology", label: "Công nghệ", emoji: "💻" },
  { value: "news_culture", label: "Văn hoá", emoji: "🎌" },
  { value: "keigo", label: "Kính ngữ", emoji: "🎩" },
  { value: "kanjii", label: "Kanji", emoji: "漢" },
  { value: "idioms", label: "Thành ngữ", emoji: "💡" },
];

const TIME_OPTIONS = [
  { value: 5, label: "5 phút", desc: "Nhanh mỗi ngày", emoji: "⚡" },
  { value: 10, label: "10 phút", desc: "Cân bằng & hiệu quả", emoji: "⏰", recommended: true },
  { value: 20, label: "20 phút", desc: "Chuyên sâu", emoji: "🔥" },
  { value: 30, label: "30+ phút", desc: "Cam kết cao", emoji: "🚀" },
];

const STYLES = [
  { value: "flashcard", label: "Lặp lại cách quãng", desc: "Ôn thẻ SRS, nhớ lâu", emoji: "🃏" },
  { value: "practice", label: "Luyện bài tập", desc: "Giải quiz, điền từ, chọn đáp án", emoji: "✏️" },
  { value: "immersion", label: "Ngâm trong ngôn ngữ", desc: "Đọc báo, nghe tin tức NHK", emoji: "📰" },
  { value: "visual", label: "Học qua hình ảnh", desc: "Bài học có minh họa", emoji: "🖼️" },
  { value: "mixed", label: "Trộn đều các kiểu", desc: "Để hệ thống tự phối hợp", emoji: "🎲", recommended: true },
];

const STEPS: Step[] = ["level", "goal", "topics", "time", "style"];

// ─── Component ────────────────────────────────────────────────────────────────

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const [step, setStep] = useState<Step>("level");
  const [answers, setAnswers] = useState<Answers>({
    currentLevel: -1,
    goal: "",
    topics: [],
    dailyMinutes: 10,
    style: "",
  });
  const [saving, setSaving] = useState(false);

  const skipOnboarding = useCallback(() => {
    // Persist skip to backend so it won't show on other devices
    void learnerApiFetch("/api/recommendation/onboarding/skip", { method: "POST" }).catch(() => {});
    onComplete(false);
  }, [onComplete]);

  // Escape key to skip onboarding
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") skipOnboarding();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [skipOnboarding]);

  // Respect prefers-reduced-motion
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  const stepIndex = STEPS.indexOf(step);
  const progress = ((stepIndex + 1) / STEPS.length) * 100;

  const canProceed = useCallback(() => {
    switch (step) {
      case "level": return answers.currentLevel >= 0;
      case "goal": return answers.goal !== "";
      case "topics": return answers.topics.length >= 1;
      case "time": return answers.dailyMinutes > 0;
      case "style": return answers.style !== "";
    }
  }, [step, answers]);

  const next = useCallback(async () => {
    const idx = STEPS.indexOf(step);
    if (idx < STEPS.length - 1) {
      setStep(STEPS[idx + 1]);
    } else {
      // Final step — save to backend
      setSaving(true);
      try {
        await learnerApiFetch("/api/recommendation/onboarding/preferences", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(answers),
        });
        onComplete(true);
      } catch {
        // Silently complete even if save fails — preferences are non-critical
        onComplete(true);
      } finally {
        setSaving(false);
      }
    }
  }, [step, answers, onComplete]);

  const back = useCallback(() => {
    const idx = STEPS.indexOf(step);
    if (idx > 0) setStep(STEPS[idx - 1]);
  }, [step]);

  const toggleTopic = (topic: string) => {
    setAnswers((prev) => {
      const has = prev.topics.includes(topic);
      if (has) return { ...prev, topics: prev.topics.filter((t) => t !== topic) };
      if (prev.topics.length >= 5) return prev; // max 5
      return { ...prev, topics: [...prev.topics, topic] };
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-label="Onboarding">
      <div className={cn(
        "w-full max-w-md rounded-3xl bg-surface shadow-2xl overflow-hidden",
        !prefersReducedMotion && "animate-in fade-in slide-in-from-bottom-4 duration-300",
      )}>
        {/* Progress bar */}
        <div className="h-1.5 bg-ink/5">
          <div
            className="h-full bg-accent transition-all duration-500 ease-out rounded-r-full"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="p-6">
          {/* Header */}
          <div className="mb-6 text-center">
            <p className="text-xs text-muted mb-1">
              Bước {stepIndex + 1}/{STEPS.length}
            </p>
            <h2 className="text-lg font-bold text-ink">
              {step === "level" && "Trình độ hiện tại của bạn?"}
              {step === "goal" && "Mục tiêu chính là gì?"}
              {step === "topics" && "Bạn quan tâm chủ đề nào?"}
              {step === "time" && "Mỗi ngày bạn dành bao lâu?"}
              {step === "style" && "Bạn thích học kiểu nào?"}
            </h2>
            <p className="mt-1 text-xs text-muted">
              {step === "level" && "Giúp hệ thống chọn nội dung phù hợp từ đầu"}
              {step === "goal" && "Chúng tôi sẽ ưu tiên nội dung liên quan"}
              {step === "topics" && "Chọn 1–5 chủ đề (bạn có thể thay đổi sau)"}
              {step === "time" && "Gợi ý sẽ vừa vặn thời gian của bạn"}
              {step === "style" && "Thuật toán sẽ thiên về phong cách này"}
            </p>
          </div>

          {/* Options */}
          <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
            {step === "level" &&
              LEVELS.map((l) => (
                <OptionButton
                  key={l.value}
                  selected={answers.currentLevel === l.value}
                  onClick={() => setAnswers((a) => ({ ...a, currentLevel: l.value }))}
                  emoji={l.emoji}
                  label={l.label}
                  desc={l.desc}
                />
              ))}

            {step === "goal" &&
              GOALS.map((g) => (
                <OptionButton
                  key={g.value}
                  selected={answers.goal === g.value}
                  onClick={() => setAnswers((a) => ({ ...a, goal: g.value }))}
                  emoji={g.emoji}
                  label={g.label}
                  desc={g.desc}
                />
              ))}

            {step === "topics" && (
              <div className="grid grid-cols-2 gap-2">
                {TOPICS.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => toggleTopic(t.value)}
                    className={cn(
                      "flex items-center gap-2 rounded-xl p-3 text-left text-sm transition",
                      "border hover:scale-[1.02] active:scale-[0.98]",
                      answers.topics.includes(t.value)
                        ? "border-accent bg-accent/10 text-ink shadow-sm"
                        : "border-ink/8 bg-surface text-muted hover:border-ink/20",
                    )}
                  >
                    <span className="text-base">{t.emoji}</span>
                    <span className="font-medium">{t.label}</span>
                  </button>
                ))}
              </div>
            )}

            {step === "time" &&
              TIME_OPTIONS.map((t) => (
                <OptionButton
                  key={t.value}
                  selected={answers.dailyMinutes === t.value}
                  onClick={() => setAnswers((a) => ({ ...a, dailyMinutes: t.value }))}
                  emoji={t.emoji}
                  label={t.label}
                  desc={t.desc}
                  recommended={t.recommended}
                />
              ))}

            {step === "style" &&
              STYLES.map((s) => (
                <OptionButton
                  key={s.value}
                  selected={answers.style === s.value}
                  onClick={() => setAnswers((a) => ({ ...a, style: s.value }))}
                  emoji={s.emoji}
                  label={s.label}
                  desc={s.desc}
                  recommended={s.recommended}
                />
              ))}
          </div>

          {/* Navigation */}
          <div className="mt-6 flex items-center justify-between">
            <button
              onClick={back}
              disabled={stepIndex === 0}
              className={cn(
                "rounded-xl px-4 py-2 text-sm font-medium transition",
                stepIndex === 0
                  ? "invisible"
                  : "text-muted hover:text-ink hover:bg-ink/5",
              )}
            >
              ← Quay lại
            </button>

            <button
              onClick={next}
              disabled={!canProceed() || saving}
              className={cn(
                "rounded-xl px-5 py-2.5 text-sm font-bold transition",
                "shadow-sm active:scale-[0.97]",
                canProceed() && !saving
                  ? "bg-accent text-white hover:bg-accent/90"
                  : "bg-ink/10 text-muted cursor-not-allowed",
              )}
            >
              {saving
                ? "Đang lưu..."
                : stepIndex === STEPS.length - 1
                  ? "Hoàn tất ✓"
                  : "Tiếp theo →"}
            </button>
          </div>

          {/* Skip */}
          <div className="mt-3 text-center">
            <button
              onClick={skipOnboarding}
              className="text-[11px] text-muted hover:text-ink transition"
            >
              Bỏ qua — tôi sẽ thiết lập sau
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Option Button ────────────────────────────────────────────────────────────

function OptionButton({
  selected,
  onClick,
  emoji,
  label,
  desc,
  recommended,
}: {
  selected: boolean;
  onClick: () => void;
  emoji: string;
  label: string;
  desc: string;
  recommended?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl p-3.5 text-left transition-colors duration-150",
        "border",
        selected
          ? "border-accent bg-accent/10 shadow-sm"
          : "border-ink/8 bg-surface hover:border-ink/20",
      )}
    >
      <span className="text-xl">{emoji}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn("text-sm font-medium", selected ? "text-ink" : "text-ink/80")}>
            {label}
          </span>
          {recommended && (
            <span className="rounded-full bg-accent/15 px-1.5 py-0.5 text-[9px] font-bold text-accent">
              Đề xuất
            </span>
          )}
        </div>
        <p className="mt-0.5 text-[11px] text-muted truncate">{desc}</p>
      </div>
      {selected && (
        <div className="shrink-0">
          <svg className="h-5 w-5 text-accent" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        </div>
      )}
    </button>
  );
}
