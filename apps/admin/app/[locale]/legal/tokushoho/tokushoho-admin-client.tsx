"use client";

import { useEffect, useMemo, useState } from "react";

import { LegalPolicyAdminClient } from "../_components/legal-policy-admin-client";

type CommonLabels = { empty: string; error: string; loading: string; records: string };
type Labels = Record<string, string>;

/**
 * Required Tokushoho disclosures under Japan's Act on Specified Commercial
 * Transactions (特定商取引法). These keys/labels follow the consumer-affairs
 * agency standard set published at https://www.no-trouble.caa.go.jp/.
 *
 * partial_schema_pending: structured fields are JSON-serialised into
 * legal_policy.contentMd today. A dedicated tokushoho_disclosure table is
 * pending. Legal review must approve every field change.
 */
const TOKUSHOHO_FIELDS: { key: string; required: boolean }[] = [
  { key: "sellerName", required: true },
  { key: "operationsManager", required: true },
  { key: "registeredAddress", required: true },
  { key: "contactPhone", required: true },
  { key: "contactEmail", required: true },
  { key: "businessHours", required: true },
  { key: "salesPrice", required: true },
  { key: "additionalFees", required: true },
  { key: "paymentMethods", required: true },
  { key: "paymentTiming", required: true },
  { key: "deliveryTiming", required: true },
  { key: "refundPolicy", required: true },
  { key: "subscriptionTerms", required: false },
  { key: "specialConditions", required: false }
];

const TOKUSHOHO_VERSION = 1;

type TokushohoPayload = {
  __tokushoho: number;
  fields: Record<string, string>;
  notes?: string;
};

function parsePayload(raw: string | null | undefined): TokushohoPayload {
  if (!raw) {
    return { __tokushoho: TOKUSHOHO_VERSION, fields: {} };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<TokushohoPayload>;
    if (parsed && typeof parsed === "object" && parsed.__tokushoho === TOKUSHOHO_VERSION) {
      return {
        __tokushoho: TOKUSHOHO_VERSION,
        fields: { ...(parsed.fields ?? {}) },
        notes: typeof parsed.notes === "string" ? parsed.notes : undefined
      };
    }
  } catch {
    // not JSON — treat as legacy free-form notes
  }
  return { __tokushoho: TOKUSHOHO_VERSION, fields: {}, notes: raw };
}

function serializePayload(p: TokushohoPayload): string {
  return JSON.stringify(p, null, 2);
}

function StructuredEditor({
  initial,
  onChange,
  labels
}: {
  initial: string;
  onChange: (next: string) => void;
  labels: Labels;
}) {
  const t = (k: string) => labels[k] ?? k;
  const [payload, setPayload] = useState<TokushohoPayload>(() => parsePayload(initial));
  // Re-parse only when the initial-prop identity changes (mode switches).
  // Subsequent edits update local state which is synced upward via onChange.
  useEffect(() => {
    setPayload(parsePayload(initial));
  }, [initial]);

  const missingRequired = useMemo(
    () => TOKUSHOHO_FIELDS.filter((f) => f.required && !(payload.fields[f.key]?.trim())).map((f) => f.key),
    [payload]
  );

  function update(key: string, value: string) {
    const next: TokushohoPayload = {
      ...payload,
      fields: { ...payload.fields, [key]: value }
    };
    setPayload(next);
    onChange(serializePayload(next));
  }

  function updateNotes(value: string) {
    const next: TokushohoPayload = { ...payload, notes: value };
    setPayload(next);
    onChange(serializePayload(next));
  }

  return (
    <div className="space-y-3">
      {missingRequired.length > 0 ? (
        <div className="rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
          {t("missingRequired")}: {missingRequired.map((k) => t(`field_${k}`)).join(" / ")}
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {TOKUSHOHO_FIELDS.map((f) => (
          <div key={f.key} className={f.key === "refundPolicy" || f.key === "specialConditions" || f.key === "subscriptionTerms" ? "sm:col-span-2" : ""}>
            <label className="block text-xs font-semibold uppercase text-gray-600">
              {t(`field_${f.key}`)}
              {f.required ? <span className="ml-1 text-red-600">*</span> : null}
            </label>
            {f.key === "refundPolicy" || f.key === "specialConditions" || f.key === "subscriptionTerms" ? (
              <textarea
                className="mt-1 w-full rounded border px-2 py-1 text-sm"
                onChange={(e) => update(f.key, e.target.value)}
                rows={3}
                value={payload.fields[f.key] ?? ""}
              />
            ) : (
              <input
                className="mt-1 w-full rounded border px-2 py-1 text-sm"
                onChange={(e) => update(f.key, e.target.value)}
                value={payload.fields[f.key] ?? ""}
              />
            )}
          </div>
        ))}
      </div>
      <div>
        <label className="block text-xs font-semibold uppercase text-gray-600">{t("notes")}</label>
        <textarea
          className="mt-1 w-full rounded border px-2 py-1 text-sm"
          onChange={(e) => updateNotes(e.target.value)}
          rows={3}
          value={payload.notes ?? ""}
        />
      </div>
    </div>
  );
}

function StructuredRenderer({
  raw,
  labels
}: {
  raw: string | null;
  labels: Labels;
}) {
  const t = (k: string) => labels[k] ?? k;
  const payload = parsePayload(raw);
  const missingRequired = TOKUSHOHO_FIELDS.filter((f) => f.required && !(payload.fields[f.key]?.trim()));
  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold uppercase text-gray-500">{t("structuredFields")}</div>
      {missingRequired.length > 0 ? (
        <div className="rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
          {t("missingRequiredPublishWarning")}
        </div>
      ) : null}
      <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
        {TOKUSHOHO_FIELDS.map((f) => (
          <div key={f.key} className="flex flex-col">
            <dt className="text-gray-500">
              {t(`field_${f.key}`)}
              {f.required ? <span className="ml-1 text-red-600">*</span> : null}
            </dt>
            <dd className="whitespace-pre-wrap break-words text-gray-900">
              {payload.fields[f.key]?.trim() || <span className="text-gray-400">—</span>}
            </dd>
          </div>
        ))}
      </dl>
      {payload.notes ? (
        <div className="mt-2">
          <div className="text-xs font-semibold uppercase text-gray-500">{t("notes")}</div>
          <p className="whitespace-pre-wrap text-xs">{payload.notes}</p>
        </div>
      ) : null}
    </div>
  );
}

export function TokushohoAdminClient({
  common,
  labels
}: {
  common: CommonLabels;
  labels: Labels;
}) {
  const initialContentMd = serializePayload({ __tokushoho: TOKUSHOHO_VERSION, fields: {} });
  return (
    <LegalPolicyAdminClient
      common={common}
      labels={{ ...labels, title: labels.title ?? "Tokushoho" }}
      fixedPolicyKey="tokusho"
      initialContentMd={initialContentMd}
      structuredEditor={({ initial, onChange }) => (
        <StructuredEditor initial={initial} onChange={onChange} labels={labels} />
      )}
      structuredRenderer={(detail) => (
        <StructuredRenderer raw={detail.contentMd ?? null} labels={labels} />
      )}
    />
  );
}
