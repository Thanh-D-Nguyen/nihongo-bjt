"use client";

import { FLASHCARD_THEME_DEFINITIONS, resolveFlashcardThemeDefinition } from "@nihongo-bjt/shared";
import { EmptyState, ErrorState, LoadingSkeleton } from "@nihongo-bjt/ui";
import { useSearchParams } from "next/navigation";

import {
  DeckStudySession,
  type DeckStudySessionLabels
} from "../../[locale]/flashcards/_components/deck-study-session";
import {
  FlashcardStyleGrid,
  type FlashcardStyleOption,
  type StylePickerLabels
} from "../../[locale]/flashcards/_components/flashcard-style-picker";

const visualLabels: Partial<DeckStudySessionLabels> = {
  deckStudyAutoRead: "Tự động đọc",
  deckStudyEyebrow: "Học xem trong bộ",
  deckStudyFaceBack: "Mặt sau",
  deckStudyFaceFront: "Mặt trước",
  deckStudyFlipPrompt: "Câu hỏi / từ gợi nhớ",
  deckStudyHideImages: "Ẩn hình ảnh",
  deckStudyHideReading: "Ẩn cách đọc",
  deckStudyKeyboardHint: "Dùng phím ← → để chuyển thẻ",
  deckStudyModeFlip: "Lật thẻ",
  deckStudyModeQuiz: "Trắc nghiệm",
  deckStudyModeShuffle: "Trộn",
  deckStudyNext: "Tiếp theo",
  deckStudyPrev: "Quay lại",
  deckStudyProgressTpl: "Thẻ {current} / {total}",
  deckStudyRateAgain: "Học lại",
  deckStudyRateGood: "Đã nhớ",
  deckStudyRateHard: "Hơi khó",
  deckStudyRateHint: "Đánh giá để cá nhân hóa lần ôn tiếp theo",
  deckStudyReadCard: "Đọc thẻ",
  deckStudyShowImages: "Hiện hình ảnh",
  deckStudyShowReading: "Hiện cách đọc",
  deckStudyTapToFlip: "Chạm thẻ hoặc Space / Enter để lật",
  deckStudyTapToRevealReading: "Chạm để hiện cách đọc",
  deckStudyToolsAria: "Công cụ học"
};

const labels = new Proxy<Record<string, string>>(
  {},
  {
    get: (_target, property) =>
      visualLabels[property as keyof DeckStudySessionLabels] ?? String(property)
  }
) as DeckStudySessionLabels;

const pickerLabels: StylePickerLabels = {
  styleDescriptions: Object.fromEntries(
    FLASHCARD_THEME_DEFINITIONS.map((theme) => [theme.slug, `${theme.slug} preview`])
  ),
  styleNames: Object.fromEntries(
    FLASHCARD_THEME_DEFINITIONS.map((theme) => [theme.slug, theme.slug])
  ),
  stylePickerActive: "Selected",
  stylePickerApplied: "Applied",
  stylePickerApplyError: "Apply error",
  stylePickerApplying: "Applying…",
  stylePickerClose: "Close",
  stylePickerDescription: "Contrast-safe semantic themes",
  stylePickerEmpty: "No themes available",
  stylePickerExclusive: "Exclusive",
  stylePickerFree: "Free",
  stylePickerLoadError: "Could not load themes",
  stylePickerLocked: "Locked",
  stylePickerPremium: "Premium",
  stylePickerPreviewLabel: "Theme preview",
  stylePickerRetry: "Retry",
  stylePickerScrollHint: "Swipe to see more themes",
  stylePickerSelectTheme: "Select {name}",
  stylePickerTitle: "Card themes",
  stylePickerUnnamed: "Card theme"
};

const visualStyles: FlashcardStyleOption[] = FLASHCARD_THEME_DEFINITIONS.map((theme) => ({
  config: theme.config,
  descriptionKey: theme.descriptionKey,
  id: theme.slug,
  locked: false,
  nameKey: theme.nameKey,
  slug: theme.slug,
  tier: theme.tier
}));

