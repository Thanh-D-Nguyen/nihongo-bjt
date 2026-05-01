import en from "../../../../messages/en.json";
import ja from "../../../../messages/ja.json";
import vi from "../../../../messages/vi.json";
import { AnalyticsDomainClient } from "../_shared/analytics-domain-client";
import { buildAnalyticsDomainLabels } from "../_shared/build-labels";

const messages = { en, ja, vi };

export default async function Page({ params }: { params: Promise<{ locale: keyof typeof messages }> }) {
  const { locale } = await params;
  const t = (messages[locale] ?? messages.vi) as typeof vi;
  const labels = buildAnalyticsDomainLabels(t, "analyticsBjt");
  const d = t.adminConsole.analyticsBjt;
  return (
    <AnalyticsDomainClient
      defaultDimension="by_test"
      defaultMetric="attempts"
      dimensionOptions={[
        { value: "by_test", label: d.dimension.by_test },
        { value: "by_section", label: d.dimension.by_section },
        { value: "by_band", label: d.dimension.by_band }
      ]}
      domain="bjt"
      labels={labels}
      metricOptions={[
        { value: "attempts", label: d.metric.attempts },
        { value: "completions", label: d.metric.completions },
        { value: "avg_score", label: d.metric.avg_score },
        { value: "pass_rate", label: d.metric.pass_rate },
        { value: "avg_time_ms", label: d.metric.avg_time_ms }
      ]}
    />
  );
}

