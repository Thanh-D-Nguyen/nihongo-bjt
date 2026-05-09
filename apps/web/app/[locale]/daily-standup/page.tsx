import type { Metadata } from "next";

import ja from "../../../messages/ja.json";
import vi from "../../../messages/vi.json";
import { CareerRpgProvider } from "../../../src/features/career-rpg/store";
import { DailyStandupPage } from "../../../src/features/career-rpg/components/daily-standup-page";

const messages = { ja, vi } as const;

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = (messages as Record<string, typeof vi>)[locale] ?? messages.vi;
  return { title: `${t.careerRpg.daily.eyebrow} — NihonGo BJT` };
}

export default async function DailyStandupRoute({
  params
}: {
  params: Promise<{ locale: keyof typeof messages }>;
}) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;

  return (
    <CareerRpgProvider>
      <DailyStandupPage labels={t.careerRpg} locale={locale} />
    </CareerRpgProvider>
  );
}
