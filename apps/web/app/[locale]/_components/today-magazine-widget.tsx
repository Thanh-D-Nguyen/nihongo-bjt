import Link from "next/link";

const KIND_ICONS: Record<string, string> = {
  magazine_vocab: "🌸",
  magazine_weather: "☀️",
  magazine_horoscope: "⭐",
  magazine_loto: "🎰",
  magazine_bjt_phrase: "💼",
};

const KIND_LABELS: Record<string, string> = {
  magazine_vocab: "Từ vựng",
  magazine_weather: "Thời tiết",
  magazine_horoscope: "Tử vi",
  magazine_loto: "Loto",
  magazine_bjt_phrase: "BJT Phrase",
};

type ArticlePreview = {
  slug: string;
  widgetKind: string;
  titleJp: string;
  titleVi: string;
  jlptLevel?: string;
};

export async function TodayMagazineWidget() {
  const baseUrl =
    process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";
  let articles: ArticlePreview[] = [];

  try {
    const res = await fetch(`${baseUrl}/magazine/today`, {
      next: { revalidate: 1800 },
    });
    if (res.ok) articles = await res.json();
  } catch {
    // Widget is non-critical — silently fail
  }

  if (articles.length === 0) return null;

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">📰 Hôm nay</h2>
        <Link
          href="/magazine"
          className="text-sm text-primary hover:underline"
        >
          Xem tất cả →
        </Link>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {articles.map((a) => (
          <Link
            key={a.slug}
            href={`/magazine/${a.slug}`}
            className="group p-4 rounded-xl bg-card border border-border/50 hover:border-primary/30 hover:shadow-md transition-all duration-200"
          >
            <span className="text-2xl block mb-2">
              {KIND_ICONS[a.widgetKind] ?? "📄"}
            </span>
            <p className="text-xs font-medium text-primary/80 mb-1">
              {KIND_LABELS[a.widgetKind] ?? ""}
            </p>
            <p className="font-medium text-sm leading-relaxed line-clamp-2 group-hover:text-primary transition-colors">
              {a.titleJp}
            </p>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
              {a.titleVi}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
