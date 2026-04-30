import type { AppHealthUiStatus, KpiModel } from "./admin-overview-types";

/** Maps API / internal health check status to a stable UI vocabulary (spec: healthy | degraded | down | unknown). */
export function mapHealthStatus(
  input: { status?: string } | null | undefined,
  hasError: boolean
): AppHealthUiStatus {
  if (hasError) {
    return "unknown";
  }
  const s = input?.status;
  if (s === "ok") {
    return "healthy";
  }
  if (s === "degraded") {
    return "degraded";
  }
  if (s === "down" || s === "error" || s === "unhealthy") {
    return "down";
  }
  if (s == null) {
    return "unknown";
  }
  return "unknown";
}

/** User-facing i18n key fragment for health: `healthy` | `degraded` | `down` | `unknown` */
export function mapOverallHealthFromReadyPayload(payload: { status: string; checks?: Record<string, { status: string }> } | null) {
  if (!payload) {
    return { overall: "unknown" as const };
  }
  if (payload.status === "degraded") {
    return { overall: "degraded" as const };
  }
  const bad = Object.values(payload.checks ?? {}).some((c) => c.status === "degraded");
  if (bad) {
    return { overall: "degraded" as const };
  }
  if (payload.status === "ok") {
    return { overall: "healthy" as const };
  }
  return { overall: "unknown" as const };
}

/**
 * Map analytics metric / event keys to a stable label key: `eventLabels.<keyWithDotsAsUnderscore>`
 * for next-intl / JSON — consumer resolves `eventLabels.assessment_sessions_completed` etc.
 */
export function eventLabelKeyMetric(metricKey: string): string {
  return `eventLabels.${metricKey.replaceAll(".", "_")}`;
}

const KNOWN_EVENT_PREFIXES: Array<{ prefix: string; key: string }> = [
  { key: "prefix.assessment", prefix: "assessment." },
  { key: "prefix.content", prefix: "content." },
  { key: "prefix.flashcards", prefix: "flashcards." },
  { key: "prefix.ops", prefix: "ops." },
  { key: "prefix.user", prefix: "user." },
  { key: "prefix.quiz", prefix: "quiz." },
  { key: "prefix.battle", prefix: "battle." }
];

export function mapEventLabelI18nKey(rawKey: string): string {
  if (!rawKey || rawKey.length === 0) {
    return "eventLabels._unknown";
  }
  const direct = eventLabelKeyMetric(rawKey);
  return direct;
}

export function mapEventLabelI18nKeyWithFallbacks(rawKey: string): string[] {
  const keys: string[] = [mapEventLabelI18nKey(rawKey)];
  for (const { prefix, key } of KNOWN_EVENT_PREFIXES) {
    if (rawKey.startsWith(prefix)) {
      keys.push(`${key}_generic`);
    }
  }
  keys.push("eventLabels._unknown");
  return keys;
}

/** Technical audit `action` values → i18n key under `auditActions.*` */
export function mapAuditActionLabelI18nKey(action: string): string {
  const safe = action.replaceAll(".", "_");
  return `auditActions_${safe}`;
}

export function mapAuditSeverityI18nKey(action: string, reason: string | null | undefined): string {
  const a = (action + (reason ?? "")).toLowerCase();
  if (a.includes("delete") || a.includes("remove") || a.includes("block")) {
    return "severity.high";
  }
  if (a.includes("update") || a.includes("create") || a.includes("write")) {
    return "severity.medium";
  }
  return "severity.low";
}

export type KpiStatusTone = "good" | "warning" | "critical" | "neutral";

/**
 * `up` means higher value is better (users, reviews).
 * `down` means lower delta is better (rare; search zero share is handled elsewhere).
 */
export function kpiModelStatusTone(
  m: KpiModel,
  direction: "up" | "neutral"
): KpiStatusTone {
  if (!m.available || m.value == null) {
    return "neutral";
  }
  if (m.deltaRatio == null) {
    return "neutral";
  }
  if (direction === "neutral") {
    return "good";
  }
  const t = m.deltaRatio;
  if (t < -0.2) {
    return "critical";
  }
  if (t < -0.05) {
    return "warning";
  }
  if (t > 0.05) {
    return "good";
  }
  return "good";
}

export function formatDeltaPercent(ratio: number | null, labels: { na: string; format: (pct: string) => string }): {
  line: string;
  tone: "down" | "neutral" | "up";
} {
  if (ratio == null || Number.isNaN(ratio)) {
    return { line: labels.na, tone: "neutral" };
  }
  const pct = (ratio * 100).toFixed(1);
  if (ratio > 0) {
    return { line: labels.format(`+${pct}%`), tone: "up" };
  }
  if (ratio < 0) {
    return { line: labels.format(`${pct}%`), tone: "down" };
  }
  return { line: labels.format("0%"), tone: "neutral" };
}
