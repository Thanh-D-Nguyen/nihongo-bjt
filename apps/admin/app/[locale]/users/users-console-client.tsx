"use client";

import {
  canInviteOrCreateUser,
  canListLearnerProfiles
} from "@nihongo-bjt/shared";
import {
  AdminDataTable,
  AdminDataTableBody,
  AdminDataTableCellActions,
  AdminDataTableHead,
  AdminDataTableRow,
  AdminDataTableTd,
  AdminDataTableTh,
  AdminEmptyState,
  AdminFilterBar,
  AdminKpiCard,
  AdminPageHeader,
  AdminSearchInput,
  AdminSection,
  AdminSelect,
  AdminStatusBadge,
  cn
} from "@nihongo-bjt/ui";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { adminApiFetch } from "@/lib/admin-api";

import { UserInviteModal } from "./user-invite-modal";
import { permsFromMe } from "@/app/_components/admin-client-utils";

const fieldClass =
  "mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-ink shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100";

type CommonLabels = {
  error: string;
  loading: string;
};

export type UserFormLabels = {
  create: string;
  createError: string;
  dailyGoal: string;
  displayName: string;
  email: string;
  forbidden: string;
  listSectionTitle: string;
  nameRequired: string;
  readOnlyHint: string;
  refresh: string;
};

export type UserManagementLabels = Record<string, string>;

type MeResponse = {
  roles?: Array<{ role?: { permissions?: Array<{ permission?: { code?: string } }> } }>;
};

type ListItem = {
  accountStatus: string;
  accountType?: string;
  authSyncStatus?: string;
  createdAt: string;
  displayName: string;
  email: string | null;
  id: string;
  lastActivityAt: string;
  learningSummary: { dueFlashcards: number; hasDue: boolean };
  planSlug: string;
  planSource: string;
  providerSummary: string;
  quota: { limit: number; used: number; warning: boolean };
  uiLocale: string;
};

type Kpis = {
  activeLearners: number;
  onboardingIncomplete: number;
  paidUsers: number;
  suspendedOrDisabled: number;
  totalUsers: number;
};

type ListResponse = { items: ListItem[]; page: number; pageSize: number; total: number };

type PlanRow = {
  id: string;
  nameKey: string;
  slug: string;
  status: string;
};

function canWriteUsers(codes: Set<string>) {
  return (
    codes.has("support.user.write") || codes.has("support.user") // legacy
  );
}

function canReadMonetization(codes: Set<string>) {
  return codes.has("admin.monetization.read");
}

function canWriteMonetization(codes: Set<string>) {
  return codes.has("admin.monetization.write");
}

function accountStatusTone(
  s: string
): "neutral" | "good" | "warning" | "danger" {
  if (s === "active") {
    return "good";
  }
  if (s === "pending") {
    return "warning";
  }
  if (s === "suspended") {
    return "danger";
  }
  if (s === "deleted" || s === "archived") {
    return "neutral";
  }
  return "neutral";
}

function planBadgeTone(
  slug: string
): "neutral" | "good" | "warning" {
  if (slug === "premium" || slug === "standard") {
    return "good";
  }
  if (slug === "internal" || slug === "admin") {
    return "warning";
  }
  return "neutral";
}

