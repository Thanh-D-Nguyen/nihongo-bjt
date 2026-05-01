import en from "../../../../messages/en.json";
import ja from "../../../../messages/ja.json";
import vi from "../../../../messages/vi.json";
import { AnalyticsDomainClient } from "../_shared/analytics-domain-client";
import { buildAnalyticsDomainLabels } from "../_shared/build-labels";

const messages = { en, ja, vi };

export default async function Page({ params }: { params: Promise<{ locale: keyof typeof messages }> }) {
  const { locale } = await params;
  const t = (messages[locale] ?? messages.vi) as typeof vi;
  const labels = buildAnalyticsDomainLabels(t, "analyticsSearch");
  const d = t.adminConsole.analyticsSearch;
  return (
    <AnalyticsDomainClient
      defaultDimension="top_queries"
      defaultMetric="queries"
      dimensionOptions={[
        { value: "top_queries", label: d.dimension.top_queries },
        { value: "zero_result_queries", label: d.dimension.zero_result_queries },
        { value: "by_source", label: d.dimension.by_source }
      ]}
      domain="search"
      labels={labels}
      metricOptions={[
        { value: "queries", label: d.metric.queries },
        { value: "zero_results", label: d.metric.zero_results },
        { value: "clicks", label: d.metric.clicks }
      ]}
    />
  );
}

