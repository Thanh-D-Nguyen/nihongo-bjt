import { isSupportedLocale } from "@nihongo-bjt/config";
import type { Metadata } from "next";
import Link from "next/link";
import ja from "../../../messages/ja.json";
import vi from "../../../messages/vi.json";

const messages: Record<string, typeof vi> = { ja, vi };

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const loc = isSupportedLocale(locale) ? locale : "vi";
  return { title: messages[loc].helpPage.metaTitle };
}

export default async function HelpPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const loc = isSupportedLocale(locale) ? locale : "vi";
  const t = messages[loc].helpPage;
  const base = `/${loc}`;

  const faqs = [
    { q: t.faq1q, a: t.faq1a },
    { q: t.faq2q, a: t.faq2a },
    { q: t.faq3q, a: t.faq3a },
    { q: t.faq4q, a: t.faq4a },
  ];

  return (
    <main className="mx-auto w-full max-w-2xl space-y-8 px-4 py-10">
      <div>
        <h1 className="text-2xl font-bold text-ink">{t.title}</h1>
        <p className="mt-1 text-sm text-muted">{t.subtitle}</p>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-ink">{t.faqTitle}</h2>
        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <details
              className="group rounded-xl border border-ink/10 bg-white p-4"
              key={i}
            >
              <summary className="cursor-pointer font-medium text-ink">
                {faq.q}
              </summary>
              <p className="mt-2 text-sm text-muted">{faq.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-ink/10 bg-surface p-6">
        <h2 className="text-lg font-semibold text-ink">{t.contactTitle}</h2>
        <p className="mt-1 text-sm text-muted">{t.contactDesc}</p>
        <Link
          className="mt-3 inline-block rounded-lg bg-leaf px-4 py-2 text-sm font-medium text-white hover:bg-leaf/90"
          href={`${base}/feedback`}
        >
          {t.contactLink}
        </Link>
      </section>
    </main>
  );
}
