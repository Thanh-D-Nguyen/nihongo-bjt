"use client";

import { OverviewPageRoot } from "./overview/overview-page";

type OverviewDashboardMessages = Record<string, string>;
type CommonShape = {
  deltaFormat: (pct: string) => string;
  empty: string;
  error: string;
  loading: string;
  noChart: string;
};

export function AdminOverviewClient({
  common,
  locale,
  overviewDashboard,
  overviewLegacy
}: {
  common: { empty: string; error: string; loading: string; noChartData: string; noChart?: string };
  locale: "en" | "ja" | "vi";
  overviewDashboard: OverviewDashboardMessages;
  overviewLegacy: { error: string; loading: string; notAvailable: string; subtitle: string; title: string };
}) {
  const deltaFormat = (pct: string) => (overviewDashboard.deltaFormat ?? "Δ {value}").replace("{value}", pct);
  const messages: {
    common: CommonShape;
    d: Record<string, string>;
    overviewLegacy: typeof overviewLegacy;
  } = {
    common: { ...common, deltaFormat, noChart: common.noChartData },
    d: overviewDashboard,
    overviewLegacy
  };
  return <OverviewPageRoot locale={locale} messages={messages} />;
}
