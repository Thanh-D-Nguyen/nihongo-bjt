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
  cn,
  useAdminToast
} from "@nihongo-bjt/ui";
import { useCallback, useEffect, useState } from "react";

import { adminApiFetch } from "@/lib/admin-api";
import { loadAdminPermissions } from "@/app/_components/admin-client-utils";

type CommonLabels = { empty: string; error: string; loading: string; records: string };
type Labels = Record<string, string>;

interface FlashcardStyle {
  id: string;
  slug: string;
  nameKey: string;
  descriptionKey: string | null;
  thumbnailUrl: string | null;
  config: Record<string, string>;
  tier: string;
  sortOrder: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface AdoptionStat {
  slug: string;
  userCount: number;
}

type FormData = {
  slug: string;
  nameKey: string;
  descriptionKey: string;
  thumbnailUrl: string;
  tier: string;
  sortOrder: number;
  status: string;
  config: string; // JSON string for editing
};

const EMPTY_FORM: FormData = {
  slug: "",
  nameKey: "",
  descriptionKey: "",
  thumbnailUrl: "",
  tier: "free",
  sortOrder: 0,
  status: "draft",
  config: JSON.stringify(
    {
      cardBg: "#ffffff",
      textColor: "#1a1a2e",
      fontFamily: "'Noto Sans JP', sans-serif",
      borderRadius: "16px",
      flipAnimation: "rotateY",
      accentColor: "#6366f1",
      shadow: "0 4px 24px rgba(0,0,0,0.08)"
    },
    null,
    2
  )
};

function tierBadge(tier: string) {
  const colors: Record<string, string> = {
    free: "bg-emerald-100 text-emerald-800",
    premium: "bg-amber-100 text-amber-800",
    exclusive: "bg-purple-100 text-purple-800"
  };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", colors[tier] ?? "bg-gray-100 text-gray-800")}>
      {tier}
    </span>
  );
}

function statusTone(status: string): "neutral" | "warning" | "danger" {
  if (status === "active") return "neutral";
  if (status === "draft") return "warning";
  return "danger";
}

function StylePreview({ config }: { config: Record<string, string> }) {
  return (
    <div
      className="w-16 h-10 rounded border flex items-center justify-center text-[8px] font-bold overflow-hidden"
      style={{
        background: config.cardBg ?? "#fff",
        color: config.textColor ?? "#000",
        borderRadius: config.borderRadius ?? "8px",
        boxShadow: config.shadow ?? "none",
        fontFamily: config.fontFamily ?? "sans-serif"
      }}
    >
      あ
    </div>
  );
}

