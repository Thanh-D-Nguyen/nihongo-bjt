import type { ReactNode } from "react";
import en from "../../../messages/en.json";
import ja from "../../../messages/ja.json";
import vi from "../../../messages/vi.json";

import { BattleRuntimeProvider } from "./_components/battle-runtime-provider";
import type { BattlePageLabels } from "./_components/battle-types";

const messages = { ja, vi, en };

export default async function BattleLayout({
  children,
  params
}: Readonly<{
  children: ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  const t = messages[locale as keyof typeof messages] ?? messages.vi;
  const labels = t.battle as unknown as BattlePageLabels;
  return (
    <BattleRuntimeProvider labels={labels} locale={locale}>
      {children}
    </BattleRuntimeProvider>
  );
}
