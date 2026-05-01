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

type Labels = Record<string, string>;
type CommonLabels = Record<string, string>;

interface TemplateRow {
  active: boolean;
  id: string;
  kind: string;
  slug: string;
  version: number;
}

interface ReferralRow {
  id: string;
  referrerUserId?: string | null;
  refereeUserId?: string | null;
  status?: string | null;
  channel?: string | null;
  createdAt?: string;
}

interface CampaignRow {
  id: string;
  slug?: string;
  name?: string | null;
  status?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
}

interface ShareItemRow {
  id: string;
  shareKind?: string;
  itemType?: string;
  status?: string | null;
  createdAt?: string;
}

function unwrap<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object" && "items" in (data as Record<string, unknown>)) {
    const items = (data as { items?: unknown }).items;
    return Array.isArray(items) ? (items as T[]) : [];
  }
  return [];
}

export function GrowthClient({ common, labels }: { common?: CommonLabels; labels: Labels }) {
  const t = (k: string) => labels[k] ?? common?.[k] ?? k;

  const [templates, setTemplates] = useState<TemplateRow[] | null>(null);
  const [referrals, setReferrals] = useState<ReferralRow[] | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignRow[] | null>(null);
  const [shareItems, setShareItems] = useState<ShareItemRow[] | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [tplRes, refRes, camRes, shareRes] = await Promise.all([
          adminApiFetch("/api/admin/growth/share-templates"),
          adminApiFetch("/api/admin/growth/referrals?pageSize=10"),
          adminApiFetch("/api/admin/growth/campaigns?pageSize=10"),
          adminApiFetch("/api/admin/growth/social/events?pageSize=10")
        ]);
        const tplData = tplRes.ok ? await tplRes.json() : [];
        const refData = refRes.ok ? await refRes.json() : [];
        const camData = camRes.ok ? await camRes.json() : [];
        const shareData = shareRes.ok ? await shareRes.json() : [];
        if (!cancelled) {
          setTemplates(unwrap<TemplateRow>(tplData));
          setReferrals(unwrap<ReferralRow>(refData));
          setCampaigns(unwrap<CampaignRow>(camData));
          setShareItems(unwrap<ShareItemRow>(shareData));
        }
      } catch {
        if (!cancelled) setErr(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loading =
    templates === null && referrals === null && campaigns === null && shareItems === null;
  const activeTpls = templates?.filter((tp) => tp.active).length ?? 0;
  const totalTpls = templates?.length ?? 0;
  const activeCampaigns = campaigns?.filter((c) => (c.status ?? "").toLowerCase() === "active").length ?? 0;
  const totalReferrals = referrals?.length ?? 0;
  const totalShareItems = shareItems?.length ?? 0;

  return (
    <div className="space-y-4">
      <AdminPageHeader title={t("title")} description={t("subtitle")} />

      {err ? (
        <div role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          {t("error")}
        </div>
      ) : null}
      {loading && !err ? (
        <div className="p-4 text-sm text-gray-500">{t("loading")}</div>
      ) : null}

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <a href="growth/postcards" className="admin-card block hover:ring-2 hover:ring-primary/30 transition-shadow">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("kpiTemplates")}</p>
          <p className="text-3xl font-bold">{totalTpls}</p>
          <p className="text-xs text-muted-foreground">{activeTpls} {t("active")}</p>
        </a>
        <a href="growth/campaigns" className="admin-card block hover:ring-2 hover:ring-primary/30 transition-shadow">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("kpiCampaigns")}</p>
          <p className="text-3xl font-bold">{activeCampaigns}</p>
          <p className="text-xs text-muted-foreground">{campaigns?.length ?? 0} {t("loaded")}</p>
        </a>
        <a href="growth/referrals" className="admin-card block hover:ring-2 hover:ring-primary/30 transition-shadow">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("kpiReferrals")}</p>
          <p className="text-3xl font-bold">{totalReferrals}</p>
        </a>
        <a href="growth/social" className="admin-card block hover:ring-2 hover:ring-primary/30 transition-shadow">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("kpiShareItems")}</p>
          <p className="text-3xl font-bold">{totalShareItems}</p>
        </a>
      </div>

      {/* Share templates */}
      <AdminSection>
        <div className="flex items-center justify-between px-4 pt-3 pb-1">
          <h2 className="text-sm font-semibold">{t("sectionTemplates")}</h2>
          <a href="growth/postcards" className="text-xs text-blue-600 hover:underline">{t("viewAll")}</a>
        </div>
        {templates && templates.length > 0 ? (
          <AdminDataTable>
            <AdminDataTableHead>
              <AdminDataTableRow>
                <AdminDataTableTh>{t("slug")}</AdminDataTableTh>
                <AdminDataTableTh>{t("kind")}</AdminDataTableTh>
                <AdminDataTableTh>{t("colActive")}</AdminDataTableTh>
                <AdminDataTableTh>{t("colVersion")}</AdminDataTableTh>
              </AdminDataTableRow>
            </AdminDataTableHead>
            <AdminDataTableBody>
              {templates.map((tp) => (
                <AdminDataTableRow key={tp.id}>
                  <AdminDataTableTd><code className="text-xs">{tp.slug}</code></AdminDataTableTd>
                  <AdminDataTableTd><AdminStatusBadge tone="neutral">{tp.kind}</AdminStatusBadge></AdminDataTableTd>
                  <AdminDataTableTd>{tp.active ? "✓" : "—"}</AdminDataTableTd>
                  <AdminDataTableTd>v{tp.version}</AdminDataTableTd>
                </AdminDataTableRow>
              ))}
            </AdminDataTableBody>
          </AdminDataTable>
        ) : templates ? (
          <AdminEmptyState title={t("empty")} />
        ) : null}
      </AdminSection>

      {/* Campaigns */}
      <AdminSection>
        <div className="flex items-center justify-between px-4 pt-3 pb-1">
          <h2 className="text-sm font-semibold">{t("sectionCampaigns")}</h2>
          <a href="growth/campaigns" className="text-xs text-blue-600 hover:underline">{t("viewAll")}</a>
        </div>
        {campaigns && campaigns.length > 0 ? (
          <AdminDataTable>
            <AdminDataTableHead>
              <AdminDataTableRow>
                <AdminDataTableTh>{t("slug")}</AdminDataTableTh>
                <AdminDataTableTh>{t("colName")}</AdminDataTableTh>
                <AdminDataTableTh>{t("status")}</AdminDataTableTh>
                <AdminDataTableTh>{t("colStarts")}</AdminDataTableTh>
                <AdminDataTableTh>{t("colEnds")}</AdminDataTableTh>
              </AdminDataTableRow>
            </AdminDataTableHead>
            <AdminDataTableBody>
              {campaigns.map((c) => (
                <AdminDataTableRow key={c.id}>
                  <AdminDataTableTd><code className="text-xs">{c.slug ?? "—"}</code></AdminDataTableTd>
                  <AdminDataTableTd>{c.name ?? "—"}</AdminDataTableTd>
                  <AdminDataTableTd>
                    <AdminStatusBadge tone={(c.status ?? "").toLowerCase() === "active" ? "good" : "neutral"}>
                      {c.status ?? "—"}
                    </AdminStatusBadge>
                  </AdminDataTableTd>
                  <AdminDataTableTd>{c.startsAt ? new Date(c.startsAt).toLocaleDateString() : "—"}</AdminDataTableTd>
                  <AdminDataTableTd>{c.endsAt ? new Date(c.endsAt).toLocaleDateString() : "—"}</AdminDataTableTd>
                </AdminDataTableRow>
              ))}
            </AdminDataTableBody>
          </AdminDataTable>
        ) : campaigns ? (
          <AdminEmptyState title={t("noCampaigns")} />
        ) : null}
      </AdminSection>

      {/* Referrals */}
      <AdminSection>
        <div className="flex items-center justify-between px-4 pt-3 pb-1">
          <h2 className="text-sm font-semibold">{t("sectionReferrals")}</h2>
          <a href="growth/referrals" className="text-xs text-blue-600 hover:underline">{t("viewAll")}</a>
        </div>
        {referrals && referrals.length > 0 ? (
          <AdminDataTable>
            <AdminDataTableHead>
              <AdminDataTableRow>
                <AdminDataTableTh>{t("colReferrer")}</AdminDataTableTh>
                <AdminDataTableTh>{t("colReferee")}</AdminDataTableTh>
                <AdminDataTableTh>{t("status")}</AdminDataTableTh>
                <AdminDataTableTh>{t("colChannel")}</AdminDataTableTh>
                <AdminDataTableTh>{t("colWhen")}</AdminDataTableTh>
              </AdminDataTableRow>
            </AdminDataTableHead>
            <AdminDataTableBody>
              {referrals.map((r) => (
                <AdminDataTableRow key={r.id}>
                  <AdminDataTableTd><code className="text-xs">{r.referrerUserId?.slice(0, 8) ?? "—"}</code></AdminDataTableTd>
                  <AdminDataTableTd><code className="text-xs">{r.refereeUserId?.slice(0, 8) ?? "—"}</code></AdminDataTableTd>
                  <AdminDataTableTd><AdminStatusBadge tone="neutral">{r.status ?? "—"}</AdminStatusBadge></AdminDataTableTd>
                  <AdminDataTableTd>{r.channel ?? "—"}</AdminDataTableTd>
                  <AdminDataTableTd>
                    <span className="text-xs font-mono">{r.createdAt ? new Date(r.createdAt).toLocaleString() : "—"}</span>
                  </AdminDataTableTd>
                </AdminDataTableRow>
              ))}
            </AdminDataTableBody>
          </AdminDataTable>
        ) : referrals ? (
          <AdminEmptyState title={t("noReferrals")} />
        ) : null}
      </AdminSection>
    </div>
  );
}
