"use client";

import { useEffect, useState } from "react";

import { adminApiFetch } from "@/lib/admin-api";

interface GrowthLabels {
  empty: string;
  error: string;
  eyebrow: string;
  kind: string;
  loading: string;
  slug: string;
  subtitle: string;
  title: string;
}

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

export function GrowthClient({ labels }: { labels: GrowthLabels }) {
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
  const activeTpls = templates?.filter((t) => t.active).length ?? 0;
  const totalTpls = templates?.length ?? 0;
  const activeCampaigns = campaigns?.filter((c) => (c.status ?? "").toLowerCase() === "active").length ?? 0;
  const totalReferrals = referrals?.length ?? 0;
  const totalShareItems = shareItems?.length ?? 0;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <section className="admin-card">
        <p className="eyebrow">{labels.eyebrow}</p>
        <h1>{labels.title}</h1>
        <p className="lead">{labels.subtitle}</p>
        {err ? <p role="alert">{labels.error}</p> : null}
        {loading && !err ? <p>{labels.loading}</p> : null}
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="admin-card">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Share templates</p>
          <p className="text-3xl font-bold">{totalTpls}</p>
          <p className="text-xs text-muted-foreground">{activeTpls} active</p>
        </div>
        <div className="admin-card">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Active campaigns</p>
          <p className="text-3xl font-bold">{activeCampaigns}</p>
          <p className="text-xs text-muted-foreground">{campaigns?.length ?? 0} loaded</p>
        </div>
        <div className="admin-card">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Recent referrals</p>
          <p className="text-3xl font-bold">{totalReferrals}</p>
        </div>
        <div className="admin-card">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Recent share items</p>
          <p className="text-3xl font-bold">{totalShareItems}</p>
        </div>
      </section>

      <section className="admin-card">
        <h2>Share templates</h2>
        {templates && templates.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="py-2">{labels.slug}</th>
                <th className="py-2">{labels.kind}</th>
                <th className="py-2">Active</th>
                <th className="py-2">Version</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id} className="border-t">
                  <td className="py-2">
                    <code>{t.slug}</code>
                  </td>
                  <td className="py-2">{t.kind}</td>
                  <td className="py-2">{t.active ? "✓" : "—"}</td>
                  <td className="py-2">v{t.version}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-muted-foreground">{labels.empty}</p>
        )}
      </section>

      <section className="admin-card">
        <h2>Recent campaigns</h2>
        {campaigns && campaigns.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="py-2">Slug</th>
                <th className="py-2">Name</th>
                <th className="py-2">Status</th>
                <th className="py-2">Starts</th>
                <th className="py-2">Ends</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="py-2">
                    <code>{c.slug ?? "—"}</code>
                  </td>
                  <td className="py-2">{c.name ?? "—"}</td>
                  <td className="py-2">
                    <code>{c.status ?? "—"}</code>
                  </td>
                  <td className="py-2">{c.startsAt ? new Date(c.startsAt).toLocaleDateString() : "—"}</td>
                  <td className="py-2">{c.endsAt ? new Date(c.endsAt).toLocaleDateString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-muted-foreground">No campaigns yet.</p>
        )}
      </section>

      <section className="admin-card">
        <h2>Recent referrals</h2>
        {referrals && referrals.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="py-2">Referrer</th>
                <th className="py-2">Referee</th>
                <th className="py-2">Status</th>
                <th className="py-2">Channel</th>
                <th className="py-2">When</th>
              </tr>
            </thead>
            <tbody>
              {referrals.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="py-2">
                    <code className="text-xs">{r.referrerUserId?.slice(0, 8) ?? "—"}</code>
                  </td>
                  <td className="py-2">
                    <code className="text-xs">{r.refereeUserId?.slice(0, 8) ?? "—"}</code>
                  </td>
                  <td className="py-2">
                    <code>{r.status ?? "—"}</code>
                  </td>
                  <td className="py-2">{r.channel ?? "—"}</td>
                  <td className="py-2">{r.createdAt ? new Date(r.createdAt).toLocaleString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-muted-foreground">No recent referrals.</p>
        )}
      </section>
    </div>
  );
}
