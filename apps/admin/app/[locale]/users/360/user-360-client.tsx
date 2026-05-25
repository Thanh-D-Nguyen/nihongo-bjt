"use client";

import {
  AdminEmptyState,
  AdminPageHeader,
  AdminSection,
  AdminSelect,
  AdminStatusBadge,
  cn
} from "@nihongo-bjt/ui";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { adminApiFetch } from "@/lib/admin-api";

type UserDetail = {
  learning: {
    bjtBandEstimate: string | null;
    dueFlashcards: number;
    onboarding: { currentStep: string | null; onboardedAt: string | null } | null;
    reviewEvents7d: number;
    streak: null;
  };
  loginEvents: Array<{
    createdAt: string;
    eventType: string;
    id: string;
    metadata: unknown;
    provider: string;
  }>;
  plan: {
    entitlements: string[];
    periodEnd: string | null;
    planNameKey: string;
    planSlug: string;
    quotas: Array<{ key: string; limit: number | null; used: number; window: string }>;
    source: string;
    status: string;
  };
  profile: {
    accountType?: string;
    authSyncStatus?: string;
    createdAt: string;
    displayName: string;
    email: string | null;
    explanationLocale: string;
    id: string;
    keycloakSubjectMasked: string | null;
    privacyLevel: string;
    status: string;
    targetBjtBand: string | null;
    timezone: string;
    uiLocale: string;
    updatedAt: string;
  };
  providerAccounts: Array<{
    createdAt: string;
    emailAtLink: string | null;
    id: string;
    provider: string;
    providerSubject: string;
  }>;
  supportNotesCapability: { appendViaAudit: true };
  usageCounters: Array<{ id: string; quotaKey: string; value: number; windowKey: string }>;
};

type AuditEntry = {
  action: string;
  actorId: string;
  after: unknown;
  before: unknown;
  createdAt: string;
  id: string;
  reason: string | null;
  targetId: string;
  targetType: string;
};

const TABS = ["overview", "learning", "plan", "sessions", "support", "audit"] as const;
type Tab = (typeof TABS)[number];

type Labels = Record<string, string>;

const fieldClass =
  "mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-ink shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100";

