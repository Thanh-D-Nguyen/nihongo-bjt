"use client";

import { FLASHCARD_THEME_DEFINITIONS, resolveFlashcardThemeDefinition } from "@nihongo-bjt/shared";
import { EmptyState, ErrorState, LoadingSkeleton } from "@nihongo-bjt/ui";
import { useSearchParams } from "next/navigation";

import {
  DeckStudySession,
  type DeckStudySessionLabels
} from "../../[locale]/flashcards/_components/deck-study-session";
import { DeckCard, type DeckCardLabels } from "../../[locale]/flashcards/_components/deck-card";
import { DeckGrid } from "../../[locale]/flashcards/_components/deck-grid";
import type { DeckApiRow } from "../../[locale]/flashcards/_components/deck-types";
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

const libraryDeckLabels: DeckCardLabels = {
  cards: "thẻ",
  createdLabel: "Tạo",
  gridAriaLabel: "Dạng lưới",
  listAriaLabel: "Dạng danh sách",
  openDeckAria: "Mở bộ thẻ",
  private: "Riêng tư",
  public: "Công khai",
  statusActive: "Đang học",
  statusArchived: "Đã lưu trữ",
  updatedLabel: "Cập nhật"
};

const libraryDecks: DeckApiRow[] = [
  {
    _count: { cards: 32 },
    createdAt: "2026-06-12T08:00:00.000Z",
    descriptionJa: null,
    descriptionVi: "Từ vựng và mẫu câu dùng trong môi trường công sở Nhật Bản.",
    id: "visual-deck-1",
    ownerUserId: "visual-user",
    status: "active",
    titleJa: "ビジネス日本語",
    titleVi: "Tiếng Nhật thương mại",
    updatedAt: "2026-07-24T08:00:00.000Z",
    visibility: "private"
  },
  {
    _count: { cards: 18 },
    createdAt: "2026-05-10T08:00:00.000Z",
    descriptionJa: null,
    descriptionVi: "Ôn nhanh kanji, cách đọc và ví dụ theo chủ đề an toàn lao động.",
    id: "visual-deck-2",
    ownerUserId: null,
    status: "active",
    titleJa: "安全衛生",
    titleVi: "An toàn và vệ sinh",
    updatedAt: "2026-07-22T08:00:00.000Z",
    visibility: "public"
  },
  {
    _count: { cards: 24 },
    createdAt: "2026-04-08T08:00:00.000Z",
    descriptionJa: null,
    descriptionVi: "Các cụm từ cần nhớ trước bài thi BJT.",
    id: "visual-deck-3",
    ownerUserId: "visual-user",
    status: "active",
    titleJa: "試験対策",
    titleVi: "BJT trọng điểm",
    updatedAt: "2026-07-20T08:00:00.000Z",
    visibility: "private"
  }
];

function LibraryVisualFixture() {
  return (
    <section
      className="rounded-[1.75rem] border border-ink/10 bg-surface p-4 sm:p-6"
      data-testid="flashcard-library-fixture"
    >
      <div className="flex flex-col gap-4 border-b border-ink/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-accent">
            Thư viện học
          </p>
          <h2 className="mt-1 text-2xl font-black tracking-tight text-ink">Bộ thẻ của bạn</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            Chọn một bộ để tiếp tục học hoặc ôn theo lịch.
          </p>
        </div>
        <button
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-ink px-5 text-sm font-bold text-surface outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-accent"
          type="button"
        >
          Tạo bộ thẻ
        </button>
      </div>
      <div className="mt-5">
        <DeckGrid mode="grid">
          {libraryDecks.map((deck) => (
            <DeckCard
              deck={deck}
              href="#"
              key={deck.id}
              labels={libraryDeckLabels}
              locale="vi"
              mode="grid"
            />
          ))}
        </DeckGrid>
      </div>
    </section>
  );
}

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

        {view === "library" ? (
          <LibraryVisualFixture />
        ) : view === "picker" ? (
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