function formatWhen(iso: string, locale: string) {
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function buildListQuery(
  p: {
    lastActiveAfter?: string;
    lastActiveBefore?: string;
    page: number;
    pageSize: number;
    plan: string;
    q: string;
    status: string;
    uiLocale: string;
  }
) {
  const q = new URLSearchParams();
  q.set("page", String(p.page));
  q.set("pageSize", String(p.pageSize));
  if (p.q.trim()) {
    q.set("q", p.q.trim());
  }
  if (p.status && p.status !== "all") {
    q.set("status", p.status);
  }
  if (p.uiLocale && p.uiLocale !== "all") {
    q.set("uiLocale", p.uiLocale);
  }
  if (p.plan && p.plan !== "all") {
    q.set("plan", p.plan);
  }
  if (p.lastActiveAfter) {
    q.set("lastActiveAfter", p.lastActiveAfter);
  }
  if (p.lastActiveBefore) {
    q.set("lastActiveBefore", p.lastActiveBefore);
  }
  return q.toString();
}

function downloadCsv(filename: string, header: string[], rows: string[][]) {
  const esc = (c: string) => `"${c.replace(/"/g, '""')}"`;
  const lines = [header.map(esc).join(",")].concat(
    rows.map((r) => r.map(esc).join(","))
  );
  const body = "\uFEFF" + lines.join("\n");
  const blob = new Blob([body], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

const STATUS_OPTIONS = [
  "all",
  "active",
  "pending",
  "disabled",
  "suspended",
  "deleted"
] as const;

type ModalState =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "status"; id: string; name: string }
  | { kind: "plan"; id: string; name: string }
  | { kind: "note"; id: string; name: string }
  | { kind: "bulkStatus" };

export function UsersConsoleClient({
  common,
  form,
  locale,
  um
}: {
  common: CommonLabels;
  form: UserFormLabels;
  locale: "ja" | "vi";
  um: UserManagementLabels;
}) {
  const t = (k: keyof UserManagementLabels | string) =>
    (um as Record<string, string>)[k] ?? k;
  const router = useRouter();

  const accTypeLabel = (v: string | undefined) => {
    const k = `accType_${(v ?? "learner")}`;
    return (um as Record<string, string>)[k] ?? (v ?? "learner");
  };
  const authSyncLabel = (v: string | undefined) => {
    const k = `authSync_${(v ?? "not_linked")}`;
    return (um as Record<string, string>)[k] ?? (v ?? "—");
  };

  const [perms, setPerms] = useState<Set<string> | null>(null);
  const [permsLoading, setPermsLoading] = useState(true);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [list, setList] = useState<ListItem[]>([]);
  const [listMeta, setListMeta] = useState({ page: 1, pageSize: 20, total: 0 });
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const [draft, setDraft] = useState({
    lastActiveAfter: "",
    lastActiveBefore: "",
    plan: "all" as string,
    q: "",
    status: "all" as string,
    uiLocale: "all" as string
  });
  const [applied, setApplied] = useState(draft);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<ModalState>({ kind: "closed" });
  const [reason, setReason] = useState("");
  const [statusChoice, setStatusChoice] = useState<string>("active");
  const [planChoice, setPlanChoice] = useState<string>("free");
  const [noteBody, setNoteBody] = useState("");
  const [noteRef, setNoteRef] = useState("");
  const [modalBusy, setModalBusy] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [bulkWorking, setBulkWorking] = useState(false);
  const [bulkMsg, setBulkMsg] = useState<string | null>(null);

  // Permission sets come from GET /admin/me; they only drive UX. Every write still goes through API RBAC (AdminAuthService).
  const canList = perms != null && canListLearnerProfiles(perms);
  const canInvite = perms != null && canInviteOrCreateUser(perms);
  const canWrite = perms != null && canWriteUsers(perms);
  const canMRead = perms != null && canReadMonetization(perms);
  const canMWrite = perms != null && canWriteMonetization(perms);
  const readOnlyCreate = canList && !canInvite;

  const loadKpis = useCallback(async () => {
    if (!canList) {
      return;
    }
    const res = await adminApiFetch("/api/admin/users/kpis");
    if (res.status === 403) {
      setForbidden(true);
      return;
    }
    if (!res.ok) {
      return;
    }
    setKpis((await res.json()) as Kpis);
  }, [canList]);

  const loadList = useCallback(async () => {
    if (!canList) {
      return;
    }
    setListLoading(true);
    setListError(null);
    setForbidden(false);
    setBulkMsg(null);
    try {
      const after = applied.lastActiveAfter
        ? new Date(applied.lastActiveAfter).toISOString()
        : undefined;
      const before = applied.lastActiveBefore
        ? new Date(applied.lastActiveBefore).toISOString()
        : undefined;
      const qs = buildListQuery({
        lastActiveAfter: after,
        lastActiveBefore: before,
        page,
        pageSize,
        plan: applied.plan,
        q: applied.q,
        status: applied.status,
        uiLocale: applied.uiLocale
      });
      const res = await adminApiFetch(`/api/admin/users?${qs}`);
      if (res.status === 403) {
        setForbidden(true);
        return;
      }
      if (res.status === 401) {
        setListError(t("errorListSession"));
        return;
      }
      if (!res.ok) {
        if (res.status >= 500) {
          setListError(t("errorListServer"));
        } else if (res.status === 400) {
          setListError(t("errorListBadRequest"));
        } else {
          setListError(t("errorLoad"));
        }
        return;
      }
      const data = (await res.json()) as ListResponse;
      setList(data.items);
      setListMeta({ page: data.page, pageSize: data.pageSize, total: data.total });
    } catch {
      setListError(t("errorListNetwork"));
    } finally {
      setListLoading(false);
    }
  }, [canList, applied, page, pageSize]);

  const loadPlans = useCallback(async () => {
    if (!canMRead) {
      return;
    }
    const res = await adminApiFetch("/api/admin/monetization/plans");
    if (!res.ok) {
      return;
    }
    const data = (await res.json()) as PlanRow[];
    setPlans(
      (data ?? []).filter(
        (p) => p.status === "active" && p.slug !== "archived"
      )
    );
  }, [canMRead]);

  useEffect(() => {
    let c = false;
    void (async () => {
      setPermsLoading(true);
      try {
        const res = await adminApiFetch("/api/admin/me");
        if (!res.ok) {
          if (!c) {
            setPerms(new Set());
          }
          return;
        }
        const data = (await res.json()) as MeResponse;
        if (!c) {
          setPerms(permsFromMe(data));
        }
      } catch {
        if (!c) {
          setPerms(new Set());
        }
      } finally {
        if (!c) {
          setPermsLoading(false);
        }
      }
    })();
    return () => {
      c = true;
    };
  }, []);

  useEffect(() => {
    if (perms == null || permsLoading) {
      return;
    }
    if (!canListLearnerProfiles(perms)) {
      return;
    }
    void loadKpis();
  }, [perms, permsLoading, loadKpis]);

  useEffect(() => {
    if (perms == null || permsLoading) {
      return;
    }
    if (canMRead) {
      void loadPlans();
    }
  }, [perms, permsLoading, canMRead, loadPlans]);

  useEffect(() => {
    if (perms == null || permsLoading) {
      return;
    }
    if (!canListLearnerProfiles(perms)) {
      return;
    }
    void loadList();
  }, [perms, permsLoading, loadList]);

  useEffect(() => {
    setSelected(new Set());
  }, [listMeta.page, listMeta.pageSize, applied]);

  const planOptions = useMemo(() => {
    const slugs = new Set(
      (plans as PlanRow[]).map((p) => p.slug)
    );
    for (const it of list) {
      if (it.planSlug) {
        slugs.add(it.planSlug);
      }
    }
    return Array.from(slugs);
  }, [plans, list]);

  const applyFilters = () => {
    setApplied(draft);
    setPage(1);
  };

  const toggleSelect = (id: string, on: boolean) => {
    setSelected((s) => {
      const n = new Set(s);
      if (on) {
        n.add(id);
      } else {
        n.delete(id);
      }
      return n;
    });
  };

  const toggleSelectAllPage = (on: boolean) => {
    if (on) {
      setSelected(new Set(list.map((r) => r.id)));
    } else {
      setSelected(new Set());
    }
  };

  const runBulkStatus = async () => {
    if (selected.size === 0) {
      return;
    }
    if (reason.trim().length < 3) {
      setModalError(t("reasonMin"));
      return;
    }
    setModalBusy(true);
    setModalError(null);
    setBulkMsg(null);
    let ok = 0;
    try {
      for (const id of selected) {
        const res = await adminApiFetch(`/api/admin/users/${id}/status`, {
          body: JSON.stringify({ reason: reason.trim(), status: statusChoice }),
          headers: { "content-type": "application/json" },
          method: "PATCH"
        });
        if (res.ok) {
          ok += 1;
        }
      }
    } finally {
      setModalBusy(false);
    }
    setModal({ kind: "closed" });
    setReason("");
    setBulkMsg(t("bulkStatusDone").replace("{count}", String(ok)));
    await loadList();
    await loadKpis();
  };

  const exportSelected = () => {
    const rows = list.filter((r) => selected.has(r.id));
    if (rows.length === 0) {
      return;
    }
    downloadCsv(
      t("exportFilename"),
      [
        "id",
        "displayName",
        "email",
        "status",
        "plan",
        "locale",
        "lastActivityAt"
      ],
      rows.map((r) => [
        r.id,
        r.displayName,
        r.email ?? "",
        r.accountStatus,
        r.planSlug,
        r.uiLocale,
        r.lastActivityAt
      ])
    );
  };

  const submitStatus = async (userId: string) => {
    if (reason.trim().length < 3) {
      setModalError(t("reasonMin"));
      return;
    }
    setModalBusy(true);
    setModalError(null);
    const res = await adminApiFetch(`/api/admin/users/${userId}/status`, {
      body: JSON.stringify({ reason: reason.trim(), status: statusChoice }),
      headers: { "content-type": "application/json" },
      method: "PATCH"
    });
    setModalBusy(false);
    if (!res.ok) {
      setModalError(t("errorLoad"));
      return;
    }
    setModal({ kind: "closed" });
    setReason("");
    await loadList();
    await loadKpis();
  };

  const submitPlan = async (userId: string) => {
    if (reason.trim().length < 3) {
      setModalError(t("reasonMin"));
      return;
    }
    setModalBusy(true);
    setModalError(null);
    const res = await adminApiFetch(`/api/admin/users/${userId}/plan`, {
      body: JSON.stringify({ planSlug: planChoice, reason: reason.trim() }),
      headers: { "content-type": "application/json" },
      method: "PATCH"
    });
    setModalBusy(false);
    if (!res.ok) {
      setModalError(t("errorLoad"));
      return;
    }
    setModal({ kind: "closed" });
    setReason("");
    void loadList();
    void loadKpis();
  };

  const submitNote = async (userId: string) => {
    if (noteRef.trim().length < 3) {
      setModalError(t("reasonMin"));
      return;
    }
    if (noteBody.trim().length < 1) {
      setModalError(t("noteBodyRequired"));
      return;
    }
    setModalBusy(true);
    setModalError(null);
    const res = await adminApiFetch(`/api/admin/users/${userId}/support-notes`, {
      body: JSON.stringify({ body: noteBody.trim(), reason: noteRef.trim() }),
      headers: { "content-type": "application/json" },
      method: "POST"
    });
    setModalBusy(false);
    if (!res.ok) {
      setModalError(t("errorLoad"));
      return;
    }
    setModal({ kind: "closed" });
    setNoteBody("");
    setNoteRef("");
  };

  if (permsLoading) {
    return (
      <div className="space-y-8">
        <AdminPageHeader description={t("subtitle")} title={t("title")} />
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
          {common.loading}
        </div>
      </div>
    );
  }

  if (perms != null && !canListLearnerProfiles(perms)) {
    return (
      <div className="space-y-6">
        <AdminPageHeader description={t("subtitle")} title={t("title")} />
        <div
          className="rounded-2xl border border-amber-200/90 bg-amber-50/95 px-4 py-3 text-sm text-amber-950 shadow-sm"
          role="alert"
        >
          {t("forbidden")}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <AdminPageHeader
        description={t("subtitle")}
        title={t("title")}
        actions={
          <div className="flex flex-wrap gap-2">
            {canInvite ? (
              <button
                className="inline-flex h-9 items-center justify-center rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
                onClick={() => {
                  setModal({ kind: "create" });
                }}
                type="button"
              >
                {t("inviteTitle")}
              </button>
            ) : null}
            <button
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-sm hover:bg-slate-50"
              onClick={() => {
                void loadKpis();
                void loadList();
              }}
              type="button"
            >
              {form.refresh}
            </button>
          </div>
        }
      />

      {forbidden ? (
        <div
          className="rounded-2xl border border-amber-200/90 bg-amber-50/95 px-4 py-3 text-sm text-amber-950 shadow-sm"
          role="alert"
        >
          {t("forbidden")}
        </div>
      ) : null}
      {listError ? (
        <div
          className="rounded-2xl border border-red-200/90 bg-red-50/90 px-4 py-3 text-sm text-red-900 shadow-sm"
          role="alert"
        >
          {listError}
        </div>
      ) : null}
      {bulkMsg ? (
        <div
          className="rounded-2xl border border-emerald-200/80 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-900 shadow-sm"
          role="status"
        >
          {bulkMsg}
        </div>
      ) : null}
      {readOnlyCreate ? (
        <div
          className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-700"
          role="status"
        >
          {form.readOnlyHint}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <AdminKpiCard
          label={t("kpiTotal")}
          value={kpis == null ? "—" : kpis.totalUsers.toLocaleString()}
        />
        <AdminKpiCard
          label={t("kpiActiveLearners")}
          value={kpis == null ? "—" : kpis.activeLearners.toLocaleString()}
        />
        <AdminKpiCard
          label={t("kpiPaid")}
          tone="good"
          value={kpis == null ? "—" : kpis.paidUsers.toLocaleString()}
        />
        <AdminKpiCard
          label={t("kpiSuspended")}
          tone="danger"
          value={kpis == null ? "—" : kpis.suspendedOrDisabled.toLocaleString()}
        />
        <AdminKpiCard
          label={t("kpiOnboarding")}
          tone="warning"
          value={kpis == null ? "—" : kpis.onboardingIncomplete.toLocaleString()}
        />
      </div>

      <AdminSection
        description={
          <div className="text-xs text-slate-500">
            {t("roleFilterNotAvailable")}
          </div>
        }
        title={t("filterSectionTitle")}
      >
        <AdminFilterBar>
          <div className="grid w-full gap-3 md:grid-cols-2 lg:grid-cols-4">
            <label className="block min-w-0 text-xs font-medium text-slate-600">
              {t("filterSearch")}
              <AdminSearchInput
                className="mt-1 w-full"
                onChange={(e) => {
                  setDraft((d) => ({ ...d, q: e.target.value }));
                }}
                value={draft.q}
              />
            </label>
            <label className="block min-w-0 text-xs font-medium text-slate-600">
              {t("filterStatus")}
              <AdminSelect
                className="mt-1 w-full"
                onChange={(e) => {
                  setDraft((d) => ({ ...d, status: e.target.value }));
                }}
                value={draft.status}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s === "all" ? t("filterAllStatuses") : s}
                  </option>
                ))}
              </AdminSelect>
            </label>
            <label className="block min-w-0 text-xs font-medium text-slate-600">
              {t("filterPlan")}
              <AdminSelect
                className="mt-1 w-full"
                onChange={(e) => {
                  setDraft((d) => ({ ...d, plan: e.target.value }));
                }}
                value={draft.plan}
              >
                <option value="all">{t("filterAllPlans")}</option>
                <option value="free">free (default)</option>
                {planOptions
                  .filter((s) => s !== "free")
                  .map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
              </AdminSelect>
            </label>
            <label className="block min-w-0 text-xs font-medium text-slate-600">
              {t("filterLocale")}
              <AdminSelect
                className="mt-1 w-full"
                onChange={(e) => {
                  setDraft((d) => ({ ...d, uiLocale: e.target.value }));
                }}
                value={draft.uiLocale}
              >
                <option value="all">{t("filterAllLocales")}</option>
                <option value="vi">vi</option>
                <option value="ja">ja</option>
              </AdminSelect>
            </label>
            <label className="block min-w-0 text-xs font-medium text-slate-600">
              {t("colLastActive")} (from)
              <input
                className={fieldClass}
                onChange={(e) => {
                  setDraft((d) => ({ ...d, lastActiveAfter: e.target.value }));
                }}
                type="datetime-local"
                value={draft.lastActiveAfter}
              />
            </label>
            <label className="block min-w-0 text-xs font-medium text-slate-600">
              {t("colLastActive")} (to)
              <input
                className={fieldClass}
                onChange={(e) => {
                  setDraft((d) => ({ ...d, lastActiveBefore: e.target.value }));
                }}
                type="datetime-local"
                value={draft.lastActiveBefore}
              />
            </label>
            <div className="flex items-end">
              <button
                className="h-9 w-full rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50 md:max-w-xs"
                onClick={applyFilters}
                type="button"
              >
                {t("applyFilters")}
              </button>
            </div>
            <div className="flex flex-col justify-end text-xs text-slate-500">
              {t("pageSize")}
              <AdminSelect
                className="mt-1 w-full"
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                value={String(pageSize)}
              >
                {[10, 20, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </AdminSelect>
            </div>
          </div>
        </AdminFilterBar>
      </AdminSection>

      {selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-indigo-100 bg-indigo-50/50 px-4 py-3 text-sm text-indigo-950">
          <span className="font-medium text-indigo-900">
            {selected.size} {t("selectedCount")}
          </span>
          <button
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs"
            onClick={exportSelected}
            type="button"
          >
            {t("bulkExport")}
          </button>
          {canWrite ? (
            <button
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs"
              onClick={() => {
                setReason("");
                setStatusChoice("suspended");
                setModalError(null);
                setModal({ kind: "bulkStatus" });
              }}
              type="button"
            >
              {t("bulkChangeStatus")}
            </button>
          ) : null}
          <span className="text-xs text-slate-600">{t("bulkNotifyUnsupported")}</span>
        </div>
      ) : null}

      <AdminSection title={form.listSectionTitle}>
        {listLoading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
          {common.loading}
        </div>
      ) : list.length === 0 && !forbidden && listError == null ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <AdminEmptyState title={t("emptyList")} />
        </div>
      ) : !forbidden && listError == null ? (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <AdminDataTable>
            <AdminDataTableHead>
              <AdminDataTableRow>
                <AdminDataTableTh className="w-10">
                  <input
                    aria-label={t("selectAll")}
                    checked={
                      list.length > 0 && list.every((r) => selected.has(r.id))
                    }
                    onChange={(e) => {
                      toggleSelectAllPage(e.target.checked);
                    }}
                    type="checkbox"
                  />
                </AdminDataTableTh>
                <AdminDataTableTh>{t("colUser")}</AdminDataTableTh>
                <AdminDataTableTh>{t("colEmail")}</AdminDataTableTh>
                <AdminDataTableTh>{t("colStatus")}</AdminDataTableTh>
                <AdminDataTableTh>{t("colAccountType")}</AdminDataTableTh>
                <AdminDataTableTh>{t("colAuthSync")}</AdminDataTableTh>
                <AdminDataTableTh>{t("colPlan")}</AdminDataTableTh>
                <AdminDataTableTh>{t("colRoles")}</AdminDataTableTh>
                <AdminDataTableTh>{t("colLearning")}</AdminDataTableTh>
                <AdminDataTableTh>{t("colQuota")}</AdminDataTableTh>
                <AdminDataTableTh>{t("colLastActive")}</AdminDataTableTh>
                <AdminDataTableTh>{t("colCreated")}</AdminDataTableTh>
                <AdminDataTableTh className="text-right">{t("actions")}</AdminDataTableTh>
              </AdminDataTableRow>
            </AdminDataTableHead>
            <AdminDataTableBody>
              {list.map((u) => (
                <AdminDataTableRow key={u.id}>
                  <AdminDataTableTd>
                    <input
                      checked={selected.has(u.id)}
                      onChange={(e) => {
                        toggleSelect(u.id, e.target.checked);
                      }}
                      type="checkbox"
                    />
                  </AdminDataTableTd>
                  <AdminDataTableTd>
                    <button
                      className="text-left font-medium text-indigo-800 hover:underline"
                      onClick={() => {
                        router.push(`/${locale}/users/360?id=${u.id}`);
                      }}
                      type="button"
                    >
                      {u.displayName}
                    </button>
                  </AdminDataTableTd>
                  <AdminDataTableTd muted>{u.email ?? "—"}</AdminDataTableTd>
                    <AdminDataTableTd>
                      <AdminStatusBadge tone={accountStatusTone(u.accountStatus)}>
                        {u.accountStatus}
                      </AdminStatusBadge>
                    </AdminDataTableTd>
                    <AdminDataTableTd muted>
                      {accTypeLabel(u.accountType)}
                    </AdminDataTableTd>
                    <AdminDataTableTd muted>
                      {authSyncLabel(u.authSyncStatus)}
                    </AdminDataTableTd>
                    <AdminDataTableTd>
                      <AdminStatusBadge tone={planBadgeTone(u.planSlug)}>
                      {u.planSlug}
                    </AdminStatusBadge>
                    <div className="text-[10px] text-slate-500">
                      {u.planSource}
                    </div>
                  </AdminDataTableTd>
                  <AdminDataTableTd muted>
                    {u.providerSummary}
                  </AdminDataTableTd>
                  <AdminDataTableTd muted>
                    {u.learningSummary.hasDue ? (
                      <span
                        className={cn(
                          "font-medium",
                          u.learningSummary.dueFlashcards > 0
                            ? "text-amber-800"
                            : "text-ink"
                        )}
                      >
                        {t("dueFlashcards")}: {u.learningSummary.dueFlashcards}
                      </span>
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </AdminDataTableTd>
                  <AdminDataTableTd>
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={cn(
                            "h-1.5 rounded-full",
                            u.quota.warning
                              ? "bg-amber-500"
                              : "bg-emerald-500"
                          )}
                          style={{
                            width: `${Math.min(
                              100,
                              u.quota.limit > 0
                                ? (u.quota.used / u.quota.limit) * 100
                                : 0
                            )}%`
                          }}
                        />
                      </div>
                      {u.quota.warning ? (
                        <span
                          className="text-[10px] font-medium text-amber-800"
                          title="≥90%"
                        >
                          !
                        </span>
                      ) : null}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {u.quota.used}/{u.quota.limit}
                    </div>
                  </AdminDataTableTd>
                  <AdminDataTableTd muted>
                    {formatWhen(u.lastActivityAt, locale)}
                  </AdminDataTableTd>
                  <AdminDataTableTd muted>
                    {formatWhen(u.createdAt, locale)}
                  </AdminDataTableTd>
                  <AdminDataTableTd>
                    <AdminDataTableCellActions>
                      <button
                        className="text-xs font-medium text-indigo-800"
                        onClick={() => {
                          router.push(`/${locale}/users/360?id=${u.id}`);
                        }}
                        type="button"
                      >
                        {t("viewDetails")}
                      </button>
                      {canWrite ? (
                        <button
                          className="text-xs text-slate-800"
                          onClick={() => {
                            setStatusChoice(
                              u.accountStatus === "active"
                                ? "suspended"
                                : "active"
                            );
                            setReason("");
                            setModalError(null);
                            setModal({
                              id: u.id,
                              kind: "status",
                              name: u.displayName
                            });
                          }}
                          type="button"
                        >
                          {t("changeStatus")}
                        </button>
                      ) : null}
                      {canMWrite ? (
                        <button
                          className="text-xs text-slate-800"
                          onClick={() => {
                            setPlanChoice(u.planSlug);
                            setReason("");
                            setModalError(null);
                            setModal({
                              id: u.id,
                              kind: "plan",
                              name: u.displayName
                            });
                          }}
                          type="button"
                        >
                          {t("changePlan")}
                        </button>
                      ) : null}
                      {canWrite ? (
                        <button
                          className="text-xs text-slate-800"
                          onClick={() => {
                            setNoteBody("");
                            setNoteRef("");
                            setModalError(null);
                            setModal({
                              id: u.id,
                              kind: "note",
                              name: u.displayName
                            });
                          }}
                          type="button"
                        >
                          {t("addSupportNote")}
                        </button>
                      ) : null}
                    </AdminDataTableCellActions>
                    <div className="mt-1 text-[10px] text-slate-500">
                      {t("quotaResetUnavailable")}
                    </div>
                  </AdminDataTableTd>
                </AdminDataTableRow>
              ))}
            </AdminDataTableBody>
          </AdminDataTable>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink/8 px-3 py-2 text-sm text-slate-600">
            <span>
              {t("paginationSummary")
                .replace("{{total}}", String(listMeta.total))
                .replace(
                  "{{page}}",
                  String(listMeta.page)
                )
                .replace(
                  "{{pages}}",
                  String(
                    Math.max(1, Math.ceil(listMeta.total / listMeta.pageSize))
                  )
                )}
            </span>
            <div className="flex gap-2">
              <button
                className="rounded border border-slate-200 bg-white px-2 py-1 text-xs disabled:opacity-40"
                disabled={page <= 1}
                onClick={() => {
                  setPage((p) => Math.max(1, p - 1));
                }}
                type="button"
              >
                ←
              </button>
              <button
                className="rounded border border-slate-200 bg-white px-2 py-1 text-xs disabled:opacity-40"
                disabled={
                  page * listMeta.pageSize >= listMeta.total
                }
                onClick={() => {
                  setPage((p) => p + 1);
                }}
                type="button"
              >
                →
              </button>
            </div>
          </div>
        </div>
      ) : null}
      </AdminSection>

      {modal.kind === "create" && canInvite ? (
        <UserInviteModal
          canMonetizationWrite={canMWrite}
          onClose={() => {
            setModal({ kind: "closed" });
          }}
          onSuccess={() => {
            void loadList();
            void loadKpis();
          }}
          um={um as Record<string, string>}
        />
      ) : null}

      {modal.kind === "status" && canWrite ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
        >
          <div className="w-full max-w-md rounded-2xl border border-ink/10 bg-white p-5 shadow-lg">
            <h3 className="text-base font-semibold text-ink">
              {t("changeStatus")} — {modal.name}
            </h3>
            {modalError ? (
              <p className="mt-2 text-sm text-red-700">{modalError}</p>
            ) : null}
            <label className="mt-3 block text-sm">
              {t("fieldStatus")}
              <AdminSelect
                className="mt-1 w-full"
                onChange={(e) => {
                  setStatusChoice(e.target.value);
                }}
                value={statusChoice}
              >
                {(
                  [
                    "active",
                    "pending",
                    "disabled",
                    "suspended",
                    "deleted"
                  ] as const
                ).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </AdminSelect>
            </label>
            <label className="mt-2 block text-sm">
              {t("noteReason")}
              <textarea
                className={cn(fieldClass, "min-h-[72px]")}
                onChange={(e) => {
                  setReason(e.target.value);
                }}
                value={reason}
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="rounded-lg border px-3 py-1.5 text-sm"
                onClick={() => {
                  setModal({ kind: "closed" });
                }}
                type="button"
              >
                {t("cancel")}
              </button>
              <button
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white"
                disabled={modalBusy}
                onClick={() => {
                  void submitStatus(modal.id);
                }}
                type="button"
              >
                {t("save")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {modal.kind === "plan" && canMWrite ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
        >
          <div className="w-full max-w-md rounded-2xl border border-ink/10 bg-white p-5 shadow-lg">
            <h3 className="text-base font-semibold text-ink">
              {t("assignPlan")} — {modal.name}
            </h3>
            {modalError ? (
              <p className="mt-2 text-sm text-red-700">{modalError}</p>
            ) : null}
            <label className="mt-3 block text-sm">
              {t("colPlan")}
              {planOptions.length > 0 ? (
                <AdminSelect
                  className="mt-1 w-full"
                  onChange={(e) => {
                    setPlanChoice(e.target.value);
                  }}
                  value={planChoice}
                >
                  {planOptions.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </AdminSelect>
              ) : (
                <input
                  className={fieldClass}
                  onChange={(e) => {
                    setPlanChoice(e.target.value);
                  }}
                  value={planChoice}
                />
              )}
            </label>
            <label className="mt-2 block text-sm">
              {t("noteReason")}
              <textarea
                className={cn(fieldClass, "min-h-[72px]")}
                onChange={(e) => {
                  setReason(e.target.value);
                }}
                value={reason}
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="rounded-lg border px-3 py-1.5 text-sm"
                onClick={() => {
                  setModal({ kind: "closed" });
                }}
                type="button"
              >
                {t("cancel")}
              </button>
              <button
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white"
                disabled={modalBusy}
                onClick={() => {
                  void submitPlan(modal.id);
                }}
                type="button"
              >
                {t("save")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {modal.kind === "note" && canWrite ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
        >
          <div className="w-full max-w-md rounded-2xl border border-ink/10 bg-white p-5 shadow-lg">
            <h3 className="text-base font-semibold text-ink">
              {t("addSupportNote")} — {modal.name}
            </h3>
            {modalError ? (
              <p className="mt-2 text-sm text-red-700">{modalError}</p>
            ) : null}
            <label className="mt-2 block text-sm">
              {t("noteBody")}
              <textarea
                className={cn(fieldClass, "min-h-[88px]")}
                onChange={(e) => {
                  setNoteBody(e.target.value);
                }}
                value={noteBody}
              />
            </label>
            <label className="mt-2 block text-sm">
              {t("noteReason")} (audit)
              <input
                className={fieldClass}
                onChange={(e) => {
                  setNoteRef(e.target.value);
                }}
                value={noteRef}
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="rounded-lg border px-3 py-1.5 text-sm"
                onClick={() => {
                  setModal({ kind: "closed" });
                }}
                type="button"
              >
                {t("cancel")}
              </button>
              <button
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white"
                disabled={modalBusy}
                onClick={() => {
                  void submitNote(modal.id);
                }}
                type="button"
              >
                {t("save")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {modal.kind === "bulkStatus" && canWrite ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
        >
          <div className="w-full max-w-md rounded-2xl border border-ink/10 bg-white p-5 shadow-lg">
            <h3 className="text-base font-semibold text-ink">
              {t("bulkChangeStatus")} ({selected.size})
            </h3>
            {modalError ? (
              <p className="mt-2 text-sm text-red-700">{modalError}</p>
            ) : null}
            {bulkWorking ? <p className="text-sm">{t("bulkInProgress")}</p> : null}
            <label className="mt-3 block text-sm">
              {t("fieldStatus")}
              <AdminSelect
                className="mt-1 w-full"
                onChange={(e) => {
                  setStatusChoice(e.target.value);
                }}
                value={statusChoice}
              >
                {(
                  [
                    "active",
                    "pending",
                    "disabled",
                    "suspended",
                    "deleted"
                  ] as const
                ).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </AdminSelect>
            </label>
            <label className="mt-2 block text-sm">
              {t("noteReason")}
              <textarea
                className={cn(fieldClass, "min-h-[72px]")}
                onChange={(e) => {
                  setReason(e.target.value);
                }}
                value={reason}
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="rounded-lg border px-3 py-1.5 text-sm"
                onClick={() => {
                  setModal({ kind: "closed" });
                }}
                type="button"
              >
                {t("cancel")}
              </button>
              <button
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white"
                disabled={modalBusy}
                onClick={() => {
                  setBulkWorking(true);
                  void runBulkStatus().finally(() => {
                    setBulkWorking(false);
                  });
                }}
                type="button"
              >
                {t("confirm")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

    </div>
  );
}
