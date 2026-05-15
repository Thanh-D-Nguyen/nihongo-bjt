import type { Metadata } from "next";
import Link from "next/link";
import { getServerApiBaseUrl } from "@/lib/server-api-url";

interface ShareSnapshot {
  kind: string;
  title: string;
  summary: string;
  asset: {
    objectKey: string;
    width: number;
    height: number;
    mimeType: string;
  };
}

interface PageProps {
  params: Promise<{ locale: string; token: string }>;
}

async function fetchSnapshot(token: string): Promise<ShareSnapshot | null> {
  const base = getServerApiBaseUrl();
  try {
    const res = await fetch(
      `${base}/api/public/shares/${encodeURIComponent(token)}`,
      { next: { revalidate: 60 } },
    );
    if (!res.ok) return null;
    return (await res.json()) as ShareSnapshot;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { token } = await params;
  const snapshot = await fetchSnapshot(token);
  const base = getServerApiBaseUrl();
  const imageUrl = `${base}/api/public/shares/${encodeURIComponent(token)}/image`;

  if (!snapshot) {
    return {
      title: "NihonGo BJT",
      description: "Học tiếng Nhật cho BJT cùng NihonGo BJT",
    };
  }

  return {
    title: snapshot.title,
    description: "Shared from NihonGo BJT",
    openGraph: {
      title: snapshot.title,
      description: "Shared from NihonGo BJT",
      images: [{ url: imageUrl, width: 1200, height: 630 }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: snapshot.title,
      images: [imageUrl],
    },
  };
}

export default async function PublicSharePage({ params }: PageProps) {
  const { token, locale } = await params;
  const snapshot = await fetchSnapshot(token);
  const base = getServerApiBaseUrl();
  const imageUrl = `${base}/api/public/shares/${encodeURIComponent(token)}/image`;

  if (!snapshot) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center bg-[var(--color-paper)] px-4 py-12">
        <div className="mx-auto w-full max-w-2xl text-center">
          <p className="text-sm text-[var(--color-muted)]">NihonGo BJT</p>

          <div className="mt-12 space-y-4">
            <p className="text-xl font-bold text-[var(--color-ink)]">
              Nội dung không tồn tại
            </p>
            <p className="text-sm text-[var(--color-muted)]">
              Link chia sẻ này không còn hiệu lực hoặc đã bị xoá.
            </p>
          </div>

          <Link
            href={`/${locale}`}
            className="mt-8 inline-flex h-12 items-center rounded-xl bg-[var(--color-accent)] px-8 text-sm font-semibold text-white transition-transform active:scale-[0.97]"
          >
            Về trang chủ →
          </Link>

          <footer className="mt-16 text-xs text-[var(--color-muted)]">
            © NihonGo BJT
          </footer>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh flex-col items-center bg-[var(--color-paper)] px-4 py-12">
      <div className="mx-auto w-full max-w-2xl">
        <p className="text-center text-sm text-[var(--color-muted)]">
          NihonGo BJT
        </p>

        {/* Postcard image */}
        <div className="mt-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={snapshot.title}
            width={1200}
            height={630}
            className="aspect-[1200/630] w-full rounded-xl object-cover shadow-lg"
          />
        </div>

        {/* Title */}
        <h1 className="mt-6 text-center text-xl font-bold text-[var(--color-ink)]">
          {snapshot.title}
        </h1>

        {/* CTA */}
        <div className="mt-8 text-center">
          <p className="text-sm text-[var(--color-muted)]">
            Bạn cũng muốn học tiếng Nhật cho BJT?
          </p>
          <Link
            href={`/${locale}`}
            className="mt-4 inline-flex h-12 items-center rounded-xl bg-[var(--color-accent)] px-8 text-sm font-semibold text-white transition-transform active:scale-[0.97]"
          >
            Bắt đầu miễn phí →
          </Link>
        </div>

        {/* Footer */}
        <footer className="mt-16 text-center text-xs text-[var(--color-muted)]">
          © NihonGo BJT
        </footer>
      </div>
    </main>
  );
}
