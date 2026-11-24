import { ScenarioListClient } from "./_components/scenario-list-client";
import { RequireAuth } from "../../../components/auth/require-auth";
import en from "../../../messages/en.json";
import ja from "../../../messages/ja.json";
import vi from "../../../messages/vi.json";

const messages = { en, ja, vi };

export default async function ScenariosPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = messages[locale as keyof typeof messages] ?? vi;
  return (
    <RequireAuth locale={locale}>
      <ScenarioListClient locale={locale} copy={t.scenarios.list} studyTrackLabels={t.studyTracks} />
    </RequireAuth>
  );
}
