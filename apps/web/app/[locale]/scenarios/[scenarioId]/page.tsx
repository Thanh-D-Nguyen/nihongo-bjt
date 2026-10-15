import en from "../../../../messages/en.json";
import ja from "../../../../messages/ja.json";
import vi from "../../../../messages/vi.json";
import { RequireAuth } from "../../../../components/auth/require-auth";
import { ScenarioPlayClient } from "./_components/scenario-play-client";

const messages = { en, ja, vi };

export default async function ScenarioPlayPage({
  params,
}: {
  params: Promise<{ locale: string; scenarioId: string }>;
}) {
  const { locale, scenarioId } = await params;
  const copy = messages[locale as keyof typeof messages]?.scenarios.play ?? vi.scenarios.play;
  return (
    <RequireAuth locale={locale}>
      <ScenarioPlayClient locale={locale} scenarioId={scenarioId} copy={copy} />
    </RequireAuth>
  );
}
