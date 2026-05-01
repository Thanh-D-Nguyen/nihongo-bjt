"use client";

import {
  AdminDataTable,
  AdminDataTableBody,
  AdminDataTableHead,
  AdminDataTableRow,
  AdminDataTableTd,
  AdminDataTableTh,
  AdminEmptyState,
  AdminPageHeader,
  AdminSection,
  AdminStatusBadge
} from "@nihongo-bjt/ui";
import { useEffect, useState } from "react";

import { adminApiFetch } from "@/lib/admin-api";

type RetentionItem = {
  domain: string;
  label: string;
  description: string;
  retentionDays: number;
  gracePeriodDays: number;
  runner: string;
  schedule: string;
  irreversible: boolean;
};

type CommonLabels = { empty: string; error: string; loading: string; records: string };
type Labels = Record<string, string>;

export function LegalRetentionAdminClient({
  common,
  labels
}: {
  common: CommonLabels;
  labels: Labels;
}) {
  const t = (k: string) => labels[k] ?? k;
  const [items, setItems] = useState<RetentionItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [partial, setPartial] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await adminApiFetch("/api/admin/legal/retention");
        if (!r.ok) {
          if (!cancelled) setError(common.error);
          return;
        }
        const body = (await r.json()) as { items: RetentionItem[]; partialSchemaPending: boolean };
        if (cancelled) return;
        setItems(body.items);
        setPartial(body.partialSchemaPending);
      } catch {
        if (!cancelled) setError(common.error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [common.error]);

  return (
    <div className="space-y-4">
      <AdminPageHeader title={t("title")} description={t("subtitle")} />

      {partial ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          {t("partialNotice")}
        </div>
      ) : null}

      {error ? (
        <div role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-900">{error}</div>
      ) : null}

      <AdminSection>
        {items == null ? (
          <div className="p-3 text-sm text-gray-500">{common.loading}</div>
        ) : items.length === 0 ? (
          <AdminEmptyState title={common.empty} />
        ) : (
          <AdminDataTable>
            <AdminDataTableHead>
              <AdminDataTableRow>
                <AdminDataTableTh>{t("colDomain")}</AdminDataTableTh>
                <AdminDataTableTh>{t("colRetention")}</AdminDataTableTh>
                <AdminDataTableTh>{t("colGrace")}</AdminDataTableTh>
                <AdminDataTableTh>{t("colSchedule")}</AdminDataTableTh>
                <AdminDataTableTh>{t("colRunner")}</AdminDataTableTh>
                <AdminDataTableTh>{t("colReversibility")}</AdminDataTableTh>
              </AdminDataTableRow>
            </AdminDataTableHead>
            <AdminDataTableBody>
              {items.map((it) => (
                <AdminDataTableRow key={it.domain}>
                  <AdminDataTableTd>
                    <div className="font-mono text-xs text-gray-500">{it.domain}</div>
                    <div className="text-sm font-semibold">{it.label}</div>
                    <div className="text-xs text-gray-600">{it.description}</div>
                  </AdminDataTableTd>
                  <AdminDataTableTd>
                    <span className="font-mono text-sm">{it.retentionDays} {t("days")}</span>
                  </AdminDataTableTd>
                  <AdminDataTableTd>
                    <span className="font-mono text-xs">{it.gracePeriodDays} {t("days")}</span>
                  </AdminDataTableTd>
                  <AdminDataTableTd>
                    <AdminStatusBadge tone="neutral">{it.schedule}</AdminStatusBadge>
                  </AdminDataTableTd>
                  <AdminDataTableTd>
                    <span className="font-mono text-xs">{it.runner}</span>
                  </AdminDataTableTd>
                  <AdminDataTableTd>
                    <AdminStatusBadge tone={it.irreversible ? "danger" : "neutral"}>
                      {it.irreversible ? t("irreversible") : t("reversible")}
                    </AdminStatusBadge>
                  </AdminDataTableTd>
                </AdminDataTableRow>
              ))}
            </AdminDataTableBody>
          </AdminDataTable>
        )}
      </AdminSection>
    </div>
  );
}
