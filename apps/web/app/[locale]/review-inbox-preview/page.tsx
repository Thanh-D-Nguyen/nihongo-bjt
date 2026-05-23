import type { Metadata } from "next";

import ja from "../../../messages/ja.json";
import vi from "../../../messages/vi.json";

import { InboxPreviewClient } from "./_components/inbox-preview-client";

const messages = { ja, vi } as const;

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = (messages as Record<string, typeof vi>)[locale] ?? messages.vi;
  return { title: `${t.careerRpg.inbox.title} — NihonGo BJT` };
}

export default async function InboxRoute({
  params
}: {
  params: Promise<{ locale: keyof typeof messages }>;
}) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;
  return (
    <InboxPreviewClient labels={t.careerRpg} locale={locale} />
  );
}
