import type { Metadata } from "next";

import en from "../../../../messages/en.json";
import ja from "../../../../messages/ja.json";
import vi from "../../../../messages/vi.json";
import { LotoHubClient } from "./_components/loto-hub-client";

const messages: Record<string, typeof vi> = { ja, vi, en };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;
  return {
    title: `${t.lotoHub?.title ?? "Loto Lab"} — NihonGo BJT`,
    description: t.lotoHub?.subtitle ?? "Dự đoán Loto với tiếng Nhật",
  };
}

export default async function LotoHubPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;

  return <LotoHubClient labels={t.lotoHub} locale={locale} />;
}
