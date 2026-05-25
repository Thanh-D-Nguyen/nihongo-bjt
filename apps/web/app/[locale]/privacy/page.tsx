import { isSupportedLocale } from "@nihongo-bjt/config";
import type { Metadata } from "next";
import en from "../../../messages/en.json";
import ja from "../../../messages/ja.json";
import vi from "../../../messages/vi.json";

const messages: Record<string, typeof vi> = { ja, vi, en };

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const loc = isSupportedLocale(locale) ? locale : "vi";
  return { title: messages[loc].privacyPolicyPage.metaTitle };
}

export default async function PrivacyPolicyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const loc = isSupportedLocale(locale) ? locale : "vi";
  const t = messages[loc].privacyPolicyPage;

  const sections = [
    { title: t.section1Title, body: t.section1Body },
    { title: t.section2Title, body: t.section2Body },
    { title: t.section3Title, body: t.section3Body },
    { title: t.section4Title, body: t.section4Body },
    { title: t.section5Title, body: t.section5Body },
  ];

  return (
    <main className="mx-auto w-full max-w-2xl space-y-8 px-4 py-10">
      <div>
        <h1 className="text-2xl font-bold text-ink">{t.title}</h1>
        <p className="mt-1 text-sm text-muted">{t.subtitle}</p>
      </div>

      <div className="space-y-6">
        {sections.map((s, i) => (
          <section key={i}>
            <h2 className="text-base font-semibold text-ink">{s.title}</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              {s.body}
            </p>
          </section>
        ))}
      </div>
    </main>
  );
}
