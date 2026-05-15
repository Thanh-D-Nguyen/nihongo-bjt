import { ScenarioPlayClient } from "./_components/scenario-play-client";

export default function ScenarioPlayPage({
  params,
}: {
  params: { locale: string; scenarioId: string };
}) {
  return (
    <ScenarioPlayClient
      locale={params.locale}
      scenarioId={params.scenarioId}
    />
  );
}
