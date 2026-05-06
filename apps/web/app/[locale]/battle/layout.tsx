import type { ReactNode } from "react";
import ja from "../../../messages/ja.json";
import vi from "../../../messages/vi.json";

import { BattleRuntimeProvider } from "./_components/battle-runtime-provider";
import type { BattlePageLabels } from "./_components/battle-types";

export default async function BattleLayout({
  children,
  params
}: Readonly<{
  children: ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  const labels = (locale === "ja" ? ja.battle : vi.battle) as unknown as BattlePageLabels;
  return (
    <BattleRuntimeProvider labels={labels} locale={locale}>
      {children}
    </BattleRuntimeProvider>
  );
}
