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

type ExerciseConfig = {
  id: string;
  exerciseType: string;
  placement: string;
  enabled: boolean;
  sortOrder: number;
  level: string | null;
  updatedAt: string;
};

type FormData = {
  exerciseType: string;
  placement: string;
  enabled: boolean;
  sortOrder: number;
  level: string;
};

const TYPES = ["meaning_match", "cloze", "word_order", "translation", "listening"];
const PLACEMENTS = ["practice_tab", "post_review", "daily_hub"];

export function ExercisesAdminClient({ labels }: { labels: Labels }) {
  const t = (k: string) => (labels[k] as string) ?? k;
  const types = (labels.types ?? {}) as Record<string, string>;
  const placements = (labels.placements ?? {}) as Record<string, string>;

  const [perms, setPerms] = useState<Set<string> | null>(null);
  const canWrite = perms != null && (perms.has("content.manage") || perms.has("admin.content.write"));

  const [items, setItems] = useState<ExerciseConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>({
    exerciseType: "meaning_match",
    placement: "practice_tab",
    enabled: true,
    sortOrder: 0,
    level: ""
  });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const r = await adminApiFetch("/api/admin/me");
        if (r.ok) {
          const body = (await r.json()) as MePayload;
          setPerms(permsFromMe(body));
        } else {
          setPerms(new Set());
        }
      } catch {
        setPerms(new Set());
      }
    })();
  }, []);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const r = await adminApiFetch("/api/admin/exercises/config");
      if (!r.ok) { setError(t("error")); return; }
      setItems((await r.json()) as ExerciseConfig[]);
      setError(null);
    } catch {
      setError(t("error"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadList(); }, [loadList]);

  function openCreate() {
    setEditId(null);
    setForm({ exerciseType: "meaning_match", placement: "practice_tab", enabled: true, sortOrder: 0, level: "" });
    setModalOpen(true);
  }

  function openEdit(cfg: ExerciseConfig) {
    setEditId(cfg.id);
    setForm({
      exerciseType: cfg.exerciseType,
      placement: cfg.placement,
      enabled: cfg.enabled,
      sortOrder: cfg.sortOrder,
      level: cfg.level ?? ""
    });
    setModalOpen(true);
  }

  async function handleSave() {
    try {
      const body = {
        exerciseType: form.exerciseType,
        placement: form.placement,
        enabled: form.enabled,
        sortOrder: form.sortOrder,
        ...(form.level ? { level: form.level } : {})
      };
      const r = await adminApiFetch("/api/admin/exercises/config", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!r.ok) { setToast({ kind: "err", text: t("error") }); return; }
      setToast({ kind: "ok", text: t("saveOk") });
      setModalOpen(false);
      void loadList();
    } catch {
      setToast({ kind: "err", text: t("error") });
    }
  }

  async function handleDelete(id: string) {
    try {
      const r = await adminApiFetch(`/api/admin/exercises/config/${id}`, { method: "DELETE" });
      if (!r.ok) { setToast({ kind: "err", text: t("error") }); return; }
      setToast({ kind: "ok", text: t("deleteOk") });
      setDeleteConfirm(null);
      void loadList();
    } catch {
      setToast({ kind: "err", text: t("error") });
    }
  }

  return (
    <div className="space-y-4">
      <AdminPageHeader title={t("title")} description={t("subtitle")} />

      {perms != null && !canWrite && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          {t("readOnlyNotice")}
        </div>
      )}

      {toast && (
        <div
          className={`rounded-md border p-3 text-sm ${toast.kind === "ok" ? "border-green-300 bg-green-50 text-green-900" : "border-red-300 bg-red-50 text-red-900"}`}
          role="alert"
        >
          {toast.text}
          <button className="ml-4 text-xs underline" onClick={() => setToast(null)} type="button">×</button>
        </div>
      )}

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900" role="alert">
          {error}
        </div>
      )}

      <AdminSection>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">{t("configList")}</h3>
          {canWrite && (
            <button
              className="rounded bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
              onClick={openCreate}
              type="button"
            >
              + {t("create")}
            </button>
          )}
        </div>

        {loading ? (
          <div className="py-10 text-center text-sm text-slate-400">Loading…</div>
        ) : items.length === 0 ? (
          <AdminEmptyState title={t("empty")} />
        ) : (
          <AdminDataTable>
            <AdminDataTableHead>
              <AdminDataTableTh>{t("exerciseType")}</AdminDataTableTh>
              <AdminDataTableTh>{t("placement")}</AdminDataTableTh>
              <AdminDataTableTh>{t("sortOrder")}</AdminDataTableTh>
              <AdminDataTableTh>{t("level")}</AdminDataTableTh>
              <AdminDataTableTh>{t("enabled")}</AdminDataTableTh>
              <AdminDataTableTh>{t("updatedAt")}</AdminDataTableTh>
              {canWrite && <AdminDataTableTh />}
            </AdminDataTableHead>
            <AdminDataTableBody>
              {items.map((cfg) => (
                <AdminDataTableRow key={cfg.id}>
                  <AdminDataTableTd>{types[cfg.exerciseType] ?? cfg.exerciseType}</AdminDataTableTd>
                  <AdminDataTableTd>{placements[cfg.placement] ?? cfg.placement}</AdminDataTableTd>
                  <AdminDataTableTd>{cfg.sortOrder}</AdminDataTableTd>
                  <AdminDataTableTd>{cfg.level ?? "—"}</AdminDataTableTd>
                  <AdminDataTableTd>
                    <AdminStatusBadge tone={cfg.enabled ? "neutral" : "danger"}>
                      {cfg.enabled ? t("enabled") : t("disabled")}
                    </AdminStatusBadge>
                  </AdminDataTableTd>
                  <AdminDataTableTd>{new Date(cfg.updatedAt).toLocaleDateString()}</AdminDataTableTd>
                  {canWrite && (
                    <AdminDataTableTd>
                      <div className="flex gap-2">
                        <button className="text-xs text-indigo-600 hover:underline" onClick={() => openEdit(cfg)} type="button">{t("edit")}</button>
                        <button className="text-xs text-red-600 hover:underline" onClick={() => setDeleteConfirm(cfg.id)} type="button">{t("delete")}</button>
                      </div>
                    </AdminDataTableTd>
                  )}
                </AdminDataTableRow>
              ))}
            </AdminDataTableBody>
          </AdminDataTable>
        )}
      </AdminSection>

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

      {/* Create/Edit modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-sm font-semibold text-slate-800">{editId ? t("edit") : t("create")}</h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">{t("exerciseType")}</label>
                <select className="w-full rounded border px-2 py-1.5 text-sm" value={form.exerciseType} onChange={(e) => setForm({ ...form, exerciseType: e.target.value })}>
                  {TYPES.map((tp) => <option key={tp} value={tp}>{types[tp] ?? tp}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">{t("placement")}</label>
                <select className="w-full rounded border px-2 py-1.5 text-sm" value={form.placement} onChange={(e) => setForm({ ...form, placement: e.target.value })}>
                  {PLACEMENTS.map((p) => <option key={p} value={p}>{placements[p] ?? p}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">{t("sortOrder")}</label>
                <input type="number" className="w-full rounded border px-2 py-1.5 text-sm" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">{t("level")}</label>
                <select className="w-full rounded border px-2 py-1.5 text-sm" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}>
                  <option value="">—</option>
                  {["N5", "N4", "N3", "N2", "N1"].map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} id="cfg-enabled" />
                <label htmlFor="cfg-enabled" className="text-sm text-slate-700">{t("enabled")}</label>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button className="rounded border px-3 py-1.5 text-xs" onClick={() => setModalOpen(false)} type="button">{t("cancel")}</button>
              <button className="rounded bg-indigo-600 px-3 py-1.5 text-xs text-white hover:bg-indigo-700" onClick={handleSave} type="button">{t("save")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
