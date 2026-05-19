import type { Metadata } from "next";
import ja from "../../messages/ja.json";
import vi from "../../messages/vi.json";
import { HomepageClient } from "./_components/homepage";

const messages = { ja, vi };

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = (messages as Record<string, typeof vi>)[locale] ?? messages.vi;
  return { title: `${t.dashboard.compactHeaderTitle} — NihonGo BJT` };
}

export default async function LearnerHome({
  params
}: {
  params: Promise<{ locale: keyof typeof messages }>;
}) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;

  return (
    <HomepageClient
      labels={t.homepage}
      locale={locale}
      pushBannerLabels={t.pushBanner}
    />
  );
}
