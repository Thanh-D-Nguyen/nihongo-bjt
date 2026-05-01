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

type CommonLabels = { empty: string; error: string; loading: string; records: string };
type Labels = Record<string, string>;

export type PolicyKey =
  | "terms_of_service"
  | "privacy_policy"
  | "cookie_policy"
  | "tokusho"
  | "consent_marketing"
  | "consent_analytics"
  | "legal_document";

type PolicyVersion = {
  id: string;
  policyKey: PolicyKey;
  version: string;
  status: "draft" | "published" | "archived";
  effectiveAt: string;
  contentMd: string | null;
  createdAt: string;
};
type ListResponse = { items: PolicyVersion[]; total: number };

type AuditEntry = {
  id: string;
  action: string;
  createdAt: string;
  actor: { id: string; displayName: string; email: string } | null;
};
type Detail = PolicyVersion & { audit: AuditEntry[] };

type MePayload = { roles?: Array<{ role?: { permissions?: Array<{ permission?: { code?: string } }> } }> };
function permsFromMe(me: MePayload): Set<string> {
  const out = new Set<string>();
  for (const r of me.roles ?? []) {
    for (const link of r.role?.permissions ?? []) {
      const code = link.permission?.code;
      if (code) out.add(code);
    }
  }
  return out;
}

