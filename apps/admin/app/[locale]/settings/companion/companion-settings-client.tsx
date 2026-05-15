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
  AdminStatusBadge,
  AdminToastContainer,
  useAdminToast,
} from "@nihongo-bjt/ui";
import { useCallback, useEffect, useState } from "react";

import { adminApiFetch } from "@/lib/admin-api";
import { permsFromMe, type MePayload } from "@/app/_components/admin-client-utils";

type CommonLabels = { empty: string; error: string; loading: string; records: string };
type Labels = Record<string, string>;

type RiveAsset = { file: string; label: string };
type CompanionConfig = {
  availableRiveAssets: RiveAsset[];
  currentRiveAsset: string;
  proactiveTipIntervalMs: number;
  sleepTimeoutMs: number;
  tipCategories: string[];
  tipCount: number;
};

type CompanionTip = {
  id: string;
  category: string;
  contentJa: string;
  contentVi: string;
  exampleJa?: string;
  exampleVi?: string;
  active: boolean;
  sortOrder: number;
};

const CATEGORIES = ["grammar", "vocab", "keigo", "culture", "business"];

const emptyForm = {
  category: "grammar",
  contentJa: "",
  contentVi: "",
  exampleJa: "",
  exampleVi: "",
  sortOrder: 0,
  active: true,
};

