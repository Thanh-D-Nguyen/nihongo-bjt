import en from "../../../../messages/en.json";
import ja from "../../../../messages/ja.json";
import vi from "../../../../messages/vi.json";
import { AnalyticsDomainClient } from "../_shared/analytics-domain-client";
import { buildAnalyticsDomainLabels } from "../_shared/build-labels";

const messages = { en, ja, vi };

export default async function Page({ params }: { params: Promise<{ locale: keyof typeof messages }> }) {
  const { locale } = await params;
  const t = (messages[locale] ?? messages.vi) as typeof vi;
  const labels = buildAnalyticsDomainLabels(t, "analyticsFlashcards");
  const d = t.adminConsole.analyticsFlashcards;
  return (
    <AnalyticsDomainClient
      defaultDimension="by_deck"
      defaultMetric="reviews"
      dimensionOptions={[
        { value: "by_deck", label: d.dimension.by_deck },
        { value: "by_rating", label: d.dimension.by_rating }
      ]}
      domain="flashcards"
      labels={labels}
      metricOptions={[
        { value: "reviews", label: d.metric.reviews },
        { value: "retention", label: d.metric.retention },
        { value: "mastered", label: d.metric.mastered },
        { value: "lapses", label: d.metric.lapses }
      ]}
    />
  );
}

