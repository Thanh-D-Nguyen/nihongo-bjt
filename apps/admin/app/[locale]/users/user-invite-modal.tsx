"use client";

import { AdminSelect, cn } from "@nihongo-bjt/ui";
import { useMemo, useState } from "react";

import { adminApiFetch } from "@/lib/admin-api";

const fieldClass =
  "mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-ink focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100";

const section = "mt-4 rounded-xl border border-slate-200 bg-slate-50/40 p-3";
const legend = "text-xs font-semibold uppercase tracking-wide text-slate-600";

type Props = {
  canMonetizationWrite: boolean;
  onClose: () => void;
  onSuccess: () => void;
  um: Record<string, string>;
};

export function UserInviteModal({
  canMonetizationWrite,
  onClose,
  onSuccess,
  um
}: Props) {
  const tLabel = (k: string) => (um as Record<string, string>)[k] ?? k;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [okHint, setOkHint] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [accountType, setAccountType] = useState("learner");
  const [uiLocale, setUiLocale] = useState<"en" | "ja" | "vi">("vi");
  const [explanationLocale, setExplanationLocale] = useState<"en" | "ja" | "vi">("vi");
  const [timezone, setTimezone] = useState("Asia/Tokyo");

  const [creationMode, setCreationMode] = useState<
    "create_keycloak_user" | "invite_only" | "sync_existing_keycloak_user"
  >("invite_only");
  const [sendInvitationEmail, setSendInvitationEmail] = useState(true);
  const [requireEmailVerification, setRequireEmailVerification] = useState(true);
  const [requirePasswordReset, setRequirePasswordReset] = useState(true);
  const [initialStatus, setInitialStatus] = useState<"active" | "disabled" | "pending">("pending");

  const [targetBjt, setTargetBjt] = useState("J3");
  const [dailyStudyMinutes, setDailyStudyMinutes] = useState(30);
  const [learningPurpose, setLearningPurpose] = useState("");
  const [learningPersonality, setLearningPersonality] = useState("");
  const [furiganaMode, setFuriganaMode] = useState("hover");
  const [lowPressure, setLowPressure] = useState(false);
  const [onboardingRequired, setOnboardingRequired] = useState(true);

  const [planSlug, setPlanSlug] = useState("free");
  const [trialDays, setTrialDays] = useState<string>("0");
  const [planReason, setPlanReason] = useState("");

  const [creationReason, setCreationReason] = useState("");
  const [supportNote, setSupportNote] = useState("");

  const [adminAccess, setAdminAccess] = useState(false);
  const [roleCodes, setRoleCodes] = useState("");

  const [quotaOverride, setQuotaOverride] = useState("");

  const showLearner = accountType === "learner";
  const planLocked = !canMonetizationWrite && planSlug !== "free" && planSlug !== "internal";

  const body = useMemo(() => {
    const codes = roleCodes
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const qNum = Number(quotaOverride);
    return {
      accountType,
      adminAccess: adminAccess || undefined,
      creationMode,
      creationReason: creationReason.trim(),
      displayName: displayName.trim(),
      email: email.trim(),
      explanationLocale,
      initialStatus,
      internalAdminRoleCodes: codes.length > 0 ? codes : undefined,
      learner: showLearner
        ? {
            dailyStudyMinutes: dailyStudyMinutes || 20,
            furiganaMode,
            learningPersonality: learningPersonality.trim() || null,
            learningPurpose: learningPurpose.trim() || null,
            lowPressureMode: lowPressure,
            onboardingRequired,
            targetBjtBand: targetBjt
          }
        : undefined,
      planReason: planReason.trim(),
      planSlug,
      quotaOverride:
        quotaOverride.trim() && !Number.isNaN(qNum)
          ? { flashcardDayLimit: qNum }
          : undefined,
      requireEmailVerification,
      requirePasswordResetOnFirstLogin: requirePasswordReset,
      sendInvitationEmail,
      supportNote: supportNote.trim() || null,
      trialDays: Math.min(365, Math.max(0, Number(trialDays) || 0)),
      uiLocale,
      timezone: timezone.trim()
    };
  }, [
    accountType,
    adminAccess,
    creationMode,
    creationReason,
    dailyStudyMinutes,
    displayName,
    email,
    explanationLocale,
    furiganaMode,
    initialStatus,
    learningPersonality,
    learningPurpose,
    lowPressure,
    onboardingRequired,
    planReason,
    planSlug,
    quotaOverride,
    requireEmailVerification,
    requirePasswordReset,
    roleCodes,
    sendInvitationEmail,
    showLearner,
    supportNote,
    targetBjt,
    trialDays,
    uiLocale,
    timezone
  ]);

  const submit = async () => {
    if (!body.email) {
      setErr(tLabel("inviteErrorEmail"));
      return;
    }
    if (body.displayName.length < 1) {
      setErr(tLabel("inviteErrorName"));
      return;
    }
    if (body.creationReason.trim().length < 3) {
      setErr(tLabel("inviteErrorReason"));
      return;
    }
    if (body.planReason.trim().length < 3) {
      setErr(tLabel("inviteErrorPlanReason"));
      return;
    }
    if (planLocked) {
      setErr(tLabel("inviteErrorPlanPerm"));
      return;
    }
    setErr(null);
    setOkHint(null);
    setBusy(true);
    try {
        const res = await adminApiFetch("/api/admin/users/invite", {
        body: JSON.stringify(body),
        headers: { "content-type": "application/json" },
        method: "POST"
      });
      if (res.status === 403) {
        setErr(tLabel("forbidden"));
        return;
      }
      if (res.status === 409) {
        const j = (await res.json().catch(() => ({}))) as {
          message?: unknown;
          userId?: string;
        };
        const msg = j.message;
        const userIdFromMessage =
          msg != null && typeof msg === "object" && "userId" in msg
            ? String((msg as { userId: string }).userId)
            : null;
        const id = (j.userId != null ? String(j.userId) : null) ?? userIdFromMessage;
        setErr(tLabel("inviteDuplicate").replace("{{id}}", id ?? "—"));
        return;
      }
      if (!res.ok) {
        setErr(tLabel("inviteErrorGeneric"));
        return;
      }
      const data = (await res.json()) as {
        keycloak?: {
          emailActionSent?: boolean;
          keycloakError?: string | null;
          usedInviteOnlyFallback?: boolean;
        };
      };
      const parts: string[] = [tLabel("inviteSuccess")];
      if (data.keycloak?.usedInviteOnlyFallback) {
        parts.push(tLabel("inviteKcFallback"));
      }
      if (data.keycloak?.keycloakError) {
        parts.push(
          tLabel("inviteKcPartial").replace("{{e}}", data.keycloak.keycloakError)
        );
      } else if (data.keycloak?.emailActionSent) {
        parts.push(tLabel("inviteEmailSent"));
      }
      setOkHint(parts.join(" "));
      onSuccess();
      setTimeout(() => {
        onClose();
      }, 2_200);
    } catch {
      setErr(tLabel("inviteErrorGeneric"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
    >
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-ink/10 bg-white p-5 shadow-lg">
        <h3 className="text-base font-semibold text-ink" id="invite-title">
          {tLabel("inviteTitle")}
        </h3>
        <p className="mt-1 text-xs text-slate-600">{tLabel("inviteSubtitle")}</p>
        {err ? (
          <p className="mt-2 text-sm text-red-800" role="alert">
            {err}
          </p>
        ) : null}
        {okHint ? (
          <p className="mt-2 text-sm text-emerald-900" role="status">
            {okHint}
          </p>
        ) : null}

        <fieldset className={section}>
          <legend className={legend}>{tLabel("inviteSectionBasic")}</legend>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-slate-700">
              {tLabel("inviteEmail")} *
              <input
                className={fieldClass}
                onChange={(e) => {
                  setEmail(e.target.value);
                }}
                required
                type="email"
                value={email}
              />
            </label>
            <label className="text-xs text-slate-700">
              {tLabel("inviteDisplayName")} *
              <input
                className={fieldClass}
                onChange={(e) => {
                  setDisplayName(e.target.value);
                }}
                value={displayName}
              />
            </label>
            <label className="text-xs text-slate-700">
              {tLabel("inviteAccountType")}
              <AdminSelect
                className="mt-1 w-full"
                onChange={(e) => {
                  setAccountType(e.target.value);
                }}
                value={accountType}
              >
                {[
                  "learner",
                  "content_editor",
                  "support_staff",
                  "analytics_viewer",
                  "billing_manager",
                  "admin"
                ].map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </AdminSelect>
            </label>
            <label className="text-xs text-slate-700">
              {tLabel("inviteUiLocale")}
              <AdminSelect
                className="mt-1 w-full"
                onChange={(e) => {
                  setUiLocale(e.target.value as "en" | "ja" | "vi");
                }}
                value={uiLocale}
              >
                <option value="vi">vi</option>
                <option value="ja">ja</option>
                <option value="en">en</option>
              </AdminSelect>
            </label>
            <label className="text-xs text-slate-700">
              {tLabel("inviteExplainLocale")}
              <AdminSelect
                className="mt-1 w-full"
                onChange={(e) => {
                  setExplanationLocale(e.target.value as "en" | "ja" | "vi");
                }}
                value={explanationLocale}
              >
                <option value="vi">vi</option>
                <option value="ja">ja</option>
                <option value="en">en</option>
              </AdminSelect>
            </label>
            <label className="text-xs text-slate-700">
              {tLabel("inviteTimezone")}
              <input
                className={fieldClass}
                onChange={(e) => {
                  setTimezone(e.target.value);
                }}
                value={timezone}
              />
            </label>
          </div>
        </fieldset>

        <fieldset className={section}>
          <legend className={legend}>{tLabel("inviteSectionAuth")}</legend>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-slate-700 sm:col-span-2">
              {tLabel("inviteCreationMode")}
              <AdminSelect
                className="mt-1 w-full"
                onChange={(e) => {
                  setCreationMode(
                    e.target.value as
                      | "create_keycloak_user"
                      | "invite_only"
                      | "sync_existing_keycloak_user"
                  );
                }}
                value={creationMode}
              >
                <option value="invite_only">{tLabel("inviteModeInvite")}</option>
                <option value="create_keycloak_user">{tLabel("inviteModeCreateKc")}</option>
                <option value="sync_existing_keycloak_user">
                  {tLabel("inviteModeSyncKc")}
                </option>
              </AdminSelect>
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input
                checked={sendInvitationEmail}
                onChange={(e) => {
                  setSendInvitationEmail(e.target.checked);
                }}
                type="checkbox"
              />
              {tLabel("inviteSendEmail")}
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input
                checked={requireEmailVerification}
                onChange={(e) => {
                  setRequireEmailVerification(e.target.checked);
                }}
                type="checkbox"
              />
              {tLabel("inviteRequireVerify")}
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input
                checked={requirePasswordReset}
                onChange={(e) => {
                  setRequirePasswordReset(e.target.checked);
                }}
                type="checkbox"
              />
              {tLabel("inviteRequirePwReset")}
            </label>
            <label className="text-xs text-slate-700">
              {tLabel("inviteInitialStatus")}
              <AdminSelect
                className="mt-1 w-full"
                onChange={(e) => {
                  setInitialStatus(e.target.value as "active" | "disabled" | "pending");
                }}
                value={initialStatus}
              >
                <option value="pending">pending</option>
                <option value="active">active</option>
                <option value="disabled">disabled</option>
              </AdminSelect>
            </label>
          </div>
        </fieldset>

        {showLearner ? (
          <fieldset className={section}>
            <legend className={legend}>{tLabel("inviteSectionLearner")}</legend>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <label className="text-xs text-slate-700">
                {tLabel("inviteBjtTarget")}
                <AdminSelect
                  className="mt-1 w-full"
                  onChange={(e) => {
                    setTargetBjt(e.target.value);
                  }}
                  value={targetBjt}
                >
                  {["J5", "J4", "J3", "J2", "J1"].map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </AdminSelect>
              </label>
              <label className="text-xs text-slate-700">
                {tLabel("inviteDailyMinutes")}
                <input
                  className={fieldClass}
                  min={5}
                  onChange={(e) => {
                    setDailyStudyMinutes(Number(e.target.value));
                  }}
                  type="number"
                  value={dailyStudyMinutes}
                />
              </label>
              <label className="text-xs sm:col-span-2">
                {tLabel("invitePurpose")}
                <input
                  className={fieldClass}
                  onChange={(e) => {
                    setLearningPurpose(e.target.value);
                  }}
                  value={learningPurpose}
                />
              </label>
              <label className="text-xs sm:col-span-2">
                {tLabel("invitePersonality")}
                <input
                  className={fieldClass}
                  onChange={(e) => {
                    setLearningPersonality(e.target.value);
                  }}
                  value={learningPersonality}
                />
              </label>
              <label className="text-xs text-slate-700">
                {tLabel("inviteFurigana")}
                <AdminSelect
                  className="mt-1 w-full"
                  onChange={(e) => {
                    setFuriganaMode(e.target.value);
                  }}
                  value={furiganaMode}
                >
                  {["hover", "full_furigana", "beginner", "difficult", "off"].map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </AdminSelect>
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input
                  checked={lowPressure}
                  onChange={(e) => {
                    setLowPressure(e.target.checked);
                  }}
                  type="checkbox"
                />
                {tLabel("inviteLowPressure")}
              </label>
              <label className="flex items-center gap-2 text-xs sm:col-span-2">
                <input
                  checked={onboardingRequired}
                  onChange={(e) => {
                    setOnboardingRequired(e.target.checked);
                  }}
                  type="checkbox"
                />
                {tLabel("inviteOnboarding")}
              </label>
            </div>
          </fieldset>
        ) : null}

        <fieldset className={section}>
          <legend className={legend}>{tLabel("inviteSectionPlan")}</legend>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-slate-700">
              {tLabel("invitePlan")}
              <AdminSelect
                className="mt-1 w-full"
                onChange={(e) => {
                  setPlanSlug(e.target.value);
                }}
                value={planSlug}
              >
                {["free", "basic", "standard", "premium", "internal"].map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </AdminSelect>
            </label>
            <label className="text-xs text-slate-700">
              {tLabel("inviteTrialDays")}
              <input
                className={fieldClass}
                min={0}
                onChange={(e) => {
                  setTrialDays(e.target.value);
                }}
                type="number"
                value={trialDays}
              />
            </label>
            <label className="text-xs sm:col-span-2">
              {tLabel("invitePlanReason")} * (audit)
              <textarea
                className={cn(fieldClass, "min-h-[64px] font-mono text-[13px] leading-relaxed")}
                onChange={(e) => {
                  setPlanReason(e.target.value);
                }}
                value={planReason}
              />
            </label>
            {canMonetizationWrite ? (
              <label className="text-xs sm:col-span-2">
                {tLabel("inviteQuotaOverride")}
                <input
                  className={fieldClass}
                  onChange={(e) => {
                    setQuotaOverride(e.target.value);
                  }}
                  placeholder="flashcard day limit (optional)"
                  value={quotaOverride}
                />
              </label>
            ) : null}
            {!canMonetizationWrite && planSlug !== "free" && planSlug !== "internal" ? (
              <p className="text-xs text-amber-800 sm:col-span-2">
                {tLabel("invitePlanFreeOnly")}
              </p>
            ) : null}
          </div>
        </fieldset>

        <fieldset className={section}>
          <legend className={legend}>{tLabel("inviteSectionRoles")}</legend>
          <p className="text-[11px] text-slate-500">{tLabel("inviteRolesHint")}</p>
          <label className="mt-2 flex items-center gap-2 text-xs">
            <input
              checked={adminAccess}
              onChange={(e) => {
                setAdminAccess(e.target.checked);
              }}
              type="checkbox"
            />
            {tLabel("inviteAdminAccess")}
          </label>
          <label className="mt-2 block text-xs text-slate-700">
            {tLabel("inviteRoleCodes")}
            <input
              className={fieldClass}
              onChange={(e) => {
                setRoleCodes(e.target.value);
              }}
              placeholder="code1, code2"
              value={roleCodes}
            />
          </label>
        </fieldset>

        <fieldset className={section}>
          <legend className={legend}>{tLabel("inviteSectionAudit")}</legend>
          <label className="text-xs text-slate-700">
            {tLabel("inviteCreationReason")} * (audit)
            <textarea
              className={cn(fieldClass, "min-h-[64px] font-mono text-[13px] leading-relaxed")}
              onChange={(e) => {
                setCreationReason(e.target.value);
              }}
              value={creationReason}
            />
          </label>
          <label className="mt-2 text-xs text-slate-700">
            {tLabel("inviteSupportNote")}
            <textarea
              className={cn(fieldClass, "min-h-[64px] font-mono text-[13px] leading-relaxed")}
              onChange={(e) => {
                setSupportNote(e.target.value);
              }}
              value={supportNote}
            />
          </label>
        </fieldset>

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
            onClick={onClose}
            type="button"
          >
            {tLabel("cancel")}
          </button>
          <button
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            disabled={busy}
            onClick={() => {
              void submit();
            }}
            type="button"
          >
            {tLabel("inviteSubmit")}
          </button>
        </div>
      </div>
    </div>
  );
}