export function CompanionSettingsClient({
  common,
  labels,
}: {
  common: CommonLabels;
  labels: Labels;
}) {
  const t = (k: string) => labels[k] ?? k;
  const toast = useAdminToast();
  const [perms, setPerms] = useState<Set<string> | null>(null);
  const canWrite = perms != null && (perms.has("admin.content.write") || perms.has("iam.manage"));
  const [config, setConfig] = useState<CompanionConfig | null>(null);
  const [tips, setTips] = useState<CompanionTip[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  /* CRUD state */
  const [editing, setEditing] = useState<CompanionTip | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [mutating, setMutating] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await adminApiFetch("/api/admin/me");
        if (!r.ok) { if (!cancelled) setPerms(new Set()); return; }
        const body = (await r.json()) as MePayload;
        if (!cancelled) setPerms(permsFromMe(body));
      } catch { if (!cancelled) setPerms(new Set()); }
    })();
    return () => { cancelled = true; };
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [configRes, tipsRes] = await Promise.all([
        adminApiFetch("/api/admin/companion/config"),
        adminApiFetch("/api/admin/companion/tips"),
      ]);
      if (!configRes.ok || !tipsRes.ok) { setError(common.error); return; }
      setConfig((await configRes.json()) as CompanionConfig);
      setTips((await tipsRes.json()) as CompanionTip[]);
    } catch { setError(common.error); }
    finally { setLoading(false); }
  }, [common.error]);

  useEffect(() => { void loadData(); }, [loadData]);

  /* ── Create ── */
  function openCreate() {
    setCreating(true);
    setEditing(null);
    setForm(emptyForm);
  }

  async function submitCreate() {
    if (!form.contentJa.trim() || !form.contentVi.trim()) {
      toast.error(t("validationRequired") === "validationRequired" ? "Japanese and Vietnamese content are required." : t("validationRequired"));
      return;
    }
    setMutating(true);
    try {
      const r = await adminApiFetch("/api/admin/companion/tips", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          category: form.category,
          contentJa: form.contentJa.trim(),
          contentVi: form.contentVi.trim(),
          ...(form.exampleJa.trim() ? { exampleJa: form.exampleJa.trim() } : {}),
          ...(form.exampleVi.trim() ? { exampleVi: form.exampleVi.trim() } : {}),
          sortOrder: form.sortOrder,
        }),
      });
      if (!r.ok) { toast.error(t("createFailed") === "createFailed" ? "Failed to create tip." : t("createFailed")); return; }
      toast.success(t("createOk") === "createOk" ? "Tip created." : t("createOk"));
      setCreating(false);
      void loadData();
    } finally { setMutating(false); }
  }

  /* ── Edit ── */
  function openEdit(tip: CompanionTip) {
    setEditing(tip);
    setCreating(false);
    setForm({
      category: tip.category,
      contentJa: tip.contentJa,
      contentVi: tip.contentVi,
      exampleJa: tip.exampleJa ?? "",
      exampleVi: tip.exampleVi ?? "",
      sortOrder: tip.sortOrder,
      active: tip.active,
    });
  }

  async function submitEdit() {
    if (!editing) return;
    if (!form.contentJa.trim() || !form.contentVi.trim()) {
      toast.error(t("validationRequired") === "validationRequired" ? "Japanese and Vietnamese content are required." : t("validationRequired"));
      return;
    }
    setMutating(true);
    try {
      const r = await adminApiFetch(`/api/admin/companion/tips/${editing.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          category: form.category,
          contentJa: form.contentJa.trim(),
          contentVi: form.contentVi.trim(),
          exampleJa: form.exampleJa.trim() || null,
          exampleVi: form.exampleVi.trim() || null,
          active: form.active,
          sortOrder: form.sortOrder,
        }),
      });
      if (!r.ok) { toast.error(t("updateFailed") === "updateFailed" ? "Failed to update tip." : t("updateFailed")); return; }
      toast.success(t("updateOk") === "updateOk" ? "Tip updated." : t("updateOk"));
      setEditing(null);
      void loadData();
    } finally { setMutating(false); }
  }

  /* ── Delete ── */
  async function submitDelete(id: string) {
    setMutating(true);
    try {
      const r = await adminApiFetch(`/api/admin/companion/tips/${id}`, { method: "DELETE" });
      if (!r.ok) { toast.error(t("deleteFailed") === "deleteFailed" ? "Failed to delete tip." : t("deleteFailed")); return; }
      toast.success(t("deleteOk") === "deleteOk" ? "Tip deleted." : t("deleteOk"));
      setDeleteConfirm(null);
      void loadData();
    } finally { setMutating(false); }
  }

  const filteredTips = tips?.filter(
    (tip) => categoryFilter === "all" || tip.category === categoryFilter
  );

  const isFormOpen = creating || editing != null;

  return (
    <>
      <AdminToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
      <AdminPageHeader
        title={t("title") === "title" ? "Companion Bot" : t("title")}
        description={t("subtitle") === "subtitle" ? "Manage the companion bot (Shiba) — Rive asset, tips, behavior." : t("subtitle")}
      />

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent/30 border-t-accent" />
        </div>
      ) : error ? (
        <AdminEmptyState title={common.error} />
      ) : (
        <div className="space-y-6">
          {/* ── Configuration overview ── */}
          <AdminSection title={t("configSection") === "configSection" ? "Configuration" : t("configSection")}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-xl border bg-white p-4 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wider text-muted">
                  {t("riveAsset") === "riveAsset" ? "Rive Asset" : t("riveAsset")}
                </p>
                <p className="mt-1 font-semibold text-ink">{config?.currentRiveAsset}</p>
                <p className="mt-0.5 text-xs text-muted">{config?.availableRiveAssets.length} available</p>
              </div>
              <div className="rounded-xl border bg-white p-4 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wider text-muted">
                  {t("tipCount") === "tipCount" ? "Tips" : t("tipCount")}
                </p>
                <p className="mt-1 font-semibold text-ink">{tips?.length ?? 0}</p>
                <p className="mt-0.5 text-xs text-muted">{config?.tipCategories.join(", ")}</p>
              </div>
              <div className="rounded-xl border bg-white p-4 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wider text-muted">
                  {t("behavior") === "behavior" ? "Behavior" : t("behavior")}
                </p>
                <p className="mt-1 text-sm text-ink">
                  Proactive tip: <span className="font-semibold">{(config?.proactiveTipIntervalMs ?? 0) / 1000}s</span>
                </p>
                <p className="mt-0.5 text-sm text-ink">
                  Sleep after: <span className="font-semibold">{(config?.sleepTimeoutMs ?? 0) / 1000}s</span>
                </p>
              </div>
            </div>
          </AdminSection>

          {/* ── Rive Assets ── */}
          <AdminSection title={t("riveAssets") === "riveAssets" ? "Available Rive Assets" : t("riveAssets")}>
            <AdminDataTable>
              <AdminDataTableHead>
                <AdminDataTableTh>File</AdminDataTableTh>
                <AdminDataTableTh>Label</AdminDataTableTh>
                <AdminDataTableTh>Status</AdminDataTableTh>
              </AdminDataTableHead>
              <AdminDataTableBody>
                {config?.availableRiveAssets.map((asset) => (
                  <AdminDataTableRow key={asset.file}>
                    <AdminDataTableTd><code className="text-xs">{asset.file}</code></AdminDataTableTd>
                    <AdminDataTableTd>{asset.label}</AdminDataTableTd>
                    <AdminDataTableTd>
                      <AdminStatusBadge tone={asset.file === config.currentRiveAsset ? "good" : "neutral"}>
                        {asset.file === config.currentRiveAsset ? "Active" : "Available"}
                      </AdminStatusBadge>
                    </AdminDataTableTd>
                  </AdminDataTableRow>
                ))}
              </AdminDataTableBody>
            </AdminDataTable>
          </AdminSection>

          {/* ── Tips CRUD ── */}
          <AdminSection
            title={t("tipsSection") === "tipsSection" ? "Companion Tips" : t("tipsSection")}
            actions={
              <div className="flex items-center gap-2">
                <select
                  className="rounded-lg border px-3 py-1.5 text-sm"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <option value="all">All categories</option>
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                {canWrite ? (
                  <button
                    className="rounded-lg bg-accent px-4 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-accent/90"
                    onClick={openCreate}
                    type="button"
                  >
                    + Add tip
                  </button>
                ) : null}
              </div>
            }
          >
            {/* ── Create / Edit Form ── */}
            {isFormOpen ? (
              <div className="mb-4 rounded-xl border bg-white p-5 shadow-sm">
                <h4 className="mb-3 font-semibold text-ink">
                  {creating ? "New Tip" : "Edit Tip"}
                </h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted">Category</label>
                    <select
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                      value={form.category}
                      onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted">Sort Order</label>
                    <input
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                      type="number"
                      min={0}
                      value={form.sortOrder}
                      onChange={(e) => setForm((f) => ({ ...f, sortOrder: Number(e.target.value) }))}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-muted">Japanese content *</label>
                    <textarea
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                      rows={2}
                      lang="ja"
                      value={form.contentJa}
                      onChange={(e) => setForm((f) => ({ ...f, contentJa: e.target.value }))}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-muted">Vietnamese content *</label>
                    <textarea
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                      rows={2}
                      value={form.contentVi}
                      onChange={(e) => setForm((f) => ({ ...f, contentVi: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted">Example (JA)</label>
                    <input
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                      lang="ja"
                      value={form.exampleJa}
                      onChange={(e) => setForm((f) => ({ ...f, exampleJa: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted">Example (VI)</label>
                    <input
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                      value={form.exampleVi}
                      onChange={(e) => setForm((f) => ({ ...f, exampleVi: e.target.value }))}
                    />
                  </div>
                  {editing ? (
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-medium text-muted">Active</label>
                      <input
                        type="checkbox"
                        checked={form.active}
                        onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                      />
                    </div>
                  ) : null}
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-accent/90 disabled:opacity-50"
                    disabled={mutating}
                    onClick={creating ? submitCreate : submitEdit}
                    type="button"
                  >
                    {mutating ? "..." : creating ? "Create" : "Save"}
                  </button>
                  <button
                    className="rounded-lg border px-4 py-2 text-sm text-muted hover:bg-gray-50"
                    onClick={() => { setCreating(false); setEditing(null); }}
                    type="button"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}

            {/* ── Tips Table ── */}
            {filteredTips && filteredTips.length > 0 ? (
              <AdminDataTable>
                <AdminDataTableHead>
                  <AdminDataTableTh>Category</AdminDataTableTh>
                  <AdminDataTableTh>Japanese</AdminDataTableTh>
                  <AdminDataTableTh>Vietnamese</AdminDataTableTh>
                  <AdminDataTableTh>Status</AdminDataTableTh>
                  {canWrite ? <AdminDataTableTh>Actions</AdminDataTableTh> : null}
                </AdminDataTableHead>
                <AdminDataTableBody>
                  {filteredTips.map((tip) => (
                    <AdminDataTableRow key={tip.id}>
                      <AdminDataTableTd>
                        <AdminStatusBadge tone="good">{tip.category}</AdminStatusBadge>
                        <span className="ml-1 text-[10px] text-muted">#{tip.sortOrder}</span>
                      </AdminDataTableTd>
                      <AdminDataTableTd>
                        <p className="max-w-xs text-sm leading-relaxed" lang="ja">{tip.contentJa}</p>
                        {tip.exampleJa ? (
                          <p className="mt-1 text-xs italic text-muted" lang="ja">例: {tip.exampleJa}</p>
                        ) : null}
                      </AdminDataTableTd>
                      <AdminDataTableTd>
                        <p className="max-w-xs text-sm leading-relaxed">{tip.contentVi}</p>
                        {tip.exampleVi ? (
                          <p className="mt-1 text-xs italic text-muted">VD: {tip.exampleVi}</p>
                        ) : null}
                      </AdminDataTableTd>
                      <AdminDataTableTd>
                        <AdminStatusBadge tone={tip.active ? "good" : "warning"}>
                          {tip.active ? "Active" : "Inactive"}
                        </AdminStatusBadge>
                      </AdminDataTableTd>
                      {canWrite ? (
                        <AdminDataTableTd>
                          <div className="flex gap-1">
                            <button
                              className="rounded px-2 py-1 text-xs font-medium text-accent hover:bg-accent/10"
                              onClick={() => openEdit(tip)}
                              type="button"
                            >
                              Edit
                            </button>
                            {deleteConfirm === tip.id ? (
                              <button
                                className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
                                disabled={mutating}
                                onClick={() => void submitDelete(tip.id)}
                                type="button"
                              >
                                Confirm
                              </button>
                            ) : (
                              <button
                                className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                                onClick={() => setDeleteConfirm(tip.id)}
                                type="button"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </AdminDataTableTd>
                      ) : null}
                    </AdminDataTableRow>
                  ))}
                </AdminDataTableBody>
              </AdminDataTable>
            ) : (
              <AdminEmptyState title={common.empty} />
            )}
          </AdminSection>
        </div>
      )}
    </>
  );
}
