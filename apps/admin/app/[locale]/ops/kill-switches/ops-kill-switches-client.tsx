"use client";

import { OpsFeatureFlagsClient } from "../feature-flags/ops-feature-flags-client";
import type { CommonLabels, Labels } from "../../../_components/admin-client-utils";

export function OpsKillSwitchesClient({ common, labels }: { common: CommonLabels; labels: Labels }) {
  return <OpsFeatureFlagsClient common={common} labels={labels} killSwitchOnly />;
}
