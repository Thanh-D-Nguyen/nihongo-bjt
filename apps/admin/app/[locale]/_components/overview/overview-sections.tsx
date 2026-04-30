"use client";

import Link from "next/link";

import { AdminEmptyState, AdminSection, AdminStatusBadge, AdminTaskCard, Card, CardContent, CardHeader, CardTitle } from "@nihongo-bjt/ui";

import { mapHealthStatus } from "@/lib/admin-overview-mappers";
import type { AppHealthUiStatus, AdminAuditLogRow, HealthReadyResponse } from "@/lib/admin-overview-types";

function badgeFromHealth(t: AppHealthUiStatus): "danger" | "good" | "neutral" | "warning" {
  if (t === "healthy") {
    return "good";
  }
  if (t === "degraded") {
    return "warning";
  }
  if (t === "down") {
    return "danger";
  }
  return "neutral";
}

export function LearningHealthPanel({
  basePath,
  labels,
  searchRate,
  studyUnavailable
}: {
  basePath: string;
  labels: Record<string, string>;
  searchRate: { available: boolean; value: number | null } | null;
  studyUnavailable: boolean;
}) {
  return (
    <Card className="border-slate-200/90 bg-white shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{labels.title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3">
          <p className="text-xs font-semibold uppercase text-slate-500">{labels.reviewCompletion}</p>
          <p className="mt-1 text-sm text-slate-600">{labels.reviewCompletionNA}</p>
        </div>
        <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3">
          <p className="text-xs font-semibold uppercase text-slate-500">{labels.avgAccuracy}</p>
          <p className="mt-1 text-sm text-slate-600">{labels.avgAccuracyNA}</p>
        </div>
        <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3">
          <p className="text-xs font-semibold uppercase text-slate-500">{labels.searchSuccess}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
            {searchRate?.available && searchRate.value != null ? `${Math.round(searchRate.value * 100)}%` : "—"}
          </p>
        </div>
        <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3">
          <p className="text-xs font-semibold uppercase text-slate-500">{labels.studyMinutes}</p>
          <p className="mt-1 text-sm text-slate-600">{studyUnavailable ? labels.studyMinutesNA : "—"}</p>
        </div>
        <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3 sm:col-span-2">
          <p className="text-xs font-semibold uppercase text-slate-500">{labels.streak}</p>
          <p className="mt-1 text-sm text-slate-600">{labels.streakNA}</p>
        </div>
        <div className="sm:col-span-2">
          <Link className="text-sm font-semibold text-indigo-700 hover:underline" href={`${basePath}/analytics/learning`}>
            {labels.cta}
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export function ContentOperationsPanel({
  basePath,
  enrichmentLabel,
  importLabel,
  labels,
  lexemeByStatus,
  meiliInsight,
  mediaLabel
}: {
  basePath: string;
  enrichmentLabel: string;
  importLabel: string;
  labels: Record<string, string>;
  lexemeByStatus: Record<string, number> | null;
  meiliInsight: string;
  mediaLabel: string;
}) {
  const published = lexemeByStatus?.active ?? null;
  const draft = lexemeByStatus?.needs_review ?? null;

  const row = (title: string, value: string, href: string, tone: "good" | "neutral" | "warning") => (
    <Link className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md" href={href}>
      <span className="text-xs font-semibold uppercase text-slate-500">{title}</span>
      <span className="mt-2 text-lg font-semibold text-slate-900">{value}</span>
              <div className="mt-2">
                <AdminStatusBadge tone={tone}>
                  {labels.cardStatus}
                </AdminStatusBadge>
              </div>
    </Link>
  );

  return (
    <Card className="border-slate-200/90 bg-white shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{labels.title}</CardTitle>
        <p className="text-sm text-slate-600">{labels.subtitle}</p>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {row(
            labels.dictPublished,
            published != null ? published.toLocaleString() : "—",
            `${basePath}/dictionary`,
            "good"
          )}
          {row(
            labels.draftQueue,
            draft != null ? draft.toLocaleString() : "—",
            `${basePath}/dictionary`,
            draft && draft > 0 ? "warning" : "neutral"
          )}
          {row(labels.mediaPending, mediaLabel, `${basePath}/media`, "warning")}
          {row(labels.enrichmentPending, enrichmentLabel, `${basePath}/content/enrichment`, "neutral")}
          {row(labels.importJobs, importLabel, `${basePath}/import`, "neutral")}
          <div className="flex flex-col rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-4">
            <span className="text-xs font-semibold uppercase text-slate-500">{labels.searchSync}</span>
            <p className="mt-2 text-sm text-slate-600">{meiliInsight}</p>
            <Link className="mt-2 text-sm font-semibold text-indigo-700" href={`${basePath}/system/search-sync`}>
              {labels.open}
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function SystemHealthPanel({
  health,
  healthError,
  labels
}: {
  health: HealthReadyResponse | null;
  healthError: boolean;
  labels: Record<string, string>;
}) {
  const rows: { id: string; status: AppHealthUiStatus; title: string }[] = [];
  if (healthError || !health) {
    for (const [id, key] of [
      ["api", "row_api"],
      ["db", "row_db"],
      ["kc", "row_keycloak"],
      ["redis", "row_redis"],
      ["meili", "row_meili"],
      ["worker", "row_worker"],
      ["storage", "row_storage"]
    ] as const) {
      rows.push({ id, status: "unknown" as const, title: labels[key] });
    }
  } else {
    rows.push({
      id: "api",
      status: health.status === "ok" ? "healthy" : "degraded",
      title: labels.row_api
    });
    rows.push({
      id: "db",
      status: mapHealthStatus(health.checks?.database ?? null, !health.checks?.database),
      title: labels.row_db
    });
    rows.push({
      id: "kc",
      status: mapHealthStatus(health.checks?.keycloak_realm_admin ?? null, !health.checks?.keycloak_realm_admin),
      title: labels.row_keycloak
    });
    for (const extra of ["redis", "meili", "worker", "storage"] as const) {
      rows.push({ id: extra, status: "unknown", title: labels[`row_${extra}`] });
    }
  }

  return (
    <Card className="border-slate-200/90 bg-white shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{labels.title}</CardTitle>
        <p className="text-sm text-slate-500">{healthError ? labels.degradedHint : labels.hint}</p>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => (
            <li className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2" key={r.id}>
              <span className="text-sm text-slate-700">{r.title}</span>
              <AdminStatusBadge tone={badgeFromHealth(r.status)}>{labels[`health_${r.status}`]}</AdminStatusBadge>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-slate-500">{labels.openapiNA}</p>
        <p className="text-xs text-slate-500">{labels.backupNA}</p>
      </CardContent>
    </Card>
  );
}

export function ActionCenter({
  items,
  labels
}: {
  items: Array<{
    count: number;
    id: string;
    perm: string;
    route: string;
  } | null>;
  labels: Record<string, string>;
}) {
  const flat = items.filter((x): x is NonNullable<typeof x> => x != null && x.count > 0);
  if (flat.length === 0) {
    return (
      <AdminTaskCard title={labels.title}>
        <p className="text-sm text-slate-600">{labels.emptyEncourage}</p>
      </AdminTaskCard>
    );
  }
  return (
    <AdminTaskCard title={labels.title}>
      <ul className="space-y-2">
        {flat.map((t) => (
          <li className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2" key={t.id}>
            <div>
              <p className="text-sm font-medium text-slate-900">{labels[`task_${t.id}`]}</p>
              <p className="text-xs text-slate-500">
                {labels.perm}: {t.perm} · {labels.countLabel}: {t.count}
              </p>
            </div>
            <Link className="shrink-0 text-sm font-semibold text-indigo-700" href={t.route}>
              {labels.open}
            </Link>
          </li>
        ))}
      </ul>
    </AdminTaskCard>
  );
}

export function ProductInsightsGrid({
  cards,
  labels
}: {
  cards: Array<{ body: string; id: string; title: string } | null>;
  labels: { empty: string; title: string };
}) {
  const list = cards.filter((c): c is NonNullable<typeof c> => c != null);
  if (list.length === 0) {
    return (
      <AdminSection title={labels.title}>
        <AdminEmptyState title={labels.empty} />
      </AdminSection>
    );
  }
  return (
    <AdminSection title={labels.title}>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {list.map((c) => (
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" key={c.id}>
            <p className="text-sm font-semibold text-slate-900">{c.title}</p>
            <p className="mt-1 text-sm text-slate-600">{c.body}</p>
          </div>
        ))}
      </div>
    </AdminSection>
  );
}

export function QuickActionsGrid({ actions }: { actions: Array<{ href: string; id: string; label: string } | null> }) {
  const a = actions.filter((x): x is NonNullable<typeof x> => x != null);
  return (
    <div className="flex flex-wrap gap-2">
      {a.map((x) => (
        <Link
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50"
          href={x.href}
          key={x.id}
        >
          {x.label}
        </Link>
      ))}
    </div>
  );
}

export function RecentAuditTable({
  basePath,
  common,
  labels,
  resolveActionLabel,
  rows
}: {
  basePath: string;
  common: { empty: string };
  labels: Record<string, string>;
  resolveActionLabel: (action: string) => string;
  rows: AdminAuditLogRow[] | null;
}) {
  if (rows == null) {
    return (
      <AdminSection title={labels.title}>
        <p className="text-sm text-amber-800">{labels.forbidden}</p>
      </AdminSection>
    );
  }
  if (rows.length === 0) {
    return (
      <AdminSection title={labels.title}>
        <AdminEmptyState title={common.empty} />
      </AdminSection>
    );
  }
  return (
    <AdminSection title={labels.title}>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50/90 text-xs font-semibold uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">{labels.colTime}</th>
              <th className="px-3 py-2">{labels.colActor}</th>
              <th className="px-3 py-2">{labels.colAction}</th>
              <th className="px-3 py-2">{labels.colTarget}</th>
              <th className="px-3 py-2">{labels.colSeverity}</th>
              <th className="px-3 py-2">{labels.colReason}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
                <tr className="border-b border-slate-100" key={r.id}>
                  <td className="px-3 py-2 font-mono text-xs text-slate-600">{r.createdAt}</td>
                  <td className="px-3 py-2 text-slate-800">{r.actor?.displayName ?? "—"}</td>
                  <td className="px-3 py-2 text-slate-800">{resolveActionLabel(r.action)}</td>
                  <td className="px-3 py-2 text-xs text-slate-600">
                    {r.targetType}:{r.targetId}
                  </td>
                  <td className="px-3 py-2 text-xs">—</td>
                  <td className="px-3 py-2 text-xs text-slate-600">{r.reason ?? "—"}</td>
                </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2">
        <Link className="text-sm font-semibold text-indigo-700" href={`${basePath}/audit`}>
          {labels.seeAll}
        </Link>
      </div>
    </AdminSection>
  );
}
