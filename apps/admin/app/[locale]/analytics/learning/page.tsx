import en from "../../../../messages/en.json";
import ja from "../../../../messages/ja.json";
import vi from "../../../../messages/vi.json";
import { AnalyticsDomainClient } from "../_shared/analytics-domain-client";
import { buildAnalyticsDomainLabels } from "../_shared/build-labels";

const messages = { en, ja, vi };

export default async function Page({ params }: { params: Promise<{ locale: keyof typeof messages }> }) {
  const { locale } = await params;
  const t = (messages[locale] ?? messages.vi) as typeof vi;
  const labels = buildAnalyticsDomainLabels(t, "analyticsLearning");
  const d = t.adminConsole.analyticsLearning;
  return (
    <AnalyticsDomainClient
      defaultDimension="top_studiers"
      defaultMetric="reviews"
      dimensionOptions={[
        { value: "top_studiers", label: d.dimension.top_studiers },
        { value: "by_card_state", label: d.dimension.by_card_state },
        { value: "by_rating", label: d.dimension.by_rating }
      ]}
      domain="learning"
      labels={labels}
      metricOptions={[
        { value: "reviews", label: d.metric.reviews },
        { value: "active_studiers", label: d.metric.active_studiers }
      ]}
    />
  );
}