const longJapanese =
  "会議の目的と現在の課題を関係者全員で共有したうえで、実行可能な改善策を優先順位とともに提案してください。";
const longVietnamese =
  "Sau khi chia sẻ mục tiêu của cuộc họp và các vấn đề hiện tại với tất cả bên liên quan, hãy đề xuất các phương án cải thiện khả thi kèm theo thứ tự ưu tiên rõ ràng.";

function LegacyThemeCard({ themeSlug }: { themeSlug: string }) {
  const theme = resolveFlashcardThemeDefinition(themeSlug);
  return (
    <article
      className="mx-auto flex min-h-[28rem] w-full max-w-2xl flex-col items-center justify-center rounded-3xl border border-white/10 p-8 text-center shadow-2xl"
      data-testid="legacy-theme-card"
      style={{
        background: theme.config.background,
        borderRadius: theme.config.borderRadius,
        boxShadow: theme.config.shadow,
        color: theme.config.foreground,
        fontFamily: theme.config.fontFamily
      }}
    >
      <p className="text-4xl font-black leading-tight text-white sm:text-5xl" lang="ja">
        {longJapanese}
      </p>
      <p className="mt-3 text-lg font-medium text-emerald-300/80" lang="ja">
        かいぎのもくてきとかだいをきょうゆうする
      </p>
      <div className="mt-6 w-full border-t border-white/10 pt-6">
        <p className="text-sm font-semibold uppercase tracking-wider text-emerald-400/70">
          Correct answer
        </p>
        <p className="mt-2 text-2xl font-bold text-white sm:text-3xl">{longVietnamese}</p>
      </div>
    </article>
  );
}

export function FlashcardThemeVisualHarness() {
  const searchParams = useSearchParams();
  const theme = resolveFlashcardThemeDefinition(searchParams.get("theme"));
  const view = searchParams.get("view") ?? "card";
  const shortContent = searchParams.get("content") === "short";

  return (
    <main
      className="min-h-dvh bg-paper px-4 py-6 text-ink sm:px-6"
      data-testid="flashcard-visual-harness"
    >
      <div className="mx-auto max-w-5xl">
        <header className="mb-5">
          <p className="text-xs font-bold uppercase tracking-widest text-accent">
            Visual regression fixture
          </p>
          <h1 className="mt-1 text-xl font-black">Flashcards · {theme.slug}</h1>
        </header>

        {view === "picker" ? (
          <section
            className="rounded-3xl border border-ink/10 bg-surface p-4 shadow-lg sm:p-6"
            data-testid="theme-picker-matrix"
          >
            <FlashcardStyleGrid
              activeSlug={theme.slug}
              applyingSlug={null}
              labels={pickerLabels}
              onSelect={() => undefined}
              styles={visualStyles}
            />
          </section>
        ) : view === "legacy" ? (
          <LegacyThemeCard themeSlug={theme.slug} />
        ) : view === "loading" ? (
          <section className="space-y-4" data-testid="loading-state">
            <LoadingSkeleton className="h-12 w-48 rounded-xl" />
            <LoadingSkeleton className="h-[32rem] rounded-3xl" />
          </section>
        ) : view === "empty" ? (
          <EmptyState
            description="Create or import a deck to begin reviewing."
            title="No flashcards yet"
          />
        ) : view === "error" ? (
          <ErrorState
            description="Your cards could not be loaded. Try again without losing your selected theme."
            title="Could not load flashcards"
          />
        ) : (
          <section data-testid="theme-audit-card">
            <DeckStudySession
              cards={[
                {
                  backText: shortContent ? "An toàn và vệ sinh lao động" : longVietnamese,
                  frontText: shortContent ? "安全衛生" : longJapanese,
                  id: "visual-card",
                  reading: shortContent
                    ? "あんぜんえいせい"
                    : "かいぎのもくてきとかだいをきょうゆうする"
                }
              ]}
              deckId={`visual-${theme.slug}`}
              labels={labels}
              styleConfig={theme.config}
            />
          </section>
        )}
      </div>
    </main>
  );
}
