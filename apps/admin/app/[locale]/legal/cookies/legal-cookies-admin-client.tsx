"use client";

import { AdminPageHeader, AdminSection, AdminStatusBadge } from "@nihongo-bjt/ui";
import { useEffect, useState } from "react";

import { adminApiFetch } from "@/lib/admin-api";

import { LegalPolicyAdminClient } from "../_components/legal-policy-admin-client";

type CookieCategory = {
  key: string;
  name: string;
  description: string;
  optInDefault: boolean;
  canOptOut: boolean;
  dataCollected: string[];
  retentionDays: number;
  thirdParties: string[];
};

type CommonLabels = { empty: string; error: string; loading: string; records: string };
type Labels = Record<string, string>;

export function LegalCookiesAdminClient({
  common,
  labels
}: {
  common: CommonLabels;
  labels: Labels;
}) {
  const t = (k: string) => labels[k] ?? k;
  const [tab, setTab] = useState<"policy" | "categories">("policy");
  const [categories, setCategories] = useState<CookieCategory[] | null>(null);
  const [partial, setPartial] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (tab !== "categories") return;
    let cancelled = false;
    void (async () => {
      try {
        const r = await adminApiFetch("/api/admin/legal/cookie-categories");
        if (!r.ok) {
          if (!cancelled) setError(common.error);
          return;
        }
        const body = (await r.json()) as { items: CookieCategory[]; partialSchemaPending: boolean };
        if (cancelled) return;
        setCategories(body.items);
        setPartial(body.partialSchemaPending);
      } catch {
        if (!cancelled) setError(common.error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, common.error]);

  return (
    <div className="space-y-4">
      <AdminPageHeader title={t("title")} description={t("subtitle")} />
      <AdminSection>
        <div className="flex gap-2 border-b" role="tablist">
          <button
            role="tab"
            aria-selected={tab === "policy"}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === "policy" ? "border-indigo-600 text-indigo-700" : "border-transparent text-gray-600"}`}
            onClick={() => setTab("policy")}
            type="button"
          >
            {t("tabPolicy")}
          </button>
          <button
            role="tab"
            aria-selected={tab === "categories"}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === "categories" ? "border-indigo-600 text-indigo-700" : "border-transparent text-gray-600"}`}
            onClick={() => setTab("categories")}
            type="button"
          >
            {t("tabCategories")}
          </button>
        </div>
      </AdminSection>

      {tab === "policy" ? (
        <LegalPolicyAdminClient common={common} labels={labels} fixedPolicyKey="cookie_policy" />
      ) : (
        <AdminSection>
          {partial ? (
            <div className="mb-3 rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
              {t("partialNotice")}
            </div>
          ) : null}
          {error ? (
            <div role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-900">{error}</div>
          ) : categories == null ? (
            <div className="p-3 text-sm text-gray-500">{common.loading}</div>
          ) : (
            <ul className="space-y-3">
              {categories.map((c) => (
                <li key={c.key} className="rounded border bg-white p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-mono text-xs text-gray-500">{c.key}</div>
                      <div className="text-base font-semibold">{c.name}</div>
                    </div>
                    <div className="flex flex-wrap gap-1 text-xs">
                      <AdminStatusBadge tone={c.optInDefault ? "good" : "neutral"}>
                        {c.optInDefault ? t("optInDefaultYes") : t("optInDefaultNo")}
                      </AdminStatusBadge>
                      <AdminStatusBadge tone={c.canOptOut ? "neutral" : "warning"}>
                        {c.canOptOut ? t("canOptOutYes") : t("canOptOutNo")}
                      </AdminStatusBadge>
                      <AdminStatusBadge tone="neutral">
                        {c.retentionDays} {t("days")}
                      </AdminStatusBadge>
                    </div>
                  </div>
                  <p className="mt-1 text-sm text-gray-700">{c.description}</p>
                  <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
                    <div>
                      <div className="font-semibold uppercase text-gray-500">{t("dataCollected")}</div>
                      <ul className="list-disc pl-4">
                        {c.dataCollected.map((d) => <li key={d}>{d}</li>)}
                      </ul>
                    </div>
                    <div>
                      <div className="font-semibold uppercase text-gray-500">{t("thirdParties")}</div>
                      {c.thirdParties.length === 0 ? (
                        <span className="text-gray-400">—</span>
                      ) : (
                        <ul className="list-disc pl-4">
                          {c.thirdParties.map((d) => <li key={d}>{d}</li>)}
                        </ul>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </AdminSection>
      )}
    </div>
  );
}
