import en from "../../../../messages/en.json";
import ja from "../../../../messages/ja.json";
import vi from "../../../../messages/vi.json";
import { AnalyticsDomainClient } from "../_shared/analytics-domain-client";
import { buildAnalyticsDomainLabels } from "../_shared/build-labels";

const messages = { en, ja, vi };

export default async function Page({ params }: { params: Promise<{ locale: keyof typeof messages }> }) {
  const { locale } = await params;
  const t = (messages[locale] ?? messages.vi) as typeof vi;
  const labels = buildAnalyticsDomainLabels(t, "analyticsBattle");
  const d = t.adminConsole.analyticsBattle;
  return (
    <AnalyticsDomainClient
      defaultDimension="by_mode"
      defaultMetric="matches"
      dimensionOptions={[
        { value: "by_mode", label: d.dimension.by_mode },
        { value: "by_status", label: d.dimension.by_status },
        { value: "by_user", label: d.dimension.by_user }
      ]}
      domain="battle"
      labels={labels}
      metricOptions={[
        { value: "matches", label: d.metric.matches },
        { value: "active_players", label: d.metric.active_players },
        { value: "abuse_reports", label: d.metric.abuse_reports },
        { value: "avg_duration_ms", label: d.metric.avg_duration_ms }
      ]}
    />
  );
}
