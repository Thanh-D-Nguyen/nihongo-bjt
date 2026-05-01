import en from "../../../../messages/en.json";
import ja from "../../../../messages/ja.json";
import vi from "../../../../messages/vi.json";
import { AnalyticsDomainClient } from "../_shared/analytics-domain-client";
import { buildAnalyticsDomainLabels } from "../_shared/build-labels";

const messages = { en, ja, vi };

export default async function Page({ params }: { params: Promise<{ locale: keyof typeof messages }> }) {
  const { locale } = await params;
  const t = (messages[locale] ?? messages.vi) as typeof vi;
  const labels = buildAnalyticsDomainLabels(t, "analyticsContent");
  const d = t.adminConsole.analyticsContent;
  return (
    <AnalyticsDomainClient
      defaultDimension="top_engaged"
      defaultMetric="card_links_created"
      dimensionOptions={[
        { value: "top_engaged", label: d.dimension.top_engaged },
        { value: "by_type", label: d.dimension.by_type },
        { value: "by_lexeme_status", label: d.dimension.by_lexeme_status }
      ]}
      domain="content"
      labels={labels}
      metricOptions={[
        { value: "card_links_created", label: d.metric.card_links_created },
        { value: "lexeme_added", label: d.metric.lexeme_added }
      ]}
    />
  );
}

