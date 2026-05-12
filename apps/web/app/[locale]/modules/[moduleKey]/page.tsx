import Link from "next/link";

import en from "../../../../messages/en.json";
import ja from "../../../../messages/ja.json";
import vi from "../../../../messages/vi.json";

const messages = { en, ja, vi };
const apiBaseUrl = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/u, "");

type PublicModule = {
  descriptionVi: string;
  disclaimerVi: string | null;
  metadata: Record<string, unknown> | null;
  moduleKey: string;
  routePath: string | null;
  titleVi: string;
};

type PublicCard = {
  badgeTextVi: string | null;
  ctaLabelVi: string;
  descriptionVi: string;
  estimatedMinutes: number | null;
  id: string;
  levelLabel: string | null;
  metadata: Record<string, unknown> | null;
  module: { moduleKey: string };
  slug: string;
  targetRoute: string | null;
  titleVi: string;
};

async function fetchModuleData(moduleKey: string) {
  const [modulesRes, cardsRes] = await Promise.all([
    fetch(`${apiBaseUrl}/api/daily-radar/modules`, { cache: "no-store" }),
    fetch(`${apiBaseUrl}/api/daily-radar/cards?moduleKey=${encodeURIComponent(moduleKey)}&limit=48`, { cache: "no-store" })
  ]);
  const modules = modulesRes.ok ? ((await modulesRes.json()) as PublicModule[]) : [];
  const cards = cardsRes.ok ? ((await cardsRes.json()) as PublicCard[]) : [];
  return { cards, module: modules.find((item) => item.moduleKey === moduleKey) ?? null };
}

export default async function DailyRadarModulePlaceholder({
  params
}: {
  params: Promise<{ locale: keyof typeof messages; moduleKey: string }>;
}) {
  const { locale, moduleKey } = await params;
  const t = messages[locale] ?? messages.vi;
  const labels = t.homepage.dailyRadar;
  const { cards, module } = await fetchModuleData(moduleKey);
  const safeCards = cards.filter((card) => card.module.moduleKey === moduleKey);
  const displayTitle = module?.titleVi;
  const title = moduleKey
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  const comingSoon =
    module?.metadata && typeof module.metadata === "object" ? Boolean(module.metadata.comingSoon) : safeCards.length === 0;

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <Link className="text-sm font-semibold text-blue-700 hover:text-blue-900" href={`/${locale}`}>
        ← {labels.heading}
      </Link>
      <section className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="bg-gradient-to-br from-slate-950 via-blue-900 to-blue-700 p-8 text-white">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-100">Japan Daily Radar</p>
          <h1 className="mt-3 text-3xl font-semibold">{displayTitle ?? title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-blue-50/85">
            {module?.descriptionVi || labels.subheading}
          </p>
        </div>
        <div className="space-y-4 p-6">
          {module?.disclaimerVi ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {module.disclaimerVi}
            </p>
          ) : null}
          {comingSoon ? (
            <>
              <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                {labels.comingSoon}
              </span>
              <p className="text-sm leading-relaxed text-slate-700">{labels.placeholderBody}</p>
            </>
          ) : null}
          {safeCards.length > 0 ? (
            <div className="space-y-3">
              {safeCards.map((card) => {
                const isExternalRoute = card.targetRoute && !card.targetRoute.includes(`/modules/${moduleKey}`);
                const href = isExternalRoute
                  ? card.targetRoute!.replace(/^\/vi\//, `/${locale}/`)
                  : `/${locale}/radar/${card.slug}`;
                return (
                <Link
                  className="block rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:bg-slate-50"
                  href={href}
                  key={card.id}
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5">{card.badgeTextVi ?? (displayTitle ?? title)}</span>
                    {card.levelLabel ? <span>{card.levelLabel}</span> : null}
                    {card.estimatedMinutes ? <span>{labels.minutes.replace("{n}", String(card.estimatedMinutes))}</span> : null}
                  </div>
                  <h2 className="mt-2 text-lg font-semibold text-slate-950">{card.titleVi}</h2>
                  <p className="mt-1 text-sm text-slate-700">{card.descriptionVi}</p>
                  <p className="mt-3 text-sm font-semibold text-blue-700">{card.ctaLabelVi}</p>
                </Link>
                );
              })}
            </div>
          ) : null}
          <Link
            className="inline-flex min-h-11 items-center rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white"
            href={`/${locale}`}
          >
            {labels.heading}
          </Link>
        </div>
      </section>
    </main>
  );
}
