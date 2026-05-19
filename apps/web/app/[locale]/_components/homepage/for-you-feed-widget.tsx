"use client";

import { cn } from "@nihongo-bjt/ui";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useKeycloakAuth } from "../../../../components/auth/keycloak-auth-provider";
import { learnerApiFetchOptional } from "../../../../lib/learner-api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FeedItem {
  id: string;
  type: "flashcard_review" | "exercise" | "lesson" | "news_article" | "quiz" | "vocabulary" | "grammar_point";
  title: string;
  score: number;
  source: string;
}

interface FeedMeta {
  pipeline: string;
  totalSourced: number;
  totalReturned: number;
  executionMs: number;
}

interface FeedResponse {
  items: FeedItem[];
  meta: FeedMeta;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_META: Record<string, { emoji: string; label: string; color: string; href: string }> = {
  flashcard_review: { emoji: "🃏", label: "Ôn thẻ", color: "bg-blue-500/10 text-blue-700", href: "/flashcards?tab=review" },
  exercise: { emoji: "✏️", label: "Bài tập", color: "bg-emerald-500/10 text-emerald-700", href: "/exercises" },
  lesson: { emoji: "📖", label: "Bài học", color: "bg-purple-500/10 text-purple-700", href: "/lessons" },
  news_article: { emoji: "📰", label: "Đọc báo", color: "bg-amber-500/10 text-amber-700", href: "/news" },
  quiz: { emoji: "📝", label: "Quiz", color: "bg-rose-500/10 text-rose-700", href: "/quiz" },
  vocabulary: { emoji: "あ", label: "Từ vựng", color: "bg-cyan-500/10 text-cyan-700", href: "/vocabulary" },
  grammar_point: { emoji: "文", label: "Ngữ pháp", color: "bg-indigo-500/10 text-indigo-700", href: "/grammar" },
};

/** Map recommendation source to user-friendly reason */
function getReasonText(source: string, type: string): string {
  switch (source) {
    case "DueFlashcards":
    case "OverdueCards":
      return "Cần ôn lại — quên nếu không luyện hôm nay";
    case "WeakAreaDiscovery":
      return "Bạn đang yếu kỹ năng này — luyện thêm sẽ tiến bộ";
    case "EnrolledExercises":
      return "Từ chủ đề bạn đang theo dõi";
    case "UndiscoveredLessons":
      return "Bài học mới phù hợp trình độ của bạn";
    case "NewCards":
      return "Thẻ mới chờ bạn khám phá";
    case "LeechedCards":
      return "Thẻ khó — cần chú ý đặc biệt";
    case "NhkNews":
      return "Phù hợp trình độ đọc hiểu của bạn";
    case "TrendingNews":
      return "Đang được nhiều người đọc";
    default:
      if (type === "flashcard_review") return "Dựa trên lịch ôn tập SRS";
      if (type === "exercise") return "Phù hợp mục tiêu học của bạn";
      return "Gợi ý dựa trên hoạt động gần đây";
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ForYouFeedWidget({ locale, refreshKey = 0 }: { locale: string; refreshKey?: number }) {
  // Respect prefers-reduced-motion
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const { userId } = useKeycloakAuth();
  const [feed, setFeed] = useState<FeedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [showInfo, setShowInfo] = useState(false);

  const loadFeed = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await learnerApiFetchOptional("/api/recommendation/study-feed?limit=8");
      if (res?.ok) {
        setFeed(await res.json());
      }
    } catch {
      // Non-critical widget, silent fail
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadFeed();
  }, [loadFeed, refreshKey]);

  // ─── Not logged in ────────────────────────────────────────────────────────
  if (!userId) {
    return (
      <div className="rounded-2xl border border-ink/8 bg-surface p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-lg">✨</span>
          <h3 className="text-sm font-bold text-ink">For You</h3>
        </div>
        <p className="mt-2 text-xs text-muted">
          Đăng nhập để nhận gợi ý học tập cá nhân hoá dựa trên hoạt động của bạn.
        </p>
      </div>
    );
  }

  // ─── Loading (shimmer skeleton per UI/UX trends) ─────────────────────────
  if (loading) {
    return (
      <div className="rounded-2xl border border-ink/8 bg-surface p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-lg">✨</span>
          <div className="h-4 w-20 rounded foryou-skeleton" />
        </div>
        <div className="mt-4 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg foryou-skeleton" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-3/4 rounded foryou-skeleton" />
                <div className="h-2.5 w-1/2 rounded foryou-skeleton" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─── Empty state ──────────────────────────────────────────────────────────
  if (!feed || feed.items.length === 0) {
    return (
      <div className="rounded-2xl border border-ink/8 bg-surface p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-lg">✨</span>
          <h3 className="text-sm font-bold text-ink">For You</h3>
        </div>
        <p className="mt-2 text-xs text-muted">
          Chưa đủ dữ liệu để gợi ý. Hãy bắt đầu ôn thẻ hoặc làm bài tập để hệ thống hiểu bạn hơn!
        </p>
      </div>
    );
  }

  // ─── Feed items ───────────────────────────────────────────────────────────
  return (
    <div className="rounded-2xl border border-ink/8 bg-surface p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">✨</span>
          <h3 className="text-sm font-bold text-ink">For You</h3>
          <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">
            AI
          </span>
        </div>
        <button
          onClick={() => setShowInfo(!showInfo)}
          className="rounded-full p-1 text-muted transition hover:bg-ink/5 hover:text-ink"
          aria-label="Thông tin thuật toán"
          title="Cách hoạt động"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
      </div>

      {/* Info tooltip / explanation */}
      {showInfo && (
        <div className="mt-3 rounded-xl bg-accent/5 p-3 text-xs text-muted leading-relaxed">
          <p className="font-medium text-ink mb-1">🧠 Cách gợi ý hoạt động:</p>
          <ul className="list-inside list-disc space-y-0.5">
            <li>Phân tích lịch sử ôn tập, quiz, bài tập của bạn</li>
            <li>Tìm điểm yếu cần cải thiện (accuracy &lt; 60%)</li>
            <li>Ưu tiên thẻ sắp quên theo thuật toán SRS</li>
            <li>Đa dạng hoá chủ đề — không lặp lại quá nhiều</li>
            <li>Phù hợp trình độ ước lượng từ điểm quiz gần nhất</li>
          </ul>
          <p className="mt-2 text-[10px] opacity-70">
            Thuật toán lấy cảm hứng từ hệ thống recommendation của X (Twitter).
            Không cần cấu hình — càng học nhiều, gợi ý càng chính xác.
          </p>
        </div>
      )}

      {/* Feed items */}
      <ul className="mt-4 space-y-2" role="list" aria-label="Gợi ý học tập cá nhân">
        {feed.items.map((item, idx) => {
          const meta = TYPE_META[item.type] ?? TYPE_META["exercise"];
          return (
            <li key={item.id}>
              <Link
                href={`/${locale}${meta.href}`}
                className={cn(
                  "group flex items-start gap-3 rounded-xl p-2.5 transition-colors duration-150",
                  "hover:bg-ink/[0.03]",
                  !prefersReducedMotion && "active:scale-[0.98] transition-all",
                )}
              >
                {/* Icon */}
                <div className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm",
                  meta.color,
                )}>
                  {meta.emoji}
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink group-hover:text-accent transition-colors">
                    {item.title}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted leading-tight">
                    {getReasonText(item.source, item.type)}
                  </p>
                </div>

                {/* Priority indicator */}
                {idx < 3 && (
                  <div className="mt-1 shrink-0">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent/60" title="Ưu tiên cao" />
                  </div>
                )}
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between border-t border-ink/5 pt-3">
        <p className="text-[10px] text-muted">
          {feed.meta.totalSourced} ứng viên → {feed.meta.totalReturned} gợi ý ({feed.meta.executionMs}ms)
        </p>
        <button
          onClick={() => void loadFeed()}
          className="text-[11px] font-medium text-accent hover:underline"
        >
          Làm mới ↻
        </button>
      </div>
    </div>
  );
}
