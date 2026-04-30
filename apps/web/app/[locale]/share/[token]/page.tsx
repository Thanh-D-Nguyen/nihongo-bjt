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
      <main className="page-shell">
        <p role="alert">{t.sharePublic.notFound}</p>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <section className="hero-card">
        <h1>{data.title}</h1>
        <p className="text-muted small">{t.sharePublic.subtitle}</p>
        <p>
          <a href={data.imageUrl} rel="noreferrer" target="_blank">
            {t.sharePublic.openImage}
          </a>
        </p>
        <figure>
          <img
            alt={data.title}
            className="card-image"
            height={400}
            src={data.imageUrl}
            style={{ maxWidth: "100%" }}
            width={800}
          />
        </figure>
      </section>
    </main>
  );
}
