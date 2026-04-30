import { adminApiFetch } from "./admin-api";
import type {
  AdminAnalyticsExecutiveResponse,
  AdminAuditLogRow,
  AdminContentSummaryResponse,
  HealthReadyResponse
} from "./admin-overview-types";

function can(p: Set<string>, codes: string[]) {
  return codes.some((c) => p.has(c));
}

export type OverviewLoadResult = {
  analytics: AdminAnalyticsExecutiveResponse | null;
  analyticsError: boolean;
  analyticsForbidden: boolean;
  audit: AdminAuditLogRow[] | null;
  auditForbidden: boolean;
  contentLexeme: AdminContentSummaryResponse | null;
  contentError: boolean;
  health: HealthReadyResponse | null;
  healthError: boolean;
  /** When true, some requests failed but analytics may still be usable */
  partialDegradation: boolean;
};

export async function loadOverviewBundle(input: {
  days: number;
  permissions: string[] | null;
}): Promise<OverviewLoadResult> {
  const p = input.permissions ? new Set(input.permissions) : null;
  const canAnalytics =
    p == null || can(p, ["viewer.analytics", "admin.analytics.view", "analytics.view"]);
  const canAudit = p == null || p.has("viewer.audit");
  const canContent = p == null || p.has("admin.content.read");

  const results: OverviewLoadResult = {
    analytics: null,
    analyticsError: false,
    analyticsForbidden: false,
    audit: null,
    auditForbidden: false,
    contentLexeme: null,
    contentError: false,
    health: null,
    healthError: false,
    partialDegradation: false
  };

  const tasks: Promise<void>[] = [];

  tasks.push(
    (async () => {
      try {
        const res = await adminApiFetch(`/api/health/ready`);
        if (res.ok) {
          results.health = (await res.json()) as HealthReadyResponse;
        } else {
          results.healthError = true;
          results.partialDegradation = true;
        }
      } catch {
        results.healthError = true;
        results.partialDegradation = true;
      }
    })()
  );

  if (canAnalytics) {
    tasks.push(
      (async () => {
        try {
          const res = await adminApiFetch(`/api/admin/analytics?days=${input.days}`);
          if (res.status === 403) {
            results.analyticsForbidden = true;
            return;
          }
          if (!res.ok) {
            results.analyticsError = true;
            return;
          }
          results.analytics = (await res.json()) as AdminAnalyticsExecutiveResponse;
        } catch {
          results.analyticsError = true;
        }
      })()
    );
  } else {
    results.analyticsForbidden = true;
  }

  if (canAudit) {
    tasks.push(
      (async () => {
        try {
          const res = await adminApiFetch("/api/admin/audit?limit=12");
          if (res.status === 403) {
            results.auditForbidden = true;
            return;
          }
          if (!res.ok) {
            results.partialDegradation = true;
            results.audit = [];
            return;
          }
          results.audit = (await res.json()) as AdminAuditLogRow[];
        } catch {
          results.partialDegradation = true;
          results.audit = [];
        }
      })()
    );
  } else {
    results.auditForbidden = true;
  }

  if (canContent) {
    tasks.push(
      (async () => {
        try {
          const res = await adminApiFetch("/api/admin/content/summary?type=lexeme");
          if (!res.ok) {
            results.contentError = true;
            results.partialDegradation = true;
            return;
          }
          results.contentLexeme = (await res.json()) as AdminContentSummaryResponse;
        } catch {
          results.contentError = true;
          results.partialDegradation = true;
        }
      })()
    );
  }

  await Promise.all(tasks);
  return results;
}