function formatWhen(iso: string, locale: string) {
  try {
    return new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : "vi-VN", {
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      month: "short",
      year: "numeric"
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function maskId(s: string) {
  if (s.length <= 8) return s;
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
}

function statusTone(s: string): "danger" | "good" | "neutral" | "warning" {
  switch (s) {
    case "active":
      return "good";
    case "suspended":
    case "deleted":
      return "danger";
    case "disabled":
    case "pending":
      return "warning";
    default:
      return "neutral";
  }
}

const ACCESS_REASON_TTL_MS = 30 * 60 * 1000;
const ACCESS_REASON_MIN = 8;
const ACCESS_REASON_CATEGORIES = ["compliance", "support", "abuse", "billing", "other"] as const;

type AccessReasonCategory = (typeof ACCESS_REASON_CATEGORIES)[number];

type AccessGrant = {
  category: AccessReasonCategory;
  expiresAt: number;
  reason: string;
};

function readGrant(userId: string): AccessGrant | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(`bjt-user360-grant:${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AccessGrant;
    if (!parsed.reason || parsed.expiresAt < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeGrant(userId: string, grant: AccessGrant) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(`bjt-user360-grant:${userId}`, JSON.stringify(grant));
}

function clearGrant(userId: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(`bjt-user360-grant:${userId}`);
}

function reasonHeaders(grant: AccessGrant): HeadersInit {
  return {
    "x-admin-access-reason": grant.reason,
    "x-admin-access-reason-category": grant.category
  };
}

export function User360Client({
  common,
  locale,
  um
}: {
  common: { error: string; loading: string };
  locale: string;
  um: Labels;
}) {
  const t = (k: string) => um[k] ?? k;
  const searchParams = useSearchParams();
  const initialId = (searchParams?.get("id") ?? "").trim();

  const [query, setQuery] = useState(initialId);
  const [targetId, setTargetId] = useState<string | null>(initialId.length > 0 ? initialId : null);
  const [grant, setGrant] = useState<AccessGrant | null>(null);
  const [reasonModalOpen, setReasonModalOpen] = useState(false);
  const [reasonText, setReasonText] = useState("");
  const [reasonCategory, setReasonCategory] = useState<AccessReasonCategory>("support");
  const [reasonError, setReasonError] = useState<string | null>(null);

  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");

  const lookupUser = useCallback(
    async (userId: string, activeGrant: AccessGrant) => {
      setLoading(true);
      setError(null);
      setDetail(null);
      setAudit([]);
      setTab("overview");
      try {
        const [rUser, rAudit] = await Promise.all([
          adminApiFetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
            headers: reasonHeaders(activeGrant)
          }),
          adminApiFetch(
            `/api/admin/users/${encodeURIComponent(userId)}/audit?limit=80`,
            { headers: reasonHeaders(activeGrant) }
          )
        ]);
        if (rUser.status === 404) {
          setError(t("user360NotFound"));
          return;
        }
        if (rUser.status === 403) {
          // Either privacy gate rejected or perms missing — invalidate grant and re-prompt.
          clearGrant(userId);
          setGrant(null);
          setReasonModalOpen(true);
          setError(t("user360AccessReasonExpired"));
          return;
        }
        if (!rUser.ok) {
          setError(common.error);
          return;
        }
        setDetail((await rUser.json()) as UserDetail);
        if (rAudit.ok) {
          setAudit((await rAudit.json()) as AuditEntry[]);
        }
      } catch {
        setError(common.error);
      } finally {
        setLoading(false);
      }
    },
    [common.error, t]
  );

  // Bootstrap: if URL has ?id= or last targetId, hydrate grant or open modal.
  useEffect(() => {
    if (!targetId) return;
    const existing = readGrant(targetId);
    if (existing) {
      setGrant(existing);
      void lookupUser(targetId, existing);
    } else {
      setReasonModalOpen(true);
    }
    // react-hooks not configured for this app, intentional dep list
  }, [targetId]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    setTargetId(trimmed);
    setError(null);
  };

  const handleReset = () => {
    if (targetId) clearGrant(targetId);
    setTargetId(null);
    setGrant(null);
    setDetail(null);
    setAudit([]);
    setError(null);
    setQuery("");
    setReasonModalOpen(false);
    setReasonText("");
    setReasonCategory("support");
    setReasonError(null);
  };

  const submitAccessReason = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetId) return;
    const trimmed = reasonText.trim();
    if (trimmed.length < ACCESS_REASON_MIN) {
      setReasonError(t("user360ReasonRequired"));
      return;
    }
    const newGrant: AccessGrant = {
      category: reasonCategory,
      expiresAt: Date.now() + ACCESS_REASON_TTL_MS,
      reason: trimmed
    };
    writeGrant(targetId, newGrant);
    setGrant(newGrant);
    setReasonModalOpen(false);
    setReasonText("");
    setReasonError(null);
    void lookupUser(targetId, newGrant);
  };

  const grantTimeLeft = useMemo(() => {
    if (!grant) return null;
    const ms = grant.expiresAt - Date.now();
    if (ms <= 0) return null;
    return Math.ceil(ms / 60000);
  }, [grant, detail]);

  // Support note modal state
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteBody, setNoteBody] = useState("");
  const [noteRef, setNoteRef] = useState("");
  const [noteBusy, setNoteBusy] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);

  // Admin action modals (status change, plan change)
  const [actionModal, setActionModal] = useState<
    | { kind: "closed" }
    | { kind: "status" }
    | { kind: "plan" }
  >({ kind: "closed" });
  const [actionStatusChoice, setActionStatusChoice] = useState("active");
  const [actionPlanChoice, setActionPlanChoice] = useState("free");
  const [actionReason, setActionReason] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const submitNote = async () => {
    if (!detail || !grant) return;
    if (noteRef.trim().length < 3) {
      setNoteError(t("reasonMin"));
      return;
    }
    if (noteBody.trim().length < 1) {
      setNoteError(t("noteBodyRequired"));
      return;
    }
    setNoteBusy(true);
    setNoteError(null);
    const res = await adminApiFetch(
      `/api/admin/users/${encodeURIComponent(detail.profile.id)}/support-notes`,
      {
        body: JSON.stringify({ body: noteBody.trim(), reason: noteRef.trim() }),
        headers: { "content-type": "application/json", ...reasonHeaders(grant) },
        method: "POST"
      }
    );
    setNoteBusy(false);
    if (!res.ok) {
      setNoteError(common.error);
      return;
    }
    setNoteOpen(false);
    setNoteBody("");
    setNoteRef("");
    void lookupUser(detail.profile.id, grant);
  };

  const submitStatusChange = async () => {
    if (!detail || !grant) return;
    if (actionReason.trim().length < 3) {
      setActionError(t("reasonMin"));
      return;
    }
    setActionBusy(true);
    setActionError(null);
    const res = await adminApiFetch(
      `/api/admin/users/${encodeURIComponent(detail.profile.id)}/status`,
      {
        body: JSON.stringify({ reason: actionReason.trim(), status: actionStatusChoice }),
        headers: { "content-type": "application/json", ...reasonHeaders(grant) },
        method: "PATCH"
      }
    );
    setActionBusy(false);
    if (!res.ok) {
      setActionError(common.error);
      return;
    }
    setActionModal({ kind: "closed" });
    setActionReason("");
    void lookupUser(detail.profile.id, grant);
  };

  const submitPlanChange = async () => {
    if (!detail || !grant) return;
    if (actionReason.trim().length < 3) {
      setActionError(t("reasonMin"));
      return;
    }
    setActionBusy(true);
    setActionError(null);
    const res = await adminApiFetch(
      `/api/admin/users/${encodeURIComponent(detail.profile.id)}/plan`,
      {
        body: JSON.stringify({ planSlug: actionPlanChoice, reason: actionReason.trim() }),
        headers: { "content-type": "application/json", ...reasonHeaders(grant) },
        method: "PATCH"
      }
    );
    setActionBusy(false);
    if (!res.ok) {
      setActionError(common.error);
      return;
    }
    setActionModal({ kind: "closed" });
    setActionReason("");
    void lookupUser(detail.profile.id, grant);
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        description={t("user360Subtitle")}
        title={t("user360Title")}
        actions={
          targetId ? (
            <button
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-sm hover:bg-slate-50"
              onClick={handleReset}
              type="button"
            >
              {t("user360NewSearch")}
            </button>
          ) : undefined
        }
      />

      {!targetId ? (
        <AdminSection title={t("user360SearchTitle")}>
          <p className="mb-3 text-xs text-slate-600">
            {t("user360SearchHint")}
          </p>
          <form className="space-y-4" onSubmit={handleSearch}>
            <label className="block text-sm font-medium text-slate-700">
              {t("user360SearchLabel")}
              <input
                autoFocus
                className={fieldClass}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("user360SearchPlaceholder")}
                value={query}
              />
            </label>
            <button
              className="inline-flex h-9 items-center justify-center rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 disabled:opacity-50"
              disabled={!query.trim()}
              type="submit"
            >
              {t("user360Lookup")}
            </button>
          </form>
        </AdminSection>
      ) : null}

      {targetId && loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
          {common.loading}
        </div>
      ) : null}

      {targetId && error && !reasonModalOpen ? (
        <div className="rounded-2xl border border-red-200/90 bg-red-50/90 px-4 py-3 text-sm text-red-900 shadow-sm">
          {error}
        </div>
      ) : null}

      {targetId && detail && grant ? (
        <>
          <AdminSection title={`${detail.profile.displayName} — ${detail.profile.email ?? detail.profile.id}`}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-100 bg-amber-50/50 px-3 py-2 text-xs text-amber-900">
              <div>
                <span className="font-semibold">{t("user360AccessReasonLabel")}:</span>{" "}
                <span className="font-mono">[{t(`user360AccessReasonCategory_${grant.category}`)}]</span>{" "}
                {grant.reason}
                {grantTimeLeft != null ? (
                  <span className="ml-2 text-amber-700">
                    {t("user360AccessReasonTimeLeft").replace("{{minutes}}", String(grantTimeLeft))}
                  </span>
                ) : null}
              </div>
              <button
                className="rounded border border-amber-200 bg-white px-2 py-0.5 text-[11px] text-amber-900 hover:bg-amber-50"
                onClick={() => {
                  if (targetId) clearGrant(targetId);
                  setGrant(null);
                  setReasonText("");
                  setReasonError(null);
                  setReasonModalOpen(true);
                }}
                type="button"
              >
                {t("user360AccessReasonChange")}
              </button>
            </div>
            <div className="flex flex-wrap gap-1">
              {TABS.map((tb) => (
                <button
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium",
                    tab === tb
                      ? "bg-indigo-600 text-white"
                      : "border border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
                  )}
                  key={tb}
                  onClick={() => setTab(tb)}
                  type="button"
                >
                  {t(`tab360_${tb}`)}
                </button>
              ))}
            </div>
          </AdminSection>

          {tab === "overview" ? (
            <AdminSection title={t("tab360_overview")}>
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <span className="text-slate-500">{t("overviewName")}</span>{" "}
                  <span className="font-medium">{detail.profile.displayName}</span>
                </div>
                <div>
                  <span className="text-slate-500">{t("overviewEmail")}</span>{" "}
                  {detail.profile.email ?? "—"}
                </div>
                <div>
                  <span className="text-slate-500">{t("overviewAccountType")}</span>{" "}
                  {detail.profile.accountType ?? "learner"}
                </div>
                <div>
                  <span className="text-slate-500">{t("overviewAuthSync")}</span>{" "}
                  {detail.profile.authSyncStatus ?? "—"}
                </div>
                <div>
                  <span className="text-slate-500">{t("overviewStatus")}</span>{" "}
                  <AdminStatusBadge tone={statusTone(detail.profile.status)}>
                    {detail.profile.status}
                  </AdminStatusBadge>
                </div>
                <div>
                  <span className="text-slate-500">{t("overviewKeycloak")}</span>{" "}
                  {detail.profile.keycloakSubjectMasked ?? "—"}
                </div>
                <div>
                  <span className="text-slate-500">{t("overviewLocale")}</span>{" "}
                  {detail.profile.uiLocale} / {detail.profile.explanationLocale}
                </div>
                <div>
                  <span className="text-slate-500">{t("overviewTimezone")}</span>{" "}
                  {detail.profile.timezone}
                </div>
                <div>
                  <span className="text-slate-500">{t("overviewPlan")}</span>{" "}
                  {detail.plan.planSlug} ({detail.plan.status})
                </div>
                <div>
                  <span className="text-slate-500">{t("overviewLast")}</span>{" "}
                  {formatWhen(detail.profile.updatedAt, locale)}
                </div>
                <div>
                  <span className="text-slate-500">{t("overviewPrivacyLevel")}</span>{" "}
                  {detail.profile.privacyLevel}
                </div>
                <div>
                  <span className="text-slate-500">{t("overviewCreated")}</span>{" "}
                  {formatWhen(detail.profile.createdAt, locale)}
                </div>
              </div>
              {detail.providerAccounts.length > 0 ? (
                <div className="mt-4">
                  <h4 className="text-xs font-semibold text-slate-600">{t("user360Providers")}</h4>
                  <ul className="mt-1 list-inside list-disc space-y-1 text-sm">
                    {detail.providerAccounts.map((a) => (
                      <li key={a.id}>
                        {a.provider} — {maskId(a.providerSubject)}
                        {a.emailAtLink ? ` (${a.emailAtLink})` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                <button
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 shadow-sm hover:bg-slate-50"
                  onClick={() => {
                    setActionStatusChoice(detail.profile.status);
                    setActionReason("");
                    setActionError(null);
                    setActionModal({ kind: "status" });
                  }}
                  type="button"
                >
                  {t("user360ChangeStatus")}
                </button>
                <button
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 shadow-sm hover:bg-slate-50"
                  onClick={() => {
                    setActionPlanChoice(detail.plan.planSlug);
                    setActionReason("");
                    setActionError(null);
                    setActionModal({ kind: "plan" });
                  }}
                  type="button"
                >
                  {t("user360ChangePlan")}
                </button>
              </div>
            </AdminSection>
          ) : null}

          {tab === "learning" ? (
            <AdminSection title={t("tab360_learning")}>
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <span className="text-slate-500">{t("dueFlashcards")}</span>{" "}
                  {detail.learning.dueFlashcards}
                </div>
                <div>
                  <span className="text-slate-500">{t("reviews7d")}</span>{" "}
                  {detail.learning.reviewEvents7d}
                </div>
                <div>
                  <span className="text-slate-500">{t("onboardingStep")}</span>{" "}
                  {detail.learning.onboarding
                    ? detail.learning.onboarding.onboardedAt
                      ? t("onboardingDone")
                      : String(detail.learning.onboarding.currentStep)
                    : "—"}
                </div>
                <div>
                  <span className="text-slate-500">{t("targetBand")}</span>{" "}
                  {detail.learning.bjtBandEstimate ?? detail.profile.targetBjtBand ?? "—"}
                </div>
              </div>
            </AdminSection>
          ) : null}

          {tab === "plan" ? (
            <AdminSection title={t("tab360_plan")}>
              <div className="space-y-3 text-sm">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <span className="text-slate-500">{t("overviewPlan")}</span>{" "}
                    {detail.plan.planSlug} ({detail.plan.status})
                  </div>
                  <div>
                    <span className="text-slate-500">{t("periodEnd")}</span>{" "}
                    {detail.plan.periodEnd ? formatWhen(detail.plan.periodEnd, locale) : "—"}
                  </div>
                </div>
                <div className="text-xs text-slate-600">
                  {t("entitlements")}: {detail.plan.entitlements.join(", ") || "—"}
                </div>
                {detail.plan.quotas.length > 0 ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {detail.plan.quotas.map((q) => (
                      <div className="rounded-lg border border-slate-200 p-2" key={q.key}>
                        <div className="text-xs font-medium text-slate-800">
                          {q.key} ({q.window})
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-1.5 rounded-full bg-emerald-500"
                            style={{
                              width: `${Math.min(100, (q.limit ?? 0) > 0 ? (q.used / (q.limit ?? 1)) * 100 : 0)}%`
                            }}
                          />
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {t("quotaUsed")} {q.used} / {t("quotaLimit")} {q.limit ?? "—"}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
                {detail.usageCounters.length > 0 ? (
                  <div className="mt-2">
                    <h4 className="text-xs font-semibold text-slate-600">{t("user360UsageCounters")}</h4>
                    <ul className="mt-1 space-y-1 text-xs">
                      {detail.usageCounters.map((uc) => (
                        <li className="text-slate-700" key={uc.id}>
                          {uc.quotaKey} ({uc.windowKey}): {uc.value}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </AdminSection>
          ) : null}

          {tab === "sessions" ? (
            <AdminSection title={t("tab360_sessions")}>
              {detail.loginEvents.length === 0 ? (
                <AdminEmptyState title={t("emptySessions")} />
              ) : (
                <ul className="space-y-2">
                  {detail.loginEvents.map((e) => (
                    <li className="rounded border border-slate-200 p-2 text-xs" key={e.id}>
                      <div>{t("loginAt")} {formatWhen(e.createdAt, locale)}</div>
                      <div>{t("loginProvider")} {e.provider} · {t("sessionEvent")} {e.eventType}</div>
                    </li>
                  ))}
                </ul>
              )}
            </AdminSection>
          ) : null}

          {tab === "support" ? (
            <AdminSection title={t("tab360_support")}>
              {audit.filter((a) => a.action === "admin.user.support_note").length === 0 ? (
                <AdminEmptyState title={t("emptyNotes")} />
              ) : (
                <ul className="space-y-2">
                  {audit
                    .filter((a) => a.action === "admin.user.support_note")
                    .map((a) => (
                      <li className="rounded border border-amber-100 bg-amber-50/50 p-2 text-xs" key={a.id}>
                        <div className="font-medium text-slate-700">{formatWhen(a.createdAt, locale)}</div>
                        <div className="mt-1 text-slate-800">
                          {typeof a.after === "object" && a.after !== null && "body" in a.after
                            ? String((a.after as { body: string }).body)
                            : JSON.stringify(a.after)}
                        </div>
                        {a.reason ? (
                          <div className="mt-1 text-slate-500">{t("noteReason")}: {a.reason}</div>
                        ) : null}
                      </li>
                    ))}
                </ul>
              )}
              <button
                className="mt-3 text-xs font-medium text-indigo-800 hover:underline"
                onClick={() => {
                  setNoteOpen(true);
                  setNoteBody("");
                  setNoteRef("");
                  setNoteError(null);
                }}
                type="button"
              >
                {t("addSupportNote")}
              </button>
            </AdminSection>
          ) : null}

          {tab === "audit" ? (
            <AdminSection title={t("tab360_audit")}>
              {audit.length === 0 ? (
                <AdminEmptyState title={t("emptyAudit")} />
              ) : (
                <ul className="max-h-96 space-y-2 overflow-y-auto pr-1">
                  {audit.map((a) => (
                    <li className="rounded border border-slate-200 p-2 text-xs" key={a.id}>
                      <div className="font-mono text-[11px] text-slate-500">{a.action}</div>
                      <div className="text-slate-700">
                        {formatWhen(a.createdAt, locale)} · {a.reason ?? "—"}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </AdminSection>
          ) : null}
        </>
      ) : null}

      {noteOpen && detail ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
        >
          <div className="w-full max-w-md rounded-2xl border border-ink/10 bg-white p-5 shadow-lg">
            <h3 className="text-base font-semibold text-ink">
              {t("addSupportNote")} — {detail.profile.displayName}
            </h3>
            {noteError ? <p className="mt-2 text-sm text-red-700">{noteError}</p> : null}
            <label className="mt-2 block text-sm">
              {t("noteBody")}
              <textarea
                className={cn(fieldClass, "min-h-[88px]")}
                onChange={(e) => setNoteBody(e.target.value)}
                value={noteBody}
              />
            </label>
            <label className="mt-2 block text-sm">
              {t("noteReason")} (audit)
              <input
                className={fieldClass}
                onChange={(e) => setNoteRef(e.target.value)}
                value={noteRef}
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="rounded-lg border px-3 py-1.5 text-sm"
                onClick={() => setNoteOpen(false)}
                type="button"
              >
                {t("cancel")}
              </button>
              <button
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
                disabled={noteBusy}
                onClick={() => void submitNote()}
                type="button"
              >
                {t("save")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {reasonModalOpen && targetId ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
          role="dialog"
        >
          <form
            className="w-full max-w-lg rounded-2xl border border-ink/10 bg-white p-5 shadow-xl"
            onSubmit={submitAccessReason}
          >
            <h3 className="text-base font-semibold text-ink">
              {t("user360AccessReasonModalTitle")}
            </h3>
            <p className="mt-1 text-xs text-slate-600">
              {t("user360AccessReasonModalDesc").replace("{{id}}", targetId)}
            </p>
            <label className="mt-3 block text-sm font-medium text-slate-700">
              {t("user360AccessReasonCategory")}
              <AdminSelect
                className="mt-1 w-full"
                onChange={(e) =>
                  setReasonCategory(e.target.value as AccessReasonCategory)
                }
                value={reasonCategory}
              >
                {ACCESS_REASON_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {t(`user360AccessReasonCategory_${c}`)}
                  </option>
                ))}
              </AdminSelect>
            </label>
            <label className="mt-3 block text-sm font-medium text-slate-700">
              {t("user360AccessReason")}
              <textarea
                autoFocus
                className={cn(fieldClass, "min-h-[88px]")}
                onChange={(e) => setReasonText(e.target.value)}
                placeholder={t("user360AccessReasonPlaceholder")}
                value={reasonText}
              />
              <span className="mt-1 block text-xs text-slate-500">
                {t("user360AccessReasonHint")}
              </span>
            </label>
            {reasonError ? (
              <p className="mt-2 text-sm text-red-700" role="alert">
                {reasonError}
              </p>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800"
                onClick={handleReset}
                type="button"
              >
                {t("cancel")}
              </button>
              <button
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
                disabled={reasonText.trim().length < ACCESS_REASON_MIN}
                type="submit"
              >
                {t("user360AccessReasonSubmit")}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {actionModal.kind === "status" && detail ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
        >
          <div className="w-full max-w-md rounded-2xl border border-ink/10 bg-white p-5 shadow-lg">
            <h3 className="text-base font-semibold text-ink">
              {t("user360ChangeStatus")} — {detail.profile.displayName}
            </h3>
            {actionError ? (
              <p className="mt-2 text-sm text-red-700">{actionError}</p>
            ) : null}
            <label className="mt-3 block text-sm">
              {t("user360StatusLabel")}
              <AdminSelect
                className="mt-1 w-full"
                onChange={(e) => setActionStatusChoice(e.target.value)}
                value={actionStatusChoice}
              >
                {["active", "pending", "disabled", "suspended", "deleted"].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </AdminSelect>
            </label>
            <label className="mt-2 block text-sm">
              {t("user360ActionReason")}
              <textarea
                className={cn(fieldClass, "min-h-[72px]")}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder={t("user360ActionReasonPlaceholder")}
                value={actionReason}
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="rounded-lg border px-3 py-1.5 text-sm"
                onClick={() => setActionModal({ kind: "closed" })}
                type="button"
              >
                {t("cancel")}
              </button>
              <button
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
                disabled={actionBusy || actionReason.trim().length < 3}
                onClick={() => void submitStatusChange()}
                type="button"
              >
                {t("save")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {actionModal.kind === "plan" && detail ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
        >
          <div className="w-full max-w-md rounded-2xl border border-ink/10 bg-white p-5 shadow-lg">
            <h3 className="text-base font-semibold text-ink">
              {t("user360ChangePlan")} — {detail.profile.displayName}
            </h3>
            {actionError ? (
              <p className="mt-2 text-sm text-red-700">{actionError}</p>
            ) : null}
            <label className="mt-3 block text-sm">
              {t("user360PlanLabel")}
              <AdminSelect
                className="mt-1 w-full"
                onChange={(e) => setActionPlanChoice(e.target.value)}
                value={actionPlanChoice}
              >
                {["free", "plus", "standard"].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </AdminSelect>
            </label>
            <label className="mt-2 block text-sm">
              {t("user360ActionReason")}
              <textarea
                className={cn(fieldClass, "min-h-[72px]")}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder={t("user360ActionReasonPlaceholder")}
                value={actionReason}
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="rounded-lg border px-3 py-1.5 text-sm"
                onClick={() => setActionModal({ kind: "closed" })}
                type="button"
              >
                {t("cancel")}
              </button>
              <button
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
                disabled={actionBusy || actionReason.trim().length < 3}
                onClick={() => void submitPlanChange()}
                type="button"
              >
                {t("save")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
