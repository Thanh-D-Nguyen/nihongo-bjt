"use client";

import {
  DEFAULT_FLASHCARD_THEME,
  flashcardThemeConfigSchema,
  validateFlashcardTheme,
  type FlashcardThemeConfig
} from "@nihongo-bjt/shared";
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
  config: Record<string, unknown>;
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
  config: JSON.stringify(DEFAULT_FLASHCARD_THEME.config, null, 2)
};

function tierBadge(tier: string, label: string) {
  const colors: Record<string, string> = {
    free: "bg-emerald-100 text-emerald-800",
    premium: "bg-amber-100 text-amber-800",
    exclusive: "bg-purple-100 text-purple-800"
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        colors[tier] ?? "bg-gray-100 text-gray-800"
      )}
    >
      {label}
    </span>
  );
}

function statusTone(status: string): "neutral" | "warning" | "danger" {
  if (status === "active") return "neutral";
  if (status === "draft") return "warning";
  return "danger";
}

function StylePreview({ config, invalidLabel }: { config: Record<string, unknown>; invalidLabel: string }) {
  const parsed = flashcardThemeConfigSchema.safeParse(config);
  if (!parsed.success) {
    return <span className="text-xs font-bold text-red-600">{invalidLabel}</span>;
  }
  const theme = parsed.data;
  return (
    <div
      className="flex h-10 w-16 items-center justify-center overflow-hidden rounded border p-1 text-[8px] font-bold"
      style={{
        background: theme.background,
        borderColor: theme.border,
        borderRadius: theme.borderRadius,
        boxShadow: theme.shadow,
        color: theme.foreground,
        fontFamily: theme.fontFamily
      }}
    >
      <span style={{ background: theme.contentSurface, color: theme.foreground }}>あ</span>
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
  const [transitioning, setTransitioning] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Confirm dialog
  const [confirmAction, setConfirmAction] = useState<{
    id: string;
    status: string;
    slug: string;
  } | null>(null);

  const toast = useAdminToast();
  const label = (key: string) => labels[key] ?? key;

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
      setList(Array.isArray(data) ? data : (data.items ?? []));
    } catch {
      setListError(labels.loadFailed ?? "loadFailed");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, tierFilter, labels]);

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
        setFormError(label("invalidJson"));
        setSaving(false);
        return;
      }
      const validation = validateFlashcardTheme(form.slug.trim() || "new-theme", parsedConfig);
      if (!validation.success) {
        setFormError(label("invalidConfig"));
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
        setFormError(label("required"));
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
          throw new Error(label("saveFailed"));
        }
        toast.success(label("created"));
      } else if (editing) {
        const res = await adminApiFetch(`/api/admin/flashcards/styles/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (!res.ok) {
          throw new Error(label("saveFailed"));
        }
        toast.success(label("updated"));
      }

      closeEditor();
      fetchList();
    } catch {
      setFormError(label("saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  function requestTransition(id: string, newStatus: string, slug: string) {
    setConfirmAction({ id, status: newStatus, slug });
  }

  async function handleTransition(id: string, newStatus: string) {
    setTransitioning(true);
    try {
      const res = await adminApiFetch(`/api/admin/flashcards/styles/${id}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus })
      });
      if (!res.ok) {
        throw new Error(label("transitionFailed"));
      }
      toast.success(label("transitionSuccess"));
      fetchList();
    } catch {
      toast.error(label("transitionFailed"));
    } finally {
      setConfirmAction(null);
      setTransitioning(false);
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
        title={label("title")}
        description={label("desc")}
        actions={
          canWrite ? (
            <button
              onClick={openCreate}
              className="min-h-11 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
            >
              + {label("create")}
            </button>
          ) : undefined
        }
      />

      {/* ── Filters ────────────────────────── */}
      <div className="flex flex-wrap gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label={label("statusFilter")}
          className="min-h-11 max-w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800"
        >
          <option value="all">{label("allStatuses")}</option>
          <option value="draft">{label("draft")}</option>
          <option value="active">{label("active")}</option>
          <option value="archived">{label("archived")}</option>
        </select>
        <select
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value)}
          aria-label={label("tierFilter")}
          className="min-h-11 max-w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800"
        >
          <option value="all">{label("allTiers")}</option>
          <option value="free">{label("free")}</option>
          <option value="premium">{label("premium")}</option>
          <option value="exclusive">{label("exclusive")}</option>
        </select>
        <button
          onClick={() => {
            fetchList();
            fetchAdoption();
          }}
          className="min-h-11 rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
        >
          ↻ {label("refresh")}
        </button>
      </div>

      {/* ── List ───────────────────────────── */}
      {listError && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
          <span>{common.error}: {listError}</span>
          <button onClick={fetchList} className="min-h-11 rounded-md border border-current px-3 py-1.5 font-medium">{label("retry")}</button>
        </div>
      )}

      {loading ? (
        <AdminSection>
          <div role="status" aria-label={common.loading} aria-busy="true" className="space-y-3">
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
        <AdminEmptyState title={label("empty")} />
      ) : (
        <AdminSection>
          <div className="w-full overflow-x-auto" role="region" aria-label={label("title")} tabIndex={0}>
            <AdminDataTable>
            <AdminDataTableHead>
              <AdminDataTableRow>
                <AdminDataTableTh>{label("preview")}</AdminDataTableTh>
                <AdminDataTableTh>{label("slug")}</AdminDataTableTh>
                <AdminDataTableTh>{label("tier")}</AdminDataTableTh>
                <AdminDataTableTh>{label("status")}</AdminDataTableTh>
                <AdminDataTableTh>{label("sortOrder")}</AdminDataTableTh>
                <AdminDataTableTh>{label("users")}</AdminDataTableTh>
                <AdminDataTableTh>{label("actions")}</AdminDataTableTh>
              </AdminDataTableRow>
            </AdminDataTableHead>
            <AdminDataTableBody>
              {list.map((style) => (
                <AdminDataTableRow key={style.id}>
                  <AdminDataTableTd>
                    <StylePreview config={style.config} invalidLabel={label("invalidConfig")} />
                  </AdminDataTableTd>
                  <AdminDataTableTd>
                    <span className="font-mono text-sm">{style.slug}</span>
                    <div className="text-xs text-gray-500">{style.nameKey}</div>
                  </AdminDataTableTd>
                  <AdminDataTableTd>{tierBadge(style.tier, label(style.tier))}</AdminDataTableTd>
                  <AdminDataTableTd>
                    <AdminStatusBadge tone={statusTone(style.status)}>
                      {label(style.status)}
                    </AdminStatusBadge>
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
                            className="min-h-11 rounded px-2 text-sm text-indigo-600 hover:underline dark:text-indigo-400"
                          >
                            {label("edit")}
                          </button>
                          {style.status === "draft" && (
                            <button
                              onClick={() => requestTransition(style.id, "active", style.slug)}
                              className="min-h-11 rounded px-2 text-sm text-green-600 hover:underline dark:text-green-400"
                            >
                              {label("activate")}
                            </button>
                          )}
                          {style.status === "active" && (
                            <button
                              onClick={() => requestTransition(style.id, "archived", style.slug)}
                              className="min-h-11 rounded px-2 text-sm text-red-600 hover:underline dark:text-red-400"
                            >
                              {label("archive")}
                            </button>
                          )}
                          {style.status === "archived" && (
                            <button
                              onClick={() => requestTransition(style.id, "draft", style.slug)}
                              className="min-h-11 rounded px-2 text-sm text-amber-600 hover:underline dark:text-amber-400"
                            >
                              {label("restore")}
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
          </div>
        </AdminSection>
      )}

      {/* ── Confirm Dialog ──────────────────── */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm animate-[fadeIn_150ms_ease-out] sm:items-center">
          <div role="dialog" aria-modal="true" aria-labelledby="style-transition-title" className="my-auto w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl dark:bg-gray-900 sm:p-6 animate-[scaleIn_200ms_ease-out]">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              <span id="style-transition-title">{label("confirmStatus")}</span>
            </h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              {label("changeTo")} <span className="font-mono font-bold">{confirmAction.slug}</span>{" "}
              <span className="font-bold">{label(confirmAction.status)}</span>?
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button
                onClick={() => setConfirmAction(null)}
                disabled={transitioning}
                className="min-h-11 rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
              >
                {label("cancel")}
              </button>
              <button
                onClick={() => handleTransition(confirmAction.id, confirmAction.status)}
                disabled={transitioning}
                className={cn(
                  "min-h-11 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50",
                  confirmAction.status === "archived"
                    ? "bg-red-600 hover:bg-red-700"
                    : confirmAction.status === "active"
                      ? "bg-green-600 hover:bg-green-700"
                      : "bg-amber-600 hover:bg-amber-700"
                )}
              >
                {transitioning ? label("saving") : label("confirm")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Editor Modal ───────────────────── */}
      {showEditor && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm animate-[fadeIn_150ms_ease-out] sm:items-center">
          <div role="dialog" aria-modal="true" aria-labelledby="style-editor-title" className="my-auto w-[calc(100vw-2rem)] max-w-2xl max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl bg-white p-4 shadow-xl dark:bg-gray-900 sm:p-6 animate-[scaleIn_200ms_ease-out]">
            <h2 id="style-editor-title" className="mb-4 text-lg font-semibold">
              {creating ? label("createTitle") : `${label("editTitle")}: ${editing?.slug}`}
            </h2>

            {formError && (
              <div role="alert" className="mb-4 whitespace-pre-wrap rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="style-slug" className="mb-1 block text-sm font-medium">{label("slug")}</label>
                <input
                  id="style-slug"
                  className="w-full rounded-md border px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-600"
                  value={form.slug}
                  onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                  placeholder={label("slugPlaceholder")}
                  disabled={!creating}
                />
              </div>
              <div>
                <label htmlFor="style-name-key" className="mb-1 block text-sm font-medium">{label("nameKey")}</label>
                <input
                  id="style-name-key"
                  className="w-full rounded-md border px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-600"
                  value={form.nameKey}
                  onChange={(e) => setForm((f) => ({ ...f, nameKey: e.target.value }))}
                  placeholder={label("nameKeyPlaceholder")}
                />
              </div>
              <div>
                <label htmlFor="style-description-key" className="mb-1 block text-sm font-medium">{label("descriptionKey")}</label>
                <input
                  id="style-description-key"
                  className="w-full rounded-md border px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-600"
                  value={form.descriptionKey}
                  onChange={(e) => setForm((f) => ({ ...f, descriptionKey: e.target.value }))}
                />
              </div>
              <div>
                <label htmlFor="style-thumbnail-url" className="mb-1 block text-sm font-medium">{label("thumbnailUrl")}</label>
                <input
                  id="style-thumbnail-url"
                  className="w-full rounded-md border px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-600"
                  value={form.thumbnailUrl}
                  onChange={(e) => setForm((f) => ({ ...f, thumbnailUrl: e.target.value }))}
                />
              </div>
              <div>
                <label htmlFor="style-tier" className="mb-1 block text-sm font-medium">{label("tier")}</label>
                <select
                  id="style-tier"
                  className="w-full rounded-md border px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-600"
                  value={form.tier}
                  onChange={(e) => setForm((f) => ({ ...f, tier: e.target.value }))}
                >
                  <option value="free">{label("free")}</option>
                  <option value="premium">{label("premium")}</option>
                  <option value="exclusive">{label("exclusive")}</option>
                </select>
              </div>
              <div>
                <label htmlFor="style-sort-order" className="mb-1 block text-sm font-medium">{label("sortOrder")}</label>
                <input
                  id="style-sort-order"
                  type="number"
                  className="w-full rounded-md border px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-600"
                  value={form.sortOrder}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))
                  }
                />
              </div>
              <div>
                <label htmlFor="style-status" className="mb-1 block text-sm font-medium">{label("status")}</label>
                <select
                  id="style-status"
                  className="w-full rounded-md border px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-600"
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                >
                  <option value="draft">{label("draft")}</option>
                  <option value="active">{label("active")}</option>
                  <option value="archived">{label("archived")}</option>
                </select>
              </div>
            </div>

            {/* Config JSON editor with live preview */}
            <div className="mt-4">
              <label htmlFor="style-config" className="mb-1 block text-sm font-medium">{label("config")}</label>
              <textarea
                id="style-config"
                className="h-64 w-full rounded-md border px-3 py-2 font-mono text-sm dark:border-gray-600 dark:bg-gray-800"
                value={form.config}
                onChange={(e) => setForm((f) => ({ ...f, config: e.target.value }))}
              />
            </div>

            {/* Live Preview */}
            <div className="mt-4">
              <label className="mb-2 block text-sm font-medium">{label("preview")}</label>
              <div className="flex justify-center p-6 bg-gray-100 rounded-lg dark:bg-gray-800">
                <StylePreviewLarge
                  config={form.config}
                  invalidLabel={label("invalidJson")}
                  invalidConfigLabel={label("invalidConfig")}
                  sampleTerm={label("sampleTerm")}
                  sampleReading={label("sampleReading")}
                  sampleMeaning={label("sampleMeaning")}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                onClick={closeEditor}
                className="min-h-11 rounded-md border px-4 py-2 text-sm hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
              >
                {label("cancel")}
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="min-h-11 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? label("saving") : creating ? label("create") : label("save")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Large style preview card with front/back simulation */
function StylePreviewLarge({ config: configJson, invalidLabel, invalidConfigLabel, sampleTerm, sampleReading, sampleMeaning }: { config: string; invalidLabel: string; invalidConfigLabel: string; sampleTerm: string; sampleReading: string; sampleMeaning: string }) {
  let raw: unknown;
  try {
    raw = JSON.parse(configJson);
  } catch {
    return <div className="text-sm text-red-500">{invalidLabel}</div>;
  }
  const parsed = flashcardThemeConfigSchema.safeParse(raw);
  if (!parsed.success) {
    return (
      <div className="max-w-md whitespace-pre-wrap text-sm text-red-600">{invalidConfigLabel}</div>
    );
  }
  const theme: FlashcardThemeConfig = parsed.data;

  return (
    <div
      className="flex h-48 w-72 flex-col items-center justify-center gap-2 border p-3 transition-all"
      style={{
        background: theme.background,
        borderColor: theme.border,
        borderRadius: theme.borderRadius,
        boxShadow: theme.shadow,
        color: theme.foreground,
        fontFamily: theme.fontFamily
      }}
    >
      <div
        className="flex w-full flex-col items-center gap-1 rounded-xl border p-4"
        style={{ background: theme.contentSurface, borderColor: theme.border }}
      >
        <span className="text-3xl font-bold" style={{ color: theme.foreground }}>
          {sampleTerm}
        </span>
        <span className="text-sm" style={{ color: theme.mutedForeground }}>
          {sampleReading}
        </span>
        <span className="text-xs" style={{ color: theme.mutedForeground }}>
          {sampleMeaning}
        </span>
        <div className="mt-1 h-1 w-8 rounded-full" style={{ background: theme.accent }} />
      </div>
    </div>
  );
}
