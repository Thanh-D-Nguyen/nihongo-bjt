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
import { useCallback, useEffect, useState } from "react";

import { adminApiFetch } from "@/lib/admin-api";
import { permsFromMe, type MePayload } from "@/app/_components/admin-client-utils";

type Labels = Record<string, unknown>;

/* ── Types ─────────────────────────────────────────────────────────────── */

type StreakConfig = {
  id: string;
  name: string;
  activityType: string;
  minActions: number;
  freezesAllowed: number;
  enabled: boolean;
};

type AchievementDef = {
  id: string;
  slug: string;
  nameKey: string;
  descriptionKey: string;
  category: string;
  metric: string;
  iconUrl: string | null;
  tiers: Array<{
    id: string;
    tier: string;
    threshold: number;
    rewardXp: number;
  }>;
};

type LeaderboardConfig = {
  id: string;
  name: string;
  metricType: string;
  period: string;
  maxEntries: number;
  enabled: boolean;
};

type Tab = "streaks" | "achievements" | "leaderboards";

/* ── Component ─────────────────────────────────────────────────────────── */

export function GamificationAdminClient({ labels }: { labels: Labels }) {
  const t = (k: string) => (labels[k] as string) ?? k;
  const tiers = (labels.tiers ?? {}) as Record<string, string>;

  const [perms, setPerms] = useState<Set<string> | null>(null);
  const canWrite = perms != null && (perms.has("content.manage") || perms.has("admin.content.write"));

  const [tab, setTab] = useState<Tab>("streaks");
  const [streakConfigs, setStreakConfigs] = useState<StreakConfig[]>([]);
  const [achievements, setAchievements] = useState<AchievementDef[]>([]);
  const [leaderboards, setLeaderboards] = useState<LeaderboardConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // Streak form
  const [streakModal, setStreakModal] = useState(false);
  const [streakEditId, setStreakEditId] = useState<string | null>(null);
  const [streakForm, setStreakForm] = useState({ name: "", activityType: "", minActions: 1, freezesAllowed: 0, enabled: true });

  // Leaderboard form
  const [lbModal, setLbModal] = useState(false);
  const [lbEditId, setLbEditId] = useState<string | null>(null);
  const [lbForm, setLbForm] = useState({ name: "", metricType: "xp", period: "weekly", maxEntries: 100, enabled: true });

  const [deleteConfirm, setDeleteConfirm] = useState<{ type: string; id: string } | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const r = await adminApiFetch("/api/admin/me");
        if (r.ok) { setPerms(permsFromMe((await r.json()) as MePayload)); }
        else { setPerms(new Set()); }
      } catch { setPerms(new Set()); }
    })();
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, aRes, lRes] = await Promise.all([
        adminApiFetch("/api/admin/gamification/streaks"),
        adminApiFetch("/api/admin/gamification/achievements"),
        adminApiFetch("/api/admin/gamification/leaderboards")
      ]);
      if (sRes.ok) setStreakConfigs((await sRes.json()) as StreakConfig[]);
      if (aRes.ok) setAchievements((await aRes.json()) as AchievementDef[]);
      if (lRes.ok) setLeaderboards((await lRes.json()) as LeaderboardConfig[]);
    } catch { /* handled */ }
    setLoading(false);
  }, []);

  useEffect(() => { void loadAll(); }, [loadAll]);

  /* ── Streak CRUD ─────────────────────────────────────────────────────── */

  function openStreakCreate() {
    setStreakEditId(null);
    setStreakForm({ name: "", activityType: "", minActions: 1, freezesAllowed: 0, enabled: true });
    setStreakModal(true);
  }

  function openStreakEdit(s: StreakConfig) {
    setStreakEditId(s.id);
    setStreakForm({ name: s.name, activityType: s.activityType, minActions: s.minActions, freezesAllowed: s.freezesAllowed, enabled: s.enabled });
    setStreakModal(true);
  }

  async function saveStreak() {
    try {
      const url = streakEditId ? `/api/admin/gamification/streaks/${streakEditId}` : "/api/admin/gamification/streaks";
      const r = await adminApiFetch(url, {
        method: streakEditId ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(streakForm)
      });
      if (!r.ok) { setToast({ kind: "err", text: t("error") }); return; }
      setToast({ kind: "ok", text: t("saveOk") });
      setStreakModal(false);
      void loadAll();
    } catch { setToast({ kind: "err", text: t("error") }); }
  }

  /* ── Leaderboard CRUD ────────────────────────────────────────────────── */

  function openLbCreate() {
    setLbEditId(null);
    setLbForm({ name: "", metricType: "xp", period: "weekly", maxEntries: 100, enabled: true });
    setLbModal(true);
  }

  function openLbEdit(lb: LeaderboardConfig) {
    setLbEditId(lb.id);
    setLbForm({ name: lb.name, metricType: lb.metricType, period: lb.period, maxEntries: lb.maxEntries, enabled: lb.enabled });
    setLbModal(true);
  }

  async function saveLb() {
    try {
      const url = lbEditId ? `/api/admin/gamification/leaderboards/${lbEditId}` : "/api/admin/gamification/leaderboards";
      const r = await adminApiFetch(url, {
        method: lbEditId ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(lbForm)
      });
      if (!r.ok) { setToast({ kind: "err", text: t("error") }); return; }
      setToast({ kind: "ok", text: t("saveOk") });
      setLbModal(false);
      void loadAll();
    } catch { setToast({ kind: "err", text: t("error") }); }
  }

  /* ── Delete ──────────────────────────────────────────────────────────── */

  async function handleDelete() {
    if (!deleteConfirm) return;
    try {
      const r = await adminApiFetch(`/api/admin/gamification/${deleteConfirm.type}/${deleteConfirm.id}`, { method: "DELETE" });
      if (!r.ok) { setToast({ kind: "err", text: t("error") }); return; }
      setToast({ kind: "ok", text: t("deleteOk") });
      setDeleteConfirm(null);
      void loadAll();
    } catch { setToast({ kind: "err", text: t("error") }); }
  }

  /* ── Render ──────────────────────────────────────────────────────────── */

  return (
    <div className="space-y-4">
      <AdminPageHeader title={t("title")} description={t("subtitle")} />

      {perms != null && !canWrite && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{t("readOnlyNotice")}</div>
      )}

      {toast && (
        <div className={`rounded-md border p-3 text-sm ${toast.kind === "ok" ? "border-green-300 bg-green-50 text-green-900" : "border-red-300 bg-red-50 text-red-900"}`} role="alert">
          {toast.text}
          <button className="ml-4 text-xs underline" onClick={() => setToast(null)} type="button">×</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {(["streaks", "achievements", "leaderboards"] as Tab[]).map((tb) => (
          <button
            key={tb}
            className={`px-4 py-2 text-sm font-medium ${tab === tb ? "border-b-2 border-indigo-600 text-indigo-700" : "text-slate-500 hover:text-slate-700"}`}
            onClick={() => setTab(tb)}
            type="button"
          >
            {t(tb)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-10 text-center text-sm text-slate-400">Loading…</div>
      ) : (
        <>
          {/* ── Streaks Tab ──────────────────────────────────────── */}
          {tab === "streaks" && (
            <AdminSection>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-700">{t("streaks")}</h3>
                {canWrite && (
                  <button className="rounded bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700" onClick={openStreakCreate} type="button">+ {t("create")}</button>
                )}
              </div>
              {streakConfigs.length === 0 ? (
                <AdminEmptyState title={t("empty")} />
              ) : (
                <AdminDataTable>
                  <AdminDataTableHead>
                    <AdminDataTableTh>{t("name")}</AdminDataTableTh>
                    <AdminDataTableTh>{t("activityType")}</AdminDataTableTh>
                    <AdminDataTableTh>{t("minActions")}</AdminDataTableTh>
                    <AdminDataTableTh>{t("freezesAllowed")}</AdminDataTableTh>
                    <AdminDataTableTh>{t("enabled")}</AdminDataTableTh>
                    {canWrite && <AdminDataTableTh />}
                  </AdminDataTableHead>
                  <AdminDataTableBody>
                    {streakConfigs.map((s) => (
                      <AdminDataTableRow key={s.id}>
                        <AdminDataTableTd>{s.name}</AdminDataTableTd>
                        <AdminDataTableTd>{s.activityType}</AdminDataTableTd>
                        <AdminDataTableTd>{s.minActions}</AdminDataTableTd>
                        <AdminDataTableTd>{s.freezesAllowed}</AdminDataTableTd>
                        <AdminDataTableTd>
                          <AdminStatusBadge tone={s.enabled ? "neutral" : "danger"}>{s.enabled ? t("enabled") : t("disabled")}</AdminStatusBadge>
                        </AdminDataTableTd>
                        {canWrite && (
                          <AdminDataTableTd>
                            <div className="flex gap-2">
                              <button className="text-xs text-indigo-600 hover:underline" onClick={() => openStreakEdit(s)} type="button">{t("edit")}</button>
                              <button className="text-xs text-red-600 hover:underline" onClick={() => setDeleteConfirm({ type: "streaks", id: s.id })} type="button">{t("delete")}</button>
                            </div>
                          </AdminDataTableTd>
                        )}
                      </AdminDataTableRow>
                    ))}
                  </AdminDataTableBody>
                </AdminDataTable>
              )}
            </AdminSection>
          )}

          {/* ── Achievements Tab ─────────────────────────────────── */}
          {tab === "achievements" && (
            <AdminSection>
              <h3 className="mb-3 text-sm font-semibold text-slate-700">{t("achievements")}</h3>
              {achievements.length === 0 ? (
                <AdminEmptyState title={t("empty")} />
              ) : (
                <AdminDataTable>
                  <AdminDataTableHead>
                    <AdminDataTableTh>{t("slug")}</AdminDataTableTh>
                    <AdminDataTableTh>{t("category")}</AdminDataTableTh>
                    <AdminDataTableTh>{t("metric")}</AdminDataTableTh>
                    <AdminDataTableTh>{t("tier")}</AdminDataTableTh>
                  </AdminDataTableHead>
                  <AdminDataTableBody>
                    {achievements.map((a) => (
                      <AdminDataTableRow key={a.id}>
                        <AdminDataTableTd className="font-mono text-xs">{a.slug}</AdminDataTableTd>
                        <AdminDataTableTd>{a.category}</AdminDataTableTd>
                        <AdminDataTableTd>{a.metric}</AdminDataTableTd>
                        <AdminDataTableTd>
                          <div className="flex gap-1">
                            {a.tiers.map((tr) => (
                              <span key={tr.id} className="rounded bg-slate-100 px-2 py-0.5 text-xs">
                                {tiers[tr.tier] ?? tr.tier}: {tr.threshold}
                              </span>
                            ))}
                          </div>
                        </AdminDataTableTd>
                      </AdminDataTableRow>
                    ))}
                  </AdminDataTableBody>
                </AdminDataTable>
              )}
            </AdminSection>
          )}

          {/* ── Leaderboards Tab ─────────────────────────────────── */}
          {tab === "leaderboards" && (
            <AdminSection>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-700">{t("leaderboards")}</h3>
                {canWrite && (
                  <button className="rounded bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700" onClick={openLbCreate} type="button">+ {t("create")}</button>
                )}
              </div>
              {leaderboards.length === 0 ? (
                <AdminEmptyState title={t("empty")} />
              ) : (
                <AdminDataTable>
                  <AdminDataTableHead>
                    <AdminDataTableTh>{t("name")}</AdminDataTableTh>
                    <AdminDataTableTh>{t("metricType")}</AdminDataTableTh>
                    <AdminDataTableTh>{t("period")}</AdminDataTableTh>
                    <AdminDataTableTh>{t("maxEntries")}</AdminDataTableTh>
                    <AdminDataTableTh>{t("enabled")}</AdminDataTableTh>
                    {canWrite && <AdminDataTableTh />}
                  </AdminDataTableHead>
                  <AdminDataTableBody>
                    {leaderboards.map((lb) => (
                      <AdminDataTableRow key={lb.id}>
                        <AdminDataTableTd>{lb.name}</AdminDataTableTd>
                        <AdminDataTableTd>{lb.metricType}</AdminDataTableTd>
                        <AdminDataTableTd>{lb.period}</AdminDataTableTd>
                        <AdminDataTableTd>{lb.maxEntries}</AdminDataTableTd>
                        <AdminDataTableTd>
                          <AdminStatusBadge tone={lb.enabled ? "neutral" : "danger"}>{lb.enabled ? t("enabled") : t("disabled")}</AdminStatusBadge>
                        </AdminDataTableTd>
                        {canWrite && (
                          <AdminDataTableTd>
                            <div className="flex gap-2">
                              <button className="text-xs text-indigo-600 hover:underline" onClick={() => openLbEdit(lb)} type="button">{t("edit")}</button>
                              <button className="text-xs text-red-600 hover:underline" onClick={() => setDeleteConfirm({ type: "leaderboards", id: lb.id })} type="button">{t("delete")}</button>
                            </div>
                          </AdminDataTableTd>
                        )}
                      </AdminDataTableRow>
                    ))}
                  </AdminDataTableBody>
                </AdminDataTable>
              )}
            </AdminSection>
          )}
        </>
      )}

      {/* ── Delete Confirm ───────────────────────────────────────── */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
            <p className="text-sm text-slate-700">{t("confirmDelete")}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button className="rounded border px-3 py-1.5 text-xs" onClick={() => setDeleteConfirm(null)} type="button">{t("cancel")}</button>
              <button className="rounded bg-red-600 px-3 py-1.5 text-xs text-white hover:bg-red-700" onClick={handleDelete} type="button">{t("delete")}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Streak Modal ─────────────────────────────────────────── */}
      {streakModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-sm font-semibold text-slate-800">{streakEditId ? t("edit") : t("create")}</h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">{t("name")}</label>
                <input className="w-full rounded border px-2 py-1.5 text-sm" value={streakForm.name} onChange={(e) => setStreakForm({ ...streakForm, name: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">{t("activityType")}</label>
                <input className="w-full rounded border px-2 py-1.5 text-sm" value={streakForm.activityType} onChange={(e) => setStreakForm({ ...streakForm, activityType: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">{t("minActions")}</label>
                  <input type="number" className="w-full rounded border px-2 py-1.5 text-sm" value={streakForm.minActions} onChange={(e) => setStreakForm({ ...streakForm, minActions: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">{t("freezesAllowed")}</label>
                  <input type="number" className="w-full rounded border px-2 py-1.5 text-sm" value={streakForm.freezesAllowed} onChange={(e) => setStreakForm({ ...streakForm, freezesAllowed: Number(e.target.value) })} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={streakForm.enabled} onChange={(e) => setStreakForm({ ...streakForm, enabled: e.target.checked })} id="streak-en" />
                <label htmlFor="streak-en" className="text-sm text-slate-700">{t("enabled")}</label>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button className="rounded border px-3 py-1.5 text-xs" onClick={() => setStreakModal(false)} type="button">{t("cancel")}</button>
              <button className="rounded bg-indigo-600 px-3 py-1.5 text-xs text-white hover:bg-indigo-700" onClick={saveStreak} type="button">{t("save")}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Leaderboard Modal ────────────────────────────────────── */}
      {lbModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-sm font-semibold text-slate-800">{lbEditId ? t("edit") : t("create")}</h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">{t("name")}</label>
                <input className="w-full rounded border px-2 py-1.5 text-sm" value={lbForm.name} onChange={(e) => setLbForm({ ...lbForm, name: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">{t("metricType")}</label>
                <input className="w-full rounded border px-2 py-1.5 text-sm" value={lbForm.metricType} onChange={(e) => setLbForm({ ...lbForm, metricType: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">{t("period")}</label>
                  <select className="w-full rounded border px-2 py-1.5 text-sm" value={lbForm.period} onChange={(e) => setLbForm({ ...lbForm, period: e.target.value })}>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="all_time">All Time</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">{t("maxEntries")}</label>
                  <input type="number" className="w-full rounded border px-2 py-1.5 text-sm" value={lbForm.maxEntries} onChange={(e) => setLbForm({ ...lbForm, maxEntries: Number(e.target.value) })} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={lbForm.enabled} onChange={(e) => setLbForm({ ...lbForm, enabled: e.target.checked })} id="lb-en" />
                <label htmlFor="lb-en" className="text-sm text-slate-700">{t("enabled")}</label>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button className="rounded border px-3 py-1.5 text-xs" onClick={() => setLbModal(false)} type="button">{t("cancel")}</button>
              <button className="rounded bg-indigo-600 px-3 py-1.5 text-xs text-white hover:bg-indigo-700" onClick={saveLb} type="button">{t("save")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