export function FlashcardStylesAdminClient({
  common,
  labels
}: {
  common: CommonLabels;
  labels: Labels;
}) {
  const t = (k: string) => labels[k] ?? k;
  const [perms, setPerms] = useState<Set<string> | null>(null);
  const canWrite = perms != null && (perms.has("admin.content.write") || perms.has("admin_core"));

  const [list, setList] = useState<FlashcardStyle[]>([]);
  const [adoption, setAdoption] = useState<AdoptionStat[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [tierFilter, setTierFilter] = useState<string>("all");

  // Editor state
  const [editing, setEditing] = useState<FlashcardStyle | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Confirm dialog
  const [confirmAction, setConfirmAction] = useState<{ id: string; status: string; slug: string } | null>(null);

  const toast = useAdminToast();

  // ── Load perms ──────────────────────────────────
  useEffect(() => {
    loadAdminPermissions().then((p) => setPerms(p));
  }, []);

  // ── Fetch data ──────────────────────────────────
  const fetchList = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (tierFilter !== "all") params.set("tier", tierFilter);
      const res = await adminApiFetch(`/api/admin/flashcards/styles?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setList(Array.isArray(data) ? data : data.items ?? []);
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, tierFilter]);

  const fetchAdoption = useCallback(async () => {
    try {
      const res = await adminApiFetch("/api/admin/flashcards/styles/analytics/adoption");
      if (res.ok) setAdoption(await res.json());
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    fetchList();
    fetchAdoption();
  }, [fetchList, fetchAdoption]);

  // ── Handlers ────────────────────────────────────
  function openCreate() {
    setEditing(null);
    setCreating(true);
    setForm(EMPTY_FORM);
    setFormError(null);
  }

  function openEdit(style: FlashcardStyle) {
    setCreating(false);
    setEditing(style);
    setForm({
      slug: style.slug,
      nameKey: style.nameKey,
      descriptionKey: style.descriptionKey ?? "",
      thumbnailUrl: style.thumbnailUrl ?? "",
      tier: style.tier,
      sortOrder: style.sortOrder,
      status: style.status,
      config: JSON.stringify(style.config, null, 2)
    });
    setFormError(null);
  }

  function closeEditor() {
    setEditing(null);
    setCreating(false);
    setFormError(null);
  }

  async function handleSave() {
    setSaving(true);
    setFormError(null);
    try {
      let parsedConfig: Record<string, unknown>;
      try {
        parsedConfig = JSON.parse(form.config);
      } catch {
        setFormError("Invalid JSON in config");
        setSaving(false);
        return;
      }

      const payload = {
        slug: form.slug.trim(),
        nameKey: form.nameKey.trim(),
        descriptionKey: form.descriptionKey.trim() || null,
        thumbnailUrl: form.thumbnailUrl.trim() || null,
        tier: form.tier,
        sortOrder: form.sortOrder,
        status: form.status,
        config: parsedConfig
      };

      if (!payload.slug || !payload.nameKey) {
        setFormError("slug and nameKey are required");
        setSaving(false);
        return;
      }

      if (creating) {
        const res = await adminApiFetch("/api/admin/flashcards/styles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message ?? `HTTP ${res.status}`);
        }
        toast.success("Style created");
      } else if (editing) {
        const res = await adminApiFetch(`/api/admin/flashcards/styles/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message ?? `HTTP ${res.status}`);
        }
        toast.success("Style updated");
      }

      closeEditor();
      fetchList();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function requestTransition(id: string, newStatus: string, slug: string) {
    setConfirmAction({ id, status: newStatus, slug });
  }

  async function handleTransition(id: string, newStatus: string) {
    try {
      const res = await adminApiFetch(`/api/admin/flashcards/styles/${id}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? `HTTP ${res.status}`);
      }
      toast.success(`Status → ${newStatus}`);
      fetchList();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Transition failed");
    } finally {
      setConfirmAction(null);
    }
  }

  function getAdoption(slug: string) {
    return adoption.find((a) => a.slug === slug)?.userCount ?? 0;
  }

  // ── Render ──────────────────────────────────────
  const showEditor = creating || editing != null;

  return (
    <div className="space-y-6">
      <AdminToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
      <AdminPageHeader
        title="Flashcard Styles"
        description="Manage visual styles for learner flashcards (free / premium / exclusive)"
        actions={
          canWrite ? (
            <button
              onClick={openCreate}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
            >
              + New Style
            </button>
          ) : undefined
        }
      />

      {/* ── Filters ────────────────────────── */}
      <div className="flex flex-wrap gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800"
        >
          <option value="all">All status</option>
          <option value="draft">Draft</option>
          <option value="active">Active</option>
          <option value="archived">Archived</option>
        </select>
        <select
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800"
        >
          <option value="all">All tiers</option>
          <option value="free">Free</option>
          <option value="premium">Premium</option>
          <option value="exclusive">Exclusive</option>
        </select>
        <button
          onClick={() => { fetchList(); fetchAdoption(); }}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
        >
          ↻ Refresh
        </button>
      </div>

      {/* ── List ───────────────────────────── */}
      {listError && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
          {common.error}: {listError}
        </div>
      )}

      {loading ? (
        <AdminSection>
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-3 py-3 animate-pulse">
                <div className="h-10 w-16 rounded-lg bg-gray-200 dark:bg-gray-700" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 rounded bg-gray-200 dark:bg-gray-700" />
                  <div className="h-3 w-20 rounded bg-gray-100 dark:bg-gray-800" />
                </div>
                <div className="h-5 w-16 rounded-full bg-gray-200 dark:bg-gray-700" />
                <div className="h-5 w-14 rounded-full bg-gray-200 dark:bg-gray-700" />
              </div>
            ))}
          </div>
        </AdminSection>
      ) : list.length === 0 ? (
        <AdminEmptyState title="No flashcard styles found" />
      ) : (
        <AdminSection>
          <AdminDataTable>
            <AdminDataTableHead>
              <AdminDataTableRow>
                <AdminDataTableTh>Preview</AdminDataTableTh>
                <AdminDataTableTh>Slug</AdminDataTableTh>
                <AdminDataTableTh>Tier</AdminDataTableTh>
                <AdminDataTableTh>Status</AdminDataTableTh>
                <AdminDataTableTh>Order</AdminDataTableTh>
                <AdminDataTableTh>Users</AdminDataTableTh>
                <AdminDataTableTh>Actions</AdminDataTableTh>
              </AdminDataTableRow>
            </AdminDataTableHead>
            <AdminDataTableBody>
              {list.map((style) => (
                <AdminDataTableRow key={style.id}>
                  <AdminDataTableTd>
                    <StylePreview config={style.config} />
                  </AdminDataTableTd>
                  <AdminDataTableTd>
                    <span className="font-mono text-sm">{style.slug}</span>
                    <div className="text-xs text-gray-500">{style.nameKey}</div>
                  </AdminDataTableTd>
                  <AdminDataTableTd>{tierBadge(style.tier)}</AdminDataTableTd>
                  <AdminDataTableTd>
                    <AdminStatusBadge tone={statusTone(style.status)}>{style.status}</AdminStatusBadge>
                  </AdminDataTableTd>
                  <AdminDataTableTd>{style.sortOrder}</AdminDataTableTd>
                  <AdminDataTableTd>
                    <span className="text-sm font-medium">{getAdoption(style.slug)}</span>
                  </AdminDataTableTd>
                  <AdminDataTableTd>
                    <div className="flex gap-2">
                      {canWrite && (
                        <>
                          <button
                            onClick={() => openEdit(style)}
                            className="text-sm text-indigo-600 hover:underline dark:text-indigo-400"
                          >
                            Edit
                          </button>
                          {style.status === "draft" && (
                            <button
                              onClick={() => requestTransition(style.id, "active", style.slug)}
                              className="text-sm text-green-600 hover:underline dark:text-green-400"
                            >
                              Activate
                            </button>
                          )}
                          {style.status === "active" && (
                            <button
                              onClick={() => requestTransition(style.id, "archived", style.slug)}
                              className="text-sm text-red-600 hover:underline dark:text-red-400"
                            >
                              Archive
                            </button>
                          )}
                          {style.status === "archived" && (
                            <button
                              onClick={() => requestTransition(style.id, "draft", style.slug)}
                              className="text-sm text-amber-600 hover:underline dark:text-amber-400"
                            >
                              Restore
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </AdminDataTableTd>
                </AdminDataTableRow>
              ))}
            </AdminDataTableBody>
          </AdminDataTable>
        </AdminSection>
      )}

      {/* ── Confirm Dialog ──────────────────── */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-[fadeIn_150ms_ease-out]">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900 animate-[scaleIn_200ms_ease-out]">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Confirm status change
            </h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Change <span className="font-mono font-bold">{confirmAction.slug}</span> to{" "}
              <span className="font-bold">{confirmAction.status}</span>?
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setConfirmAction(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={() => handleTransition(confirmAction.id, confirmAction.status)}
                className={cn(
                  "rounded-lg px-4 py-2 text-sm font-medium text-white",
                  confirmAction.status === "archived"
                    ? "bg-red-600 hover:bg-red-700"
                    : confirmAction.status === "active"
                      ? "bg-green-600 hover:bg-green-700"
                      : "bg-amber-600 hover:bg-amber-700"
                )}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Editor Modal ───────────────────── */}
      {showEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-[fadeIn_150ms_ease-out]">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900 max-h-[90vh] overflow-y-auto animate-[scaleIn_200ms_ease-out]">
            <h2 className="text-lg font-semibold mb-4">
              {creating ? "Create New Style" : `Edit: ${editing?.slug}`}
            </h2>

            {formError && (
              <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Slug</label>
                <input
                  className="w-full rounded-md border px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-600"
                  value={form.slug}
                  onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                  placeholder="e.g. sakura-bloom"
                  disabled={!creating}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Name Key (i18n)</label>
                <input
                  className="w-full rounded-md border px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-600"
                  value={form.nameKey}
                  onChange={(e) => setForm((f) => ({ ...f, nameKey: e.target.value }))}
                  placeholder="flashcard_style.my_style"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description Key</label>
                <input
                  className="w-full rounded-md border px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-600"
                  value={form.descriptionKey}
                  onChange={(e) => setForm((f) => ({ ...f, descriptionKey: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Thumbnail URL</label>
                <input
                  className="w-full rounded-md border px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-600"
                  value={form.thumbnailUrl}
                  onChange={(e) => setForm((f) => ({ ...f, thumbnailUrl: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Tier</label>
                <select
                  className="w-full rounded-md border px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-600"
                  value={form.tier}
                  onChange={(e) => setForm((f) => ({ ...f, tier: e.target.value }))}
                >
                  <option value="free">Free</option>
                  <option value="premium">Premium</option>
                  <option value="exclusive">Exclusive</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Sort Order</label>
                <input
                  type="number"
                  className="w-full rounded-md border px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-600"
                  value={form.sortOrder}
                  onChange={(e) => setForm((f) => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Status</label>
                <select
                  className="w-full rounded-md border px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-600"
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            </div>

            {/* Config JSON editor with live preview */}
            <div className="mt-4">
              <label className="block text-sm font-medium mb-1">
                Config (JSON) — cardBg, textColor, fontFamily, borderRadius, flipAnimation, accentColor, shadow
              </label>
              <textarea
                className="w-full h-40 rounded-md border px-3 py-2 text-sm font-mono dark:bg-gray-800 dark:border-gray-600"
                value={form.config}
                onChange={(e) => setForm((f) => ({ ...f, config: e.target.value }))}
              />
            </div>

            {/* Live Preview */}
            <div className="mt-4">
              <label className="block text-sm font-medium mb-2">Preview</label>
              <div className="flex justify-center p-6 bg-gray-100 rounded-lg dark:bg-gray-800">
                <StylePreviewLarge config={form.config} />
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={closeEditor}
                className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : creating ? "Create" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Large style preview card with front/back simulation */
function StylePreviewLarge({ config: configJson }: { config: string }) {
  let parsed: Record<string, string> = {};
  try {
    parsed = JSON.parse(configJson);
  } catch {
    return <div className="text-red-500 text-sm">Invalid JSON</div>;
  }

  return (
    <div
      className="w-64 h-40 flex flex-col items-center justify-center gap-2 transition-all"
      style={{
        background: parsed.cardBg ?? "#fff",
        color: parsed.textColor ?? "#000",
        borderRadius: parsed.borderRadius ?? "12px",
        boxShadow: parsed.shadow ?? "0 4px 12px rgba(0,0,0,0.1)",
        fontFamily: parsed.fontFamily ?? "sans-serif"
      }}
    >
      <span className="text-3xl font-bold">勉強</span>
      <span className="text-sm opacity-70">べんきょう</span>
      <span className="text-xs opacity-50">study / học tập</span>
      {parsed.accentColor && (
        <div
          className="w-8 h-1 rounded-full mt-1"
          style={{ background: parsed.accentColor }}
        />
      )}
    </div>
  );
}
