import type { Metadata } from "next";

import ja from "../../../../messages/ja.json";
import vi from "../../../../messages/vi.json";

const messages = { ja, vi };

const apiBase = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");

type ShareJson = {
  description: string;
  imageUrl: string;
  title: string;
};

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: keyof typeof messages; token: string }>;
}): Promise<Metadata> {
  const { locale, token } = await params;
  const t = messages[locale] ?? messages.vi;
  try {
    const r = await fetch(`${apiBase}/api/public/shares/${encodeURIComponent(token)}`, {
      next: { revalidate: 120 }
    });
    if (!r.ok) {
      return { title: t.sharePublic.title };
    }
    const j = (await r.json()) as ShareJson;
    return {
      description: j.description,
      openGraph: {
        description: j.description,
        images: [{ url: j.imageUrl }],
        title: j.title
      },
      title: j.title
    };
  } catch {
    return { title: t.sharePublic.title };
  }
}

export default async function PublicSharePage({
  params
}: {
  params: Promise<{ locale: keyof typeof messages; token: string }>;
}) {
  const { locale, token } = await params;
  const t = messages[locale] ?? messages.vi;
  let data: ShareJson | null = null;
  try {
    const r = await fetch(`${apiBase}/api/public/shares/${encodeURIComponent(token)}`, {
      cache: "no-store"
    });
    if (r.ok) {
      data = (await r.json()) as ShareJson;
    }
  } catch {
    data = null;
  }

  if (!data) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-sm text-muted" role="alert">{t.sharePublic.notFound}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <section className="rounded-2xl border border-ink/10 bg-surface p-6 shadow-sm">
        <h1 className="text-2xl font-bold leading-tight text-ink">{data.title}</h1>
        <p className="mt-1 text-sm text-muted">{t.sharePublic.subtitle}</p>

        {data.imageUrl ? (
          <figure className="mt-6">
            <img
              alt={data.title}
              className="w-full rounded-xl border border-ink/8"
              height={400}
              src={data.imageUrl}
              width={800}
            />
          </figure>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <a
            className="inline-flex items-center gap-2 rounded-xl border border-ink/12 bg-surface px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-ink/5"
            href={data.imageUrl}
            rel="noreferrer"
            target="_blank"
          >
            {t.sharePublic.openImage}
          </a>
        </div>
      </section>
    </main>
  );
}
