"use client";

import {
  AchievementsPageClient,
  type GamificationLabels,
} from "../../achievements/_components/achievements-page-client";

/**
 * Thin wrapper that embeds the existing achievements client inside the Me page Achievements tab.
 */
export function MeTabAchievements({
  labels,
  locale,
}: {
  labels: unknown;
  locale: string;
}) {
  return (
    <div className="me-tab-achievements">
      <AchievementsPageClient
        labels={labels as GamificationLabels}
        locale={locale}
      />
    </div>
  );
}
