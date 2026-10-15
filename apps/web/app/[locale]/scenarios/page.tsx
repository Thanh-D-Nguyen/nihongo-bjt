import { ScenarioListClient } from "./_components/scenario-list-client";
import { RequireAuth } from "../../../components/auth/require-auth";
import en from "../../../messages/en.json";
import ja from "../../../messages/ja.json";
import vi from "../../../messages/vi.json";

const messages = { en, ja, vi };

export default async function ScenariosPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const copy = messages[locale as keyof typeof messages]?.scenarios.list ?? vi.scenarios.list;
  return (
    <RequireAuth locale={locale}>
      <ScenarioListClient locale={locale} copy={copy} />
    </RequireAuth>
  );
}
