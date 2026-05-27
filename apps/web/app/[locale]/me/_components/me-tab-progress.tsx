"use client";

import { LearnerAnalyticsClient } from "../../analytics/analytics-client";

/**
 * Thin wrapper that embeds the existing analytics client inside the Me page Progress tab.
 * Uses a div wrapper to avoid nested <main> elements (analytics-client renders its own <main>).
 * The CSS class overrides the inner <main> to behave as a plain block.
 */
export function MeTabProgress({
  labels,
  locale,
}: {
  labels: unknown;
  locale: string;
}) {
  return (
    <div className="me-tab-progress [&>main]:pb-0">
      <LearnerAnalyticsClient
        labels={labels as Parameters<typeof LearnerAnalyticsClient>[0]["labels"]}
        locale={locale}
      />
    </div>
  );
}
