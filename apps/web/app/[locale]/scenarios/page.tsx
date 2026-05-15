import { ScenarioListClient } from "./_components/scenario-list-client";

export default function ScenariosPage({ params }: { params: { locale: string } }) {
  return <ScenarioListClient locale={params.locale} />;
}
