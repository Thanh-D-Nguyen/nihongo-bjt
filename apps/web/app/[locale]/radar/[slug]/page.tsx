import Link from "next/link";

import en from "../../../../messages/en.json";
import ja from "../../../../messages/ja.json";
import vi from "../../../../messages/vi.json";

const messages = { en, ja, vi };
const apiBaseUrl = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/u, "");

type CardDetail = {
  badgeTextVi: string | null;
  category: string;
  ctaLabelVi: string;
  descriptionVi: string;
  estimatedMinutes: number | null;
  id: string;
  levelLabel: string | null;
  metadata: Record<string, unknown> | null;
  module: {
    disclaimerVi: string | null;
    moduleKey: string;
    titleJa: string;
    titleVi: string;
  };
  moduleType: string;
  recommendationReasonVi: string | null;
  slug: string;
  targetRoute: string | null;
  titleJa: string | null;
  titleVi: string;
  visualTheme: string | null;
};

const themeGradients: Record<string, string> = {
  blue_corporate: "from-slate-950 via-blue-900 to-blue-700",
  indigo_culture: "from-indigo-900 via-indigo-800 to-purple-700",
  indigo_news: "from-indigo-900 via-blue-800 to-cyan-700",
  green_life: "from-emerald-900 via-emerald-800 to-teal-700",
  sky_weather: "from-sky-900 via-sky-700 to-cyan-600",
  slate_procedure: "from-slate-800 via-slate-700 to-zinc-600",
  amber_money: "from-amber-800 via-amber-700 to-yellow-600",
  red_safety: "from-red-900 via-red-800 to-rose-700",
  purple_ai: "from-purple-900 via-purple-800 to-violet-700",
  teal_health: "from-teal-900 via-teal-800 to-emerald-700",
  cyan_transport: "from-cyan-900 via-cyan-800 to-sky-700",
  rose_family: "from-rose-900 via-rose-800 to-pink-700",
};

async function fetchCard(slug: string): Promise<CardDetail | null> {
  try {
    const res = await fetch(`${apiBaseUrl}/api/daily-radar/cards/${encodeURIComponent(slug)}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as CardDetail;
  } catch {
    return null;
  }
}

export default async function RadarCardPage({
  params,
}: {
  params: Promise<{ locale: keyof typeof messages; slug: string }>;
}) {
  const { locale, slug } = await params;
  const t = messages[locale] ?? messages.vi;
  const labels = t.homepage.dailyRadar;
  const card = await fetchCard(slug);

  if (!card) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold text-slate-950">Không tìm thấy bài học</h1>
        <p className="mt-2 text-sm text-slate-600">Card này không tồn tại hoặc đã bị gỡ.</p>
        <Link className="mt-6 inline-flex rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white" href={`/${locale}`}>
          ← Về trang chủ
        </Link>
      </main>
    );
  }

  const meta = card.metadata ?? {};
  const japaneseExpressions = Array.isArray(meta.japaneseExpressions) ? (meta.japaneseExpressions as string[]) : [];
  const skills = Array.isArray(meta.skills) ? (meta.skills as string[]) : [];
  const contentGoal = typeof meta.contentGoal === "string" ? meta.contentGoal : null;
  const gradient = themeGradients[card.visualTheme ?? ""] ?? "from-slate-950 via-blue-900 to-blue-700";
  const categoryLabel = labels[`category${card.category.charAt(0).toUpperCase()}${card.category.slice(1)}` as keyof typeof labels] ?? card.category;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link className="text-sm font-semibold text-blue-700 hover:text-blue-900" href={`/${locale}/modules/${card.module.moduleKey}`}>
        ← {card.module.titleVi}
      </Link>

      <article className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        {/* Header */}
        <div className={`bg-gradient-to-br ${gradient} p-6 text-white sm:p-8`}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-widest ring-1 ring-white/20">
              {categoryLabel}
            </span>
            {card.badgeTextVi ? (
              <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-900">{card.badgeTextVi}</span>
            ) : null}
            {card.levelLabel ? (
              <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold">{card.levelLabel}</span>
            ) : null}
          </div>
          <h1 className="mt-4 text-2xl font-bold leading-tight sm:text-3xl">{card.titleVi}</h1>
          {card.titleJa ? (
            <p className="mt-2 text-lg font-medium text-white/80" lang="ja">{card.titleJa}</p>
          ) : null}
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-white/70">
            {card.estimatedMinutes ? <span>⏱ {labels.minutes.replace("{n}", String(card.estimatedMinutes))}</span> : null}
            <span>{card.module.titleVi}</span>
          </div>
        </div>

        {/* Body */}
        <div className="space-y-6 p-6 sm:p-8">
          {/* Disclaimer */}
          {card.module.disclaimerVi ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              ⚠️ {card.module.disclaimerVi}
            </div>
          ) : null}

          {/* Content goal */}
          {contentGoal ? (
            <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-wider text-blue-700">Mục tiêu</p>
              <p className="mt-1 text-sm leading-relaxed text-blue-900">{contentGoal}</p>
            </div>
          ) : null}

          {/* Description */}
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Nội dung</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-700">{card.descriptionVi}</p>
          </div>

          {/* Recommendation reason */}
          {card.recommendationReasonVi ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Tại sao nên học</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-700">{card.recommendationReasonVi}</p>
            </div>
          ) : null}

          {/* Japanese expressions */}
          {japaneseExpressions.length > 0 ? (
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Cụm từ tiếng Nhật</h2>
              <div className="mt-3 space-y-2">
                {japaneseExpressions.map((expr, i) => (
                  <div
                    className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
                    key={i}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
                      {i + 1}
                    </span>
                    <span className="text-lg font-semibold text-slate-900" lang="ja">{expr}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Skills */}
          {skills.length > 0 ? (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Kỹ năng</h2>
              <div className="mt-2 flex flex-wrap gap-2">
                {skills.map((skill) => (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200" key={skill}>
                    {skill.replace(/_/g, " ")}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {/* CTA area */}
          <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-6">
            <span className="inline-flex min-h-11 items-center rounded-xl bg-slate-100 px-5 text-sm font-semibold text-slate-500">
              Bài học chi tiết sắp ra mắt
            </span>
            <Link
              className="inline-flex min-h-11 items-center rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white hover:bg-slate-800"
              href={`/${locale}/modules/${card.module.moduleKey}`}
            >
              ← Xem các bài khác
            </Link>
          </div>
        </div>
      </article>
    </main>
  );
}
