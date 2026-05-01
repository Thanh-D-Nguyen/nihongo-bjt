import en from "../../../../messages/en.json";
import ja from "../../../../messages/ja.json";
import vi from "../../../../messages/vi.json";
import { AnalyticsDomainClient } from "../_shared/analytics-domain-client";
import { buildAnalyticsDomainLabels } from "../_shared/build-labels";

const messages = { en, ja, vi };

export default async function Page({ params }: { params: Promise<{ locale: keyof typeof messages }> }) {
  const { locale } = await params;
  const t = (messages[locale] ?? messages.vi) as typeof vi;
  const labels = buildAnalyticsDomainLabels(t, "analyticsGrowth");
  const d = t.adminConsole.analyticsGrowth;
  return (
    <AnalyticsDomainClient
      defaultDimension="by_campaign"
      defaultMetric="signups"
      dimensionOptions={[
        { value: "by_campaign", label: d.dimension.by_campaign },
        { value: "by_referral_kind", label: d.dimension.by_referral_kind },
        { value: "by_share_kind", label: d.dimension.by_share_kind }
      ]}
      domain="growth"
      labels={labels}
      metricOptions={[
        { value: "signups", label: d.metric.signups },
        { value: "activations", label: d.metric.activations },
        { value: "paid_conversions", label: d.metric.paid_conversions },
        { value: "referrals", label: d.metric.referrals },
        { value: "shares", label: d.metric.shares }
      ]}
    />
  );
}

