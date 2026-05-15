import type { Metadata } from "next";
import Link from "next/link";
import { getServerApiBaseUrl } from "@/lib/server-api-url";

interface DeckPreview {
  id: string;
  titleVi: string;
  titleJa: string | null;
  descriptionVi: string | null;
  descriptionJa: string | null;
  cardCount: number;
  cloneCount: number;
  sampleCards: Array<{ frontText: string; reading: string | null }>;
}

interface PageProps {
  params: Promise<{ locale: string; token: string }>;
}

async function fetchPreview(token: string): Promise<DeckPreview | null> {
  const base = getServerApiBaseUrl();
  try {
    const res = await fetch(
      `${base}/api/public/decks/${encodeURIComponent(token)}`,
      { next: { revalidate: 60 } }
    );
    if (!res.ok) return null;
    return (await res.json()) as DeckPreview;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { token } = await params;
  const preview = await fetchPreview(token);
  if (!preview) {
    return { title: "Shared Deck — NihonGo BJT" };
  }
  return {
    title: `${preview.titleVi} — NihonGo BJT`,
    description: preview.descriptionVi ?? `Bộ thẻ ${preview.cardCount} thẻ`,
    openGraph: {
      title: preview.titleVi,
      description: preview.descriptionVi ?? `Bộ thẻ ${preview.cardCount} thẻ từ NihonGo BJT`,
      type: "website",
    },
  };
}

export default async function SharedDeckPage({ params }: PageProps) {
  const { locale, token } = await params;
  const preview = await fetchPreview(token);

  if (!preview) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-ink/5">
            <svg className="h-7 w-7 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-ink">Bộ thẻ không tìm thấy</h1>
          <p className="text-sm text-muted">Liên kết này có thể đã hết hạn hoặc bộ thẻ đã bị ẩn.</p>
          <Link
            href={`/${locale}/flashcards`}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-ink px-5 text-sm font-bold text-surface transition hover:bg-ink/90"
          >
            Về thư viện thẻ
          </Link>
        </div>
      </main>
    );
  }

  const title = locale === "ja" && preview.titleJa ? preview.titleJa : preview.titleVi;
  const desc = locale === "ja" && preview.descriptionJa ? preview.descriptionJa : preview.descriptionVi;

  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 px-4 py-8 sm:px-6">
      {/* Header */}
      <header className="space-y-3">
        <div className="flex items-center gap-2 text-xs text-muted">
          <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-0.5 font-semibold text-accent">
            Shared Deck
          </span>
          <span>{preview.cardCount} thẻ</span>
          <span>·</span>
          <span>{preview.cloneCount} lần clone</span>
        </div>
        <h1 className="text-2xl font-bold leading-tight text-ink sm:text-3xl">{title}</h1>
        {desc && <p className="text-sm leading-relaxed text-muted sm:text-base">{desc}</p>}
      </header>

      {/* Sample cards — only front text, blurred back hint */}
      {preview.sampleCards.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted">Xem trước</h2>
          <div className="space-y-2">
            {preview.sampleCards.map((card, i) => (
              <div
                key={i}
                className="rounded-xl border border-ink/8 bg-surface p-4 shadow-sm"
              >
                <p className="text-base font-medium text-ink" style={{ lineHeight: 1.8 }}>
                  {card.frontText}
                </p>
                {card.reading && (
                  <p className="mt-1 text-xs text-muted">{card.reading}</p>
                )}
              </div>
            ))}
          </div>
          {preview.cardCount > 5 && (
            <p className="text-center text-xs text-muted">
              … và {preview.cardCount - 5} thẻ khác
            </p>
          )}
        </section>
      )}

      {/* Clone CTA */}
      <div className="rounded-2xl border border-ink/10 bg-paper p-5 text-center shadow-sm">
        <p className="text-sm text-muted mb-3">Thêm bộ thẻ này vào thư viện của bạn</p>
        <Link
          href={`/${locale}/flashcards?cloneToken=${encodeURIComponent(token)}`}
          className="inline-flex min-h-12 items-center justify-center rounded-xl bg-accent px-6 text-sm font-bold text-white shadow-md transition hover:opacity-90 active:scale-[0.97]"
        >
          Clone vào thư viện
        </Link>
        <p className="mt-3 text-xs text-muted">Cần đăng nhập để clone bộ thẻ</p>
      </div>

      {/* Footer */}
      <footer className="border-t border-ink/8 pt-4 text-center">
        <Link
          href={`/${locale}`}
          className="text-sm font-semibold text-accent hover:underline"
        >
          Khám phá NihonGo BJT →
        </Link>
      </footer>
    </main>
  );
}
