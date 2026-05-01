import en from "../../../../messages/en.json";
import ja from "../../../../messages/ja.json";
import vi from "../../../../messages/vi.json";
import { AnalyticsDomainClient } from "../_shared/analytics-domain-client";
import { buildAnalyticsDomainLabels } from "../_shared/build-labels";

const messages = { en, ja, vi };

export default async function Page({ params }: { params: Promise<{ locale: keyof typeof messages }> }) {
  const { locale } = await params;
  const t = (messages[locale] ?? messages.vi) as typeof vi;
  const labels = buildAnalyticsDomainLabels(t, "analyticsSystem");
  const d = t.adminConsole.analyticsSystem;
  return (
    <AnalyticsDomainClient
      defaultDimension="recent_runs"
      defaultMetric="raw_events"
      dimensionOptions={[
        { value: "recent_runs", label: d.dimension.recent_runs },
        { value: "by_event_source", label: d.dimension.by_event_source },
        { value: "by_rollup_status", label: d.dimension.by_rollup_status }
      ]}
      domain="system"
      labels={labels}
      metricOptions={[
        { value: "raw_events", label: d.metric.raw_events },
        { value: "rollup_runs", label: d.metric.rollup_runs },
        { value: "rollup_errors", label: d.metric.rollup_errors },
        { value: "dlq_depth", label: d.metric.dlq_depth }
      ]}
    />
  );
}

