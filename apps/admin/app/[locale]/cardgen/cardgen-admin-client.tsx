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

type GenRule = {
  id: string;
  name: string;
  mode: string;
  sourceType: string;
  filterLevel: string | null;
  direction: string;
  maxCards: number;
  enabled: boolean;
};

type GenJob = {
  id: string;
  ruleId: string | null;
  userId: string;
  status: string;
  cardsGenerated: number;
  triggeredBy: string;
  createdAt: string;
};

type Tab = "rules" | "jobs";

const MODES = ["by_level", "by_topic", "by_weak_area", "daily_auto"];
const SOURCES = ["lexeme", "grammar", "kanji"];
const DIRECTIONS = ["jp_to_vn", "vn_to_jp", "both"];

export function CardgenAdminClient({ labels }: { labels: Labels }) {
  const t = (k: string) => (labels[k] as string) ?? k;
  const modes = (labels.modes ?? {}) as Record<string, string>;
  const sources = (labels.sources ?? {}) as Record<string, string>;
  const directions = (labels.directions ?? {}) as Record<string, string>;

  const [perms, setPerms] = useState<Set<string> | null>(null);
  const canWrite = perms != null && (perms.has("content.manage") || perms.has("admin.content.write"));

  const [tab, setTab] = useState<Tab>("rules");
  const [rules, setRules] = useState<GenRule[]>([]);
  const [jobs, setJobs] = useState<GenJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // Rule form
  const [ruleModal, setRuleModal] = useState(false);
  const [ruleEditId, setRuleEditId] = useState<string | null>(null);
  const [ruleForm, setRuleForm] = useState({
    name: "",
    mode: "by_level",
    sourceType: "lexeme",
    filterLevel: "",
    direction: "both",
    maxCards: 20,
    enabled: true
  });

  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

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
      const [rRes, jRes] = await Promise.all([
        adminApiFetch("/api/admin/cardgen/rules"),
        adminApiFetch("/api/admin/cardgen/jobs")
      ]);
      if (rRes.ok) setRules((await rRes.json()) as GenRule[]);
      if (jRes.ok) setJobs((await jRes.json()) as GenJob[]);
    } catch { /* handled */ }
    setLoading(false);
  }, []);

  useEffect(() => { void loadAll(); }, [loadAll]);

  function openRuleCreate() {
    setRuleEditId(null);
    setRuleForm({ name: "", mode: "by_level", sourceType: "lexeme", filterLevel: "", direction: "both", maxCards: 20, enabled: true });
    setRuleModal(true);
  }

  function openRuleEdit(r: GenRule) {
    setRuleEditId(r.id);
    setRuleForm({ name: r.name, mode: r.mode, sourceType: r.sourceType, filterLevel: r.filterLevel ?? "", direction: r.direction, maxCards: r.maxCards, enabled: r.enabled });
    setRuleModal(true);
  }

  async function saveRule() {
    try {
      const url = ruleEditId ? `/api/admin/cardgen/rules/${ruleEditId}` : "/api/admin/cardgen/rules";
      const body = {
        name: ruleForm.name,
        sourceType: ruleForm.sourceType,
        direction: ruleForm.direction,
        enabled: ruleForm.enabled,
        ...(ruleForm.filterLevel ? { filterLevel: ruleForm.filterLevel } : {})
      };
      const r = await adminApiFetch(url, {
        method: ruleEditId ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!r.ok) { setToast({ kind: "err", text: t("error") }); return; }
      setToast({ kind: "ok", text: t("saveOk") });
      setRuleModal(false);
      void loadAll();
    } catch { setToast({ kind: "err", text: t("error") }); }
  }

  async function handleDelete(id: string) {
    try {
      const r = await adminApiFetch(`/api/admin/cardgen/rules/${id}`, { method: "DELETE" });
      if (!r.ok) { setToast({ kind: "err", text: t("error") }); return; }
      setToast({ kind: "ok", text: t("deleteOk") });
      setDeleteConfirm(null);
      void loadAll();
    } catch { setToast({ kind: "err", text: t("error") }); }
  }

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
        {(["rules", "jobs"] as Tab[]).map((tb) => (
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
          {/* ── Rules Tab ────────────────────────────────────────── */}
          {tab === "rules" && (
            <AdminSection>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-700">{t("rules")}</h3>
                {canWrite && (
                  <button className="rounded bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700" onClick={openRuleCreate} type="button">+ {t("create")}</button>
                )}
              </div>
              {rules.length === 0 ? (
                <AdminEmptyState title={t("empty")} />
              ) : (
                <AdminDataTable>
                  <AdminDataTableHead>
                    <AdminDataTableRow>
                      <AdminDataTableTh>{t("mode")}</AdminDataTableTh>
                      <AdminDataTableTh>{t("sourceType")}</AdminDataTableTh>
                      <AdminDataTableTh>{t("level")}</AdminDataTableTh>
                      <AdminDataTableTh>{t("direction")}</AdminDataTableTh>
                      <AdminDataTableTh>{t("maxCards")}</AdminDataTableTh>
                      <AdminDataTableTh>{t("enabled")}</AdminDataTableTh>
                      {canWrite && <AdminDataTableTh />}
                    </AdminDataTableRow>
                  </AdminDataTableHead>
                  <AdminDataTableBody>
                    {rules.map((rule) => (
                      <AdminDataTableRow key={rule.id}>
                        <AdminDataTableTd>{modes[rule.mode] ?? rule.mode}</AdminDataTableTd>
                        <AdminDataTableTd>{sources[rule.sourceType] ?? rule.sourceType}</AdminDataTableTd>
                        <AdminDataTableTd>{rule.filterLevel ?? "—"}</AdminDataTableTd>
                        <AdminDataTableTd>{directions[rule.direction] ?? rule.direction}</AdminDataTableTd>
                        <AdminDataTableTd>{rule.maxCards}</AdminDataTableTd>
                        <AdminDataTableTd>
                          <AdminStatusBadge tone={rule.enabled ? "neutral" : "danger"}>{rule.enabled ? t("enabled") : t("disabled")}</AdminStatusBadge>
                        </AdminDataTableTd>
                        {canWrite && (
                          <AdminDataTableTd>
                            <div className="flex gap-2">
                              <button className="text-xs text-indigo-600 hover:underline" onClick={() => openRuleEdit(rule)} type="button">{t("edit")}</button>
                              <button className="text-xs text-red-600 hover:underline" onClick={() => setDeleteConfirm(rule.id)} type="button">{t("delete")}</button>
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

          {/* ── Jobs Tab ─────────────────────────────────────────── */}
          {tab === "jobs" && (
            <AdminSection>
              <h3 className="mb-3 text-sm font-semibold text-slate-700">{t("jobs")}</h3>
              {jobs.length === 0 ? (
                <AdminEmptyState title={t("emptyJobs")} />
              ) : (
                <AdminDataTable>
                  <AdminDataTableHead>
                    <AdminDataTableRow>
                      <AdminDataTableTh>{t("status")}</AdminDataTableTh>
                      <AdminDataTableTh>{t("cardsGenerated")}</AdminDataTableTh>
                      <AdminDataTableTh>{t("triggeredBy")}</AdminDataTableTh>
                      <AdminDataTableTh>{t("createdAt")}</AdminDataTableTh>
                    </AdminDataTableRow>
                  </AdminDataTableHead>
                  <AdminDataTableBody>
                    {jobs.map((job) => (
                      <AdminDataTableRow key={job.id}>
                        <AdminDataTableTd>
                          <AdminStatusBadge
                            tone={
                              job.status === "completed"
                                ? "neutral"
                                : job.status === "failed"
                                  ? "danger"
                                  : "warning"
                            }
                          >
                            {job.status}
                          </AdminStatusBadge>
                        </AdminDataTableTd>
                        <AdminDataTableTd>{job.cardsGenerated}</AdminDataTableTd>
                        <AdminDataTableTd>{job.triggeredBy}</AdminDataTableTd>
                        <AdminDataTableTd>{new Date(job.createdAt).toLocaleString()}</AdminDataTableTd>
                      </AdminDataTableRow>
                    ))}
                  </AdminDataTableBody>
                </AdminDataTable>
              )}
            </AdminSection>
          )}
        </>
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
            <p className="text-sm text-slate-700">{t("confirmDelete")}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button className="rounded border px-3 py-1.5 text-xs" onClick={() => setDeleteConfirm(null)} type="button">{t("cancel")}</button>
              <button className="rounded bg-red-600 px-3 py-1.5 text-xs text-white hover:bg-red-700" onClick={() => handleDelete(deleteConfirm)} type="button">{t("delete")}</button>
            </div>
          </div>
        </div>
      )}

      {/* Rule modal */}
      {ruleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-sm font-semibold text-slate-800">{ruleEditId ? t("edit") : t("create")}</h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">{t("name")}</label>
                <input type="text" className="w-full rounded border px-2 py-1.5 text-sm" value={ruleForm.name} onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">{t("mode")}</label>
                <select className="w-full rounded border px-2 py-1.5 text-sm" value={ruleForm.mode} onChange={(e) => setRuleForm({ ...ruleForm, mode: e.target.value })}>
                  {MODES.map((m) => <option key={m} value={m}>{modes[m] ?? m}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">{t("sourceType")}</label>
                <select className="w-full rounded border px-2 py-1.5 text-sm" value={ruleForm.sourceType} onChange={(e) => setRuleForm({ ...ruleForm, sourceType: e.target.value })}>
                  {SOURCES.map((s) => <option key={s} value={s}>{sources[s] ?? s}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">{t("level")}</label>
                <select className="w-full rounded border px-2 py-1.5 text-sm" value={ruleForm.filterLevel} onChange={(e) => setRuleForm({ ...ruleForm, filterLevel: e.target.value })}>
                  <option value="">—</option>
                  {["N5", "N4", "N3", "N2", "N1"].map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">{t("direction")}</label>
                <select className="w-full rounded border px-2 py-1.5 text-sm" value={ruleForm.direction} onChange={(e) => setRuleForm({ ...ruleForm, direction: e.target.value })}>
                  {DIRECTIONS.map((d) => <option key={d} value={d}>{directions[d] ?? d}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">{t("maxCards")}</label>
                <input type="number" className="w-full rounded border px-2 py-1.5 text-sm" value={ruleForm.maxCards} onChange={(e) => setRuleForm({ ...ruleForm, maxCards: Number(e.target.value) })} />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={ruleForm.enabled} onChange={(e) => setRuleForm({ ...ruleForm, enabled: e.target.checked })} id="rule-en" />
                <label htmlFor="rule-en" className="text-sm text-slate-700">{t("enabled")}</label>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button className="rounded border px-3 py-1.5 text-xs" onClick={() => setRuleModal(false)} type="button">{t("cancel")}</button>
              <button className="rounded bg-indigo-600 px-3 py-1.5 text-xs text-white hover:bg-indigo-700" onClick={saveRule} type="button">{t("save")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