function downloadCsv(filename: string, header: string[], rows: string[][]) {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const body = [header, ...rows].map((r) => r.map(escape).join(",")).join("\n");
  const blob = new Blob([`\uFEFF${body}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function statusTone(s: PolicyVersion["status"]): "neutral" | "good" | "warning" {
  if (s === "published") return "good";
  if (s === "archived") return "warning";
  return "neutral";
}

const WRITE_PERMS = ["admin.legal.write", "legal.admin"];

export type LegalPolicyAdminClientProps = {
  common: CommonLabels;
  labels: Labels;
  /** When set, locks list/create to a single policy key (e.g. consent, terms, cookies, tokushoho). */
  fixedPolicyKey?: PolicyKey;
  /** Optional curator for create-form initial contentMd (e.g. tokushoho structured template). */
  initialContentMd?: string;
  /** Optional custom renderer for the structured side panel (e.g. tokushoho structured fields). */
  structuredRenderer?: (detail: Detail) => React.ReactNode;
  /** Optional structured editor returning serialized contentMd; when present replaces the textarea. */
  structuredEditor?: (props: {
    initial: string;
    onChange: (next: string) => void;
  }) => React.ReactNode;
};

export function LegalPolicyAdminClient({
  common,
  labels,
  fixedPolicyKey,
  initialContentMd,
  structuredRenderer,
  structuredEditor
}: LegalPolicyAdminClientProps) {
  const t = useCallback((k: string) => labels[k] ?? k, [labels]);
  const [perms, setPerms] = useState<Set<string> | null>(null);
  const canWrite = perms != null && WRITE_PERMS.some((p) => perms.has(p));

  const [list, setList] = useState<ListResponse | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | PolicyVersion["status"]>("all");
  const [policyKeyFilter, setPolicyKeyFilter] = useState<PolicyKey | "all">(fixedPolicyKey ?? "all");

  const [selected, setSelected] = useState<PolicyVersion | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);

  type Mode = "view" | "create" | "edit" | "publish" | "archive" | "delete" | "duplicate" | null;
  const [mode, setMode] = useState<Mode>(null);
  const [formVersion, setFormVersion] = useState("");
  const [formEffectiveAt, setFormEffectiveAt] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formPolicyKey, setFormPolicyKey] = useState<PolicyKey>(fixedPolicyKey ?? "terms_of_service");
  const [mutating, setMutating] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await adminApiFetch("/api/admin/me");
        if (!r.ok) {
          if (!cancelled) setPerms(new Set());
          return;
        }
        const body = (await r.json()) as MePayload;
        if (!cancelled) setPerms(permsFromMe(body));
      } catch {
        if (!cancelled) setPerms(new Set());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadList = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      const effectiveKey = fixedPolicyKey ?? (policyKeyFilter === "all" ? undefined : policyKeyFilter);
      if (effectiveKey) params.set("policyKey", effectiveKey);
      if (statusFilter !== "all") params.set("status", statusFilter);
      params.set("limit", "200");
      const r = await adminApiFetch(`/api/admin/legal/policies?${params.toString()}`);
      if (!r.ok) {
        setListError(common.error);
        setList(null);
        return;
      }
      setListError(null);
      setList((await r.json()) as ListResponse);
    } catch {
      setListError(common.error);
    }
  }, [policyKeyFilter, statusFilter, fixedPolicyKey, common.error]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const loadDetail = useCallback(async (id: string) => {
    const r = await adminApiFetch(`/api/admin/legal/policies/${id}`);
    if (!r.ok) {
      setDetail(null);
      return;
    }
    setDetail((await r.json()) as Detail);
  }, []);

  function openDrawer(item: PolicyVersion) {
    setSelected(item);
    setDetail(null);
    setMode("view");
    void loadDetail(item.id);
  }

  function closeDrawer() {
    setSelected(null);
    setDetail(null);
    setMode(null);
  }

  function startCreate() {
    if (!canWrite) return;
    setSelected({
      id: "",
      policyKey: fixedPolicyKey ?? "terms_of_service",
      version: "",
      status: "draft",
      effectiveAt: new Date().toISOString(),
      contentMd: null,
      createdAt: new Date().toISOString()
    });
    setDetail(null);
    setMode("create");
    setFormPolicyKey(fixedPolicyKey ?? "terms_of_service");
    setFormVersion("");
    setFormEffectiveAt(new Date().toISOString().slice(0, 16));
    setFormContent(initialContentMd ?? "");
  }

  function startEdit() {
    if (!canWrite || !detail) return;
    setMode("edit");
    setFormVersion(detail.version);
    setFormEffectiveAt(new Date(detail.effectiveAt).toISOString().slice(0, 16));
    setFormContent(detail.contentMd ?? "");
  }

  async function submitCreate() {
    if (formVersion.trim().length < 1) {
      setToast({ kind: "err", text: t("versionRequired") });
      return;
    }
    setMutating(true);
    try {
      const r = await adminApiFetch("/api/admin/legal/policies", {
        body: JSON.stringify({
          contentMd: formContent,
          effectiveAt: new Date(formEffectiveAt).toISOString(),
          policyKey: fixedPolicyKey ?? formPolicyKey,
          status: "draft",
          version: formVersion.trim()
        }),
        headers: { "content-type": "application/json" },
        method: "POST"
      });
      if (!r.ok) {
        setToast({ kind: "err", text: await r.text() });
        return;
      }
      const created = (await r.json()) as PolicyVersion;
      setToast({ kind: "ok", text: t("createOk") });
      closeDrawer();
      void loadList();
      setTimeout(() => openDrawer(created), 50);
    } finally {
      setMutating(false);
    }
  }

  async function submitEdit() {
    if (!detail) return;
    setMutating(true);
    try {
      const r = await adminApiFetch(`/api/admin/legal/policies/${detail.id}`, {
        body: JSON.stringify({
          contentMd: formContent,
          effectiveAt: new Date(formEffectiveAt).toISOString(),
          version: formVersion.trim()
        }),
        headers: { "content-type": "application/json" },
        method: "PATCH"
      });
      if (!r.ok) {
        setToast({ kind: "err", text: await r.text() });
        return;
      }
      setToast({ kind: "ok", text: t("updateOk") });
      setMode("view");
      void loadList();
      void loadDetail(detail.id);
    } finally {
      setMutating(false);
    }
  }

  async function transition(action: "publish" | "archive" | "delete" | "duplicate") {
    if (!selected) return;
    setMutating(true);
    try {
      const url = `/api/admin/legal/policies/${selected.id}${action === "publish" ? "/publish" : action === "archive" ? "/archive" : action === "duplicate" ? "/duplicate" : ""}`;
      const method = action === "delete" ? "DELETE" : action === "duplicate" ? "POST" : "PATCH";
      const r = await adminApiFetch(url, { method });
      if (!r.ok) {
        setToast({ kind: "err", text: await r.text() });
        return;
      }
      setToast({ kind: "ok", text: t(`${action}Ok`) });
      void loadList();
      if (action === "delete") {
        closeDrawer();
      } else if (action === "duplicate") {
        const created = (await r.json()) as PolicyVersion;
        closeDrawer();
        setTimeout(() => openDrawer(created), 50);
      } else {
        setMode("view");
        void loadDetail(selected.id);
      }
    } finally {
      setMutating(false);
    }
  }

  function exportCsv() {
    if (!list) return;
    const header = ["policyKey", "version", "status", "effectiveAt", "createdAt"];
    const rows = list.items.map((it) => [it.policyKey, it.version, it.status, it.effectiveAt, it.createdAt]);
    downloadCsv(`legal-policies-${Date.now()}.csv`, header, rows);
  }

  return (
    <div className="space-y-4">
      <AdminPageHeader title={t("title")} description={t("subtitle")} />
      {perms != null && !canWrite ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          {t("readOnlyNotice")}
        </div>
      ) : null}

      <AdminSection>
        <div className="flex flex-wrap items-end gap-2">
          {fixedPolicyKey ? null : (
            <select
              aria-label={t("filterPolicyKey")}
              className="rounded border px-2 py-1 text-sm"
              onChange={(e) => setPolicyKeyFilter(e.target.value as PolicyKey | "all")}
              value={policyKeyFilter}
            >
              <option value="all">{t("filterPolicyKeyAll")}</option>
              <option value="terms_of_service">{t("policyKey_terms_of_service")}</option>
              <option value="privacy_policy">{t("policyKey_privacy_policy")}</option>
              <option value="cookie_policy">{t("policyKey_cookie_policy")}</option>
              <option value="tokusho">{t("policyKey_tokusho")}</option>
              <option value="consent_marketing">{t("policyKey_consent_marketing")}</option>
              <option value="consent_analytics">{t("policyKey_consent_analytics")}</option>
              <option value="legal_document">{t("policyKey_legal_document")}</option>
            </select>
          )}
          <select
            aria-label={t("filterStatus")}
            className="rounded border px-2 py-1 text-sm"
            onChange={(e) => setStatusFilter(e.target.value as "all" | PolicyVersion["status"])}
            value={statusFilter}
          >
            <option value="all">{t("filterStatusAll")}</option>
            <option value="draft">{t("statusDraft")}</option>
            <option value="published">{t("statusPublished")}</option>
            <option value="archived">{t("statusArchived")}</option>
          </select>
          <button className="rounded border px-3 py-1 text-sm" onClick={() => void loadList()} type="button">{t("actionRefresh")}</button>
          <button className="rounded border px-3 py-1 text-sm" onClick={exportCsv} type="button">{t("actionExportCsv")}</button>
          {canWrite ? (
            <button className="ml-auto rounded bg-indigo-600 px-3 py-1 text-sm text-white" onClick={startCreate} type="button">{t("actionCreate")}</button>
          ) : null}
        </div>
      </AdminSection>

      {listError ? (
        <div role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-900">{listError}</div>
      ) : null}

      <AdminSection>
        {list == null ? (
          <div className="p-3 text-sm text-gray-500">{common.loading}</div>
        ) : list.items.length === 0 ? (
          <AdminEmptyState title={common.empty} />
        ) : (
          <AdminDataTable>
            <AdminDataTableHead>
              <AdminDataTableRow>
                {fixedPolicyKey ? null : <AdminDataTableTh>{t("colPolicyKey")}</AdminDataTableTh>}
                <AdminDataTableTh>{t("colVersion")}</AdminDataTableTh>
                <AdminDataTableTh>{t("colStatus")}</AdminDataTableTh>
                <AdminDataTableTh>{t("colEffective")}</AdminDataTableTh>
                <AdminDataTableTh>{t("colCreated")}</AdminDataTableTh>
              </AdminDataTableRow>
            </AdminDataTableHead>
            <AdminDataTableBody>
              {list.items.map((item) => (
                <AdminDataTableRow key={item.id} className="cursor-pointer hover:bg-indigo-50/40" onClick={() => openDrawer(item)}>
                  {fixedPolicyKey ? null : (
                    <AdminDataTableTd>
                      <span className="font-mono text-xs">{item.policyKey}</span>
                    </AdminDataTableTd>
                  )}
                  <AdminDataTableTd>
                    <span className="font-mono text-sm">{item.version}</span>
                  </AdminDataTableTd>
                  <AdminDataTableTd>
                    <AdminStatusBadge tone={statusTone(item.status)}>
                      {t(`status${item.status.charAt(0).toUpperCase()}${item.status.slice(1)}`)}
                    </AdminStatusBadge>
                  </AdminDataTableTd>
                  <AdminDataTableTd>
                    <span className="text-xs text-gray-500">{new Date(item.effectiveAt).toLocaleString()}</span>
                  </AdminDataTableTd>
                  <AdminDataTableTd>
                    <span className="text-xs text-gray-500">{new Date(item.createdAt).toLocaleString()}</span>
                  </AdminDataTableTd>
                </AdminDataTableRow>
              ))}
            </AdminDataTableBody>
          </AdminDataTable>
        )}
      </AdminSection>

      {selected ? (
        <div aria-modal className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={closeDrawer} role="dialog">
          <div className="h-full w-full max-w-3xl overflow-y-auto bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <div className="font-mono text-xs text-gray-500">{selected.policyKey}</div>
                <div className="font-mono text-base font-semibold">{selected.version || t("createTitle")}</div>
                {selected.id ? (
                  <AdminStatusBadge tone={statusTone(selected.status)}>
                    {t(`status${selected.status.charAt(0).toUpperCase()}${selected.status.slice(1)}`)}
                  </AdminStatusBadge>
                ) : null}
              </div>
              <button className="rounded border px-2 py-1 text-sm" onClick={closeDrawer} type="button">{t("close")}</button>
            </div>

            {mode === "create" ? (
              <div className="mt-4 space-y-3">
                {!fixedPolicyKey ? (
                  <div>
                    <label className="block text-xs font-semibold uppercase text-gray-600">{t("colPolicyKey")}</label>
                    <select className="mt-1 w-full rounded border px-2 py-1 text-sm" onChange={(e) => setFormPolicyKey(e.target.value as PolicyKey)} value={formPolicyKey}>
                      <option value="terms_of_service">{t("policyKey_terms_of_service")}</option>
                      <option value="privacy_policy">{t("policyKey_privacy_policy")}</option>
                      <option value="cookie_policy">{t("policyKey_cookie_policy")}</option>
                      <option value="tokusho">{t("policyKey_tokusho")}</option>
                      <option value="consent_marketing">{t("policyKey_consent_marketing")}</option>
                      <option value="consent_analytics">{t("policyKey_consent_analytics")}</option>
                      <option value="legal_document">{t("policyKey_legal_document")}</option>
                    </select>
                  </div>
                ) : null}
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-600">{t("colVersion")}</label>
                  <input className="mt-1 w-full rounded border px-2 py-1 text-sm" onChange={(e) => setFormVersion(e.target.value)} value={formVersion} placeholder="v1" />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-600">{t("colEffective")}</label>
                  <input type="datetime-local" className="mt-1 w-full rounded border px-2 py-1 text-sm" onChange={(e) => setFormEffectiveAt(e.target.value)} value={formEffectiveAt} />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-600">{t("colContent")}</label>
                  {structuredEditor ? (
                    structuredEditor({ initial: formContent, onChange: setFormContent })
                  ) : (
                    <textarea className="mt-1 w-full rounded border px-2 py-1 font-mono text-xs" onChange={(e) => setFormContent(e.target.value)} rows={14} value={formContent} />
                  )}
                </div>
                <div className="flex justify-end gap-2">
                  <button className="rounded border px-3 py-1 text-sm" onClick={closeDrawer} type="button">{t("cancel")}</button>
                  <button className="rounded bg-indigo-600 px-3 py-1 text-sm text-white disabled:opacity-50" disabled={mutating} onClick={() => void submitCreate()} type="button">{t("save")}</button>
                </div>
              </div>
            ) : detail == null ? (
              <div className="mt-4 text-sm text-gray-500">{common.loading}</div>
            ) : (
              <div className="mt-4 space-y-3">
                {mode === "edit" ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold uppercase text-gray-600">{t("colVersion")}</label>
                      <input className="mt-1 w-full rounded border px-2 py-1 text-sm" onChange={(e) => setFormVersion(e.target.value)} value={formVersion} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase text-gray-600">{t("colEffective")}</label>
                      <input type="datetime-local" className="mt-1 w-full rounded border px-2 py-1 text-sm" onChange={(e) => setFormEffectiveAt(e.target.value)} value={formEffectiveAt} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase text-gray-600">{t("colContent")}</label>
                      {structuredEditor ? (
                        structuredEditor({ initial: formContent, onChange: setFormContent })
                      ) : (
                        <textarea className="mt-1 w-full rounded border px-2 py-1 font-mono text-xs" onChange={(e) => setFormContent(e.target.value)} rows={14} value={formContent} />
                      )}
                    </div>
                    <div className="flex justify-end gap-2">
                      <button className="rounded border px-3 py-1 text-sm" onClick={() => setMode("view")} type="button">{t("cancel")}</button>
                      <button className="rounded bg-indigo-600 px-3 py-1 text-sm text-white disabled:opacity-50" disabled={mutating} onClick={() => void submitEdit()} type="button">{t("save")}</button>
                    </div>
                  </div>
                ) : (
                  <>
                    {structuredRenderer ? (
                      <div className="rounded border bg-gray-50 p-3">{structuredRenderer(detail)}</div>
                    ) : null}
                    <div className="rounded border bg-gray-50 p-3">
                      <div className="mb-1 text-xs font-semibold uppercase text-gray-500">{t("colContent")}</div>
                      <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words text-xs">{detail.contentMd ?? "—"}</pre>
                    </div>

                    {canWrite ? (
                      <div className="flex flex-wrap gap-2">
                        {detail.status === "draft" ? (
                          <>
                            <button className="rounded border px-3 py-1 text-sm" onClick={startEdit} type="button">{t("actionEdit")}</button>
                            <button className="rounded bg-emerald-600 px-3 py-1 text-sm text-white disabled:opacity-50" disabled={mutating} onClick={() => void transition("publish")} type="button">{t("actionPublish")}</button>
                            <button className="rounded border px-3 py-1 text-sm" onClick={() => void transition("delete")} disabled={mutating} type="button">{t("actionDelete")}</button>
                          </>
                        ) : null}
                        {detail.status === "published" ? (
                          <button className="rounded border px-3 py-1 text-sm" onClick={() => void transition("archive")} disabled={mutating} type="button">{t("actionArchive")}</button>
                        ) : null}
                        <button className="rounded border px-3 py-1 text-sm" onClick={() => void transition("duplicate")} disabled={mutating} type="button">{t("actionDuplicate")}</button>
                      </div>
                    ) : null}

                    <div className="mt-2">
                      <h3 className="text-sm font-semibold">{t("auditTitle")}</h3>
                      <ul className="mt-2 space-y-1 text-xs">
                        {detail.audit.length === 0 ? (
                          <li className="text-gray-400">{common.empty}</li>
                        ) : (
                          detail.audit.map((a) => (
                            <li key={a.id} className="rounded border bg-gray-50 px-2 py-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-mono">{a.action}</span>
                                <span className="text-gray-500">{new Date(a.createdAt).toLocaleString()}</span>
                              </div>
                              {a.actor ? <div className="text-gray-600">{a.actor.displayName} ({a.actor.email})</div> : null}
                            </li>
                          ))
                        )}
                      </ul>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className={`fixed bottom-4 right-4 rounded px-3 py-2 text-sm text-white shadow ${toast.kind === "ok" ? "bg-emerald-600" : "bg-red-600"}`} role="status">
          {toast.text}
          <button className="ml-3 underline" onClick={() => setToast(null)} type="button">✕</button>
        </div>
      ) : null}
    </div>
  );
}
