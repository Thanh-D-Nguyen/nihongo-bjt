"use client";

import {
  AdminChartCard,
  AdminDataTable,
  AdminDataTableBody,
  AdminDataTableHead,
  AdminDataTableRow,
  AdminDataTableTd,
  AdminDataTableTh,
  AdminEmptyState,
  AdminKpiCard,
  AdminPageHeader,
  AdminSearchInput,
  AdminSection,
  AdminSelect,
  AdminStatusBadge,
  cn
} from "@nihongo-bjt/ui";
import type { AdminContentSummaryResponse } from "@nihongo-bjt/shared";
import {
  aggregateByCategoryGroup,
  GRAMMAR_CATEGORY_GROUP_CHART_ORDER
} from "@nihongo-bjt/shared/grammar-category-taxonomy";
import { Fragment, type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { CmsRequestError, toCmsRequestError } from "@/lib/admin-api-error";
import { adminApiFetch } from "@/lib/admin-api";
import { GrammarCategoryFilter, type GrammarFilterLabels } from "./grammar-category-filter";
import {
  LexemeExamplesSubrow,
  type LexemeExampleLabels,
  type LexemeExampleRow
} from "./lexeme-examples-subrow";

type CommonLabels = {
  action: string;
  allStatuses: string;
  backendMissing: string;
  chartCategoryDescription: string;
  chartCategoryDistribution: string;
  chartLevelDescription: string;
  chartLevelDistribution: string;
  cmsFiltersHint: string;
  createdAt: string;
  empty: string;
  error: string;
  filters: string;
  kpiStatusGroups: string;
  levelDistinctKpi: string;
  loading: string;
  noCategoryChartData: string;
  noChartData: string;
  noLevelChartData: string;
  open: string;
  pageSizeLabel: string;
  paginationNext: string;
  paginationPageOf: string;
  paginationPrev: string;
  paginationRowsRange: string;
  records: string;
  search: string;
  status: string;
  statusDistribution: string;
  statusLabelActive: string;
  statusLabelArchived: string;
  statusLabelNeedsReview: string;
  updatedAt: string;
};

type PageLabels = {
  empty: string;
  subtitle: string;
  title: string;
};

type Column = {
  key: string;
  label: string;
  /** Tooltip on table header (e.g. Level column) */
  thTitle?: string;
};

type ResourceItem = Record<string, unknown>;

export type ExtraContentFilter =
  | { control: "number"; label: string; max?: number; min?: number; param: string; placeholder?: string }
  | { control: "select"; label: string; options: { label: string; value: string }[]; param: string }
  | { control: "text"; label: string; param: string; placeholder?: string };

export type CmsLabels = {
  actions: string;
  add: string;
  allJlpt: string;
  allSchoolLevels: string;
  archive: string;
  archiveConfirm: string;
  cancel: string;
  categoryLabel: string;
  categoryPlaceholder: string;
  character: string;
  contentStatus: string;
  createError: string;
  createTitle: string;
  edit: string;
  editTitle: string;
  headword: string;
  kanjiMeaning: string;
  kunyomi: string;
  levelFilter: string;
  meaningVi: string;
  onyomi: string;
  pattern: string;
  publish: string;
  publishConfirm: string;
  reading: string;
  reason: string;
  reasonPlaceholder: string;
  review: string;
  reviewConfirm: string;
  save: string;
  schoolLevel: string;
  schoolLevelColumnHint: string;
  shortMeaning: string;
  strokeCount: string;
  strokesFrom: string;
  strokesTo: string;
  updateError: string;
  reasonMin: string;
  errorDetail: string;
  listRefreshFailed: string;
};

function textValue(item: ResourceItem, key: string) {
  const value = item[key];
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

/** yyyy/MM/dd HH:mm (24h, local) */
function formatAdminDateTime(value: unknown) {
  if (value == null || value === "") {
    return "-";
  }
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) {
    return String(value);
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}/${m}/${day} ${h}:${min}`;
}

function cellDisplay(item: ResourceItem, column: Column) {
  if (column.key === "updatedAt") {
    return formatAdminDateTime(item.updatedAt);
  }
  return textValue(item, column.key);
}

function mergeAdminContentQuery(
  endpoint: string,
  searchParam: string,
  statusParam: string,
  query: string,
  status: string,
  extraParamState: Record<string, string>
): { listPath: string; params: URLSearchParams } {
  const qIndex = endpoint.indexOf("?");
  const listPath = qIndex >= 0 ? endpoint.slice(0, qIndex) : endpoint;
  const qs = qIndex >= 0 ? endpoint.slice(qIndex + 1) : "";
  const merged = new URLSearchParams(qs);
  if (query.trim()) {
    merged.set(searchParam, query.trim());
  }
  if (status) {
    merged.set(statusParam, status);
  }
  for (const [k, v] of Object.entries(extraParamState)) {
    if (v && v.trim() !== "") {
      merged.set(k, v.trim());
    }
  }
  return { listPath, params: merged };
}

function isAdminContentListEndpoint(endpoint: string | undefined): boolean {
  return Boolean(
    endpoint && endpoint.includes("/api/admin/content") && !endpoint.includes("/content/summary")
  );
}

/** N5…N1 / J5…J1 order for grammar level chart; unknown labels after known tokens. */
function grammarJlptLabelSortKey(label: string): number {
  if (label === "—" || label === "-" || label.trim() === "") {
    return 1_000_000;
  }
  const s = label.toUpperCase();
  const nMatch = s.match(/N([1-5])\b/);
  if (nMatch) {
    return 5 - Number(nMatch[1]);
  }
  const jMatch = s.match(/J([1-5])\b/);
  if (jMatch) {
    return 20 + (5 - Number(jMatch[1]));
  }
  return 1_000_000 + s.charCodeAt(0) / 1_000_000;
}

function sortGrammarLevelBarRows(rows: { name: string; value: number }[]) {
  return [...rows].sort((a, b) => {
    const d = grammarJlptLabelSortKey(a.name) - grammarJlptLabelSortKey(b.name);
    if (d !== 0) {
      return d;
    }
    return a.name.localeCompare(b.name, "en", { numeric: true, sensitivity: "base" });
  });
}

function sortCategoryBarRows(rows: { name: string; value: number }[]) {
  return [...rows].sort((a, b) => {
    const isEmpty = (x: string) => x === "—" || x === "-" || x.trim() === "";
    if (isEmpty(a.name) && !isEmpty(b.name)) {
      return 1;
    }
    if (!isEmpty(a.name) && isEmpty(b.name)) {
      return -1;
    }
    return a.name.localeCompare(b.name, "vi", { numeric: true, sensitivity: "base" });
  });
}

const STATUS_BAR_COLORS: Record<string, string> = {
  active: "#059669",
  archived: "#64748b",
  needs_review: "#d97706"
};

const LEVEL_BAR_PALETTE = [
  "#3730a3",
  "#4f46e5",
  "#6366f1",
  "#818cf8",
  "#0d9488",
  "#0e7490",
  "#7c3aed",
  "#a855f7",
  "#db2777",
  "#ea580c",
  "#ca8a04",
  "#4b5563",
  "#334155",
  "#1e293b"
];

function AdminFilterField({ children, className, label }: { children: ReactNode; className?: string; label: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <span className="text-xs font-semibold leading-snug text-ink/80">{label}</span>
      {children}
    </div>
  );
}

function statusOptionLabel(common: CommonLabels, value: string) {
  if (value === "active") {
    return common.statusLabelActive;
  }
  if (value === "needs_review") {
    return common.statusLabelNeedsReview;
  }
  if (value === "archived") {
    return common.statusLabelArchived;
  }
  return value;
}

function statusTone(status: string) {
  if (status === "active" || status === "published" || status === "cleared") {
    return "good" as const;
  }
  if (status === "needs_review" || status === "review" || status === "draft") {
    return "warning" as const;
  }
  if (status === "archived" || status === "failed") {
    return "danger" as const;
  }
  return "neutral" as const;
}

const fieldClass =
  "w-full min-h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none focus:border-accent focus:ring-2 focus:ring-accent/15";
const numberFieldClass =
  "min-h-9 w-24 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-950 outline-none focus:border-accent focus:ring-2 focus:ring-accent/15";
const textAreaClass =
  "w-full min-h-[4.5rem] rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 outline-none focus:border-accent focus:ring-2 focus:ring-accent/15";

/** CMS icon buttons — one row, icon + sr-only, square touch target */
const cmsIcon = {
  base: "inline-flex h-9 w-9 min-h-9 min-w-9 shrink-0 items-center justify-center rounded-lg border p-0 shadow-sm transition-[background-color,border-color,opacity,box-shadow] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent/70 disabled:cursor-not-allowed disabled:opacity-45",
  danger: "border border-red-200 bg-red-50 text-red-800 hover:border-red-300 hover:bg-red-100 active:bg-red-200/60",
  edit: "border border-accent/30 bg-indigo-50/90 text-accent hover:border-accent/50 hover:bg-indigo-100/90 active:bg-indigo-200/50",
  primary: "border border-accent bg-accent text-white hover:brightness-105 active:brightness-95",
  publish: "border border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-emerald-300 hover:bg-emerald-100 active:bg-emerald-200/50",
  review: "border border-amber-200 bg-amber-50 text-amber-900 hover:border-amber-300 hover:bg-amber-100 active:bg-amber-200/50",
  secondary: "border border-slate-200 bg-white text-ink hover:border-slate-300 hover:bg-slate-50 active:bg-slate-100"
} as const;

const cmsBtn = {
  base: "inline-flex min-h-9 min-w-0 max-w-full shrink-0 items-center justify-center gap-1 rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold shadow-sm transition-[background-color,border-color,opacity,box-shadow] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent/70 disabled:cursor-not-allowed disabled:opacity-45 sm:px-3 sm:text-sm",
  primary: "border border-accent bg-accent text-white hover:brightness-105 active:brightness-95",
  secondary: "border border-slate-200 bg-white text-ink hover:border-slate-300 hover:bg-slate-50 active:bg-slate-100"
} as const;

function IconPencil() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5Z"
      />
    </svg>
  );
}

function IconCheckPublish() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  );
}

function IconFlagReview() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
      />
    </svg>
  );
}

function IconArchive() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10.5 6h3.75M12 3.75h.007v.008H12V3.75Z"
      />
    </svg>
  );
}

type CmsModalState = { item?: ResourceItem; mode: "create" | "edit" };

function CmsModal({
  cms,
  kind,
  levelFieldLabel,
  onClose,
  onSave,
  open,
  state
}: {
  cms: CmsLabels;
  kind: "grammar" | "kanji" | "lexeme";
  levelFieldLabel?: string;
  onClose: () => void;
  onSave: (body: unknown) => Promise<void>;
  open: boolean;
  state: CmsModalState;
}) {
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [reason, setReason] = useState("CMS form save");
  const [form, setForm] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) {
      return;
    }
    setFormError(null);
    if (state.mode === "create") {
      if (kind === "lexeme") {
        setForm({ headword: "", jlptLevel: "", kanjiMeaningVi: "", reading: "", shortMeaningVi: "", status: "needs_review" });
      } else if (kind === "kanji") {
        setForm({ character: "", kunyomi: "", level: "", meaningVi: "", onyomi: "", status: "needs_review", strokeCount: "" });
      } else {
        setForm({ category: "", jlptLevel: "", meaningVi: "", pattern: "", status: "needs_review" });
      }
      return;
    }
    const it = state.item;
    if (!it) {
      return;
    }
    if (kind === "lexeme") {
      setForm({
        headword: String(it.headword ?? ""),
        jlptLevel: String(it.jlptLevel ?? ""),
        kanjiMeaningVi: String(it.kanjiMeaningVi ?? ""),
        reading: String(it.reading ?? ""),
        shortMeaningVi: String(it.shortMeaningVi ?? ""),
        status: String(it.status ?? "needs_review")
      });
    } else if (kind === "kanji") {
      setForm({
        character: String(it.character ?? ""),
        kunyomi: String(it.kunyomi ?? ""),
        level: it.level == null || it.level === "" ? "" : String(it.level),
        meaningVi: String(it.meaningVi ?? ""),
        onyomi: String(it.onyomi ?? ""),
        status: String(it.status ?? "needs_review"),
        strokeCount: it.strokeCount == null || it.strokeCount === "" ? "" : String(it.strokeCount)
      });
    } else {
      setForm({
        category: String(it.category ?? ""),
        jlptLevel: String(it.jlptLevel ?? ""),
        meaningVi: String(it.meaningVi ?? ""),
        pattern: String(it.pattern ?? ""),
        status: String(it.status ?? "needs_review")
      });
    }
  }, [open, state, kind]);

  if (!open) {
    return null;
  }

  const statusField = (
    <label className="block text-xs font-medium text-slate-600">
      {cms.contentStatus}
      <select
        className={fieldClass + " mt-1"}
        onChange={(e) => {
          setForm((f) => ({ ...f, status: e.target.value }));
        }}
        value={form.status ?? "needs_review"}
      >
        <option value="needs_review">needs_review</option>
        <option value="active">active</option>
        <option value="archived">archived</option>
      </select>
    </label>
  );

  return (
    <div
      aria-labelledby="cms-modal-title"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]"
      role="dialog"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-ink/10 bg-white p-6 shadow-lg ring-1 ring-ink/5">
        <h3 className="text-base font-semibold text-ink" id="cms-modal-title">
          {state.mode === "create" ? cms.createTitle : cms.editTitle}
        </h3>
        {formError ? (
          <p className="mt-2 whitespace-pre-wrap break-words text-sm text-red-700">{formError}</p>
        ) : null}
        <div className="mt-4 space-y-3 text-sm">
          {kind === "lexeme" ? (
            <>
              <LabeledText label={cms.headword} onChange={(v) => setForm((f) => ({ ...f, headword: v }))} value={form.headword} />
              <LabeledText
                label={cms.shortMeaning}
                onChange={(v) => setForm((f) => ({ ...f, shortMeaningVi: v }))}
                value={form.shortMeaningVi}
              />
              <LabeledText
                label={cms.reading}
                onChange={(v) => setForm((f) => ({ ...f, reading: v }))}
                value={form.reading}
              />
              <LabeledText
                label={cms.kanjiMeaning}
                onChange={(v) => setForm((f) => ({ ...f, kanjiMeaningVi: v }))}
                value={form.kanjiMeaningVi}
              />
              <LabeledText
                label={levelFieldLabel ?? "Level"}
                onChange={(v) => setForm((f) => ({ ...f, jlptLevel: v }))}
                value={form.jlptLevel}
              />
            </>
          ) : null}
          {kind === "kanji" ? (
            <>
              <LabeledText
                label={cms.character}
                onChange={(v) => setForm((f) => ({ ...f, character: v }))}
                value={form.character}
                readOnly={state.mode === "edit"}
              />
              <LabeledText
                label={cms.meaningVi}
                onChange={(v) => setForm((f) => ({ ...f, meaningVi: v }))}
                value={form.meaningVi}
              />
              <LabeledText label={cms.onyomi} onChange={(v) => setForm((f) => ({ ...f, onyomi: v }))} value={form.onyomi} />
              <LabeledText label={cms.kunyomi} onChange={(v) => setForm((f) => ({ ...f, kunyomi: v }))} value={form.kunyomi} />
              <LabeledText
                label={cms.strokeCount}
                onChange={(v) => setForm((f) => ({ ...f, strokeCount: v }))}
                value={form.strokeCount}
              />
              <LabeledText label={cms.schoolLevel} onChange={(v) => setForm((f) => ({ ...f, level: v }))} value={form.level} />
            </>
          ) : null}
          {kind === "grammar" ? (
            <>
              <label className="block text-xs font-medium text-slate-600">
                {cms.pattern}
                <textarea
                  className={cnField(textAreaClass, "mt-1")}
                  onChange={(e) => setForm((f) => ({ ...f, pattern: e.target.value }))}
                  value={form.pattern}
                />
              </label>
              <label className="block text-xs font-medium text-slate-600">
                {cms.meaningVi}
                <textarea
                  className={cnField(textAreaClass, "mt-1")}
                  onChange={(e) => setForm((f) => ({ ...f, meaningVi: e.target.value }))}
                  value={form.meaningVi}
                />
              </label>
              <LabeledText
                label={levelFieldLabel ?? "Level"}
                onChange={(v) => setForm((f) => ({ ...f, jlptLevel: v }))}
                value={form.jlptLevel}
              />
              <LabeledText
                label={cms.categoryLabel}
                onChange={(v) => setForm((f) => ({ ...f, category: v }))}
                placeholder={cms.categoryPlaceholder}
                value={form.category}
              />
            </>
          ) : null}
          {state.mode === "create" ? statusField : (
            <>
              {statusField}
              <label className="block text-xs font-medium text-slate-600">
                {cms.reason}
                <input
                  className={fieldClass + " mt-1"}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={cms.reasonPlaceholder}
                  value={reason}
                />
              </label>
            </>
          )}
        </div>
        <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-5">
          <button
            className={cn(cmsBtn.base, cmsBtn.secondary, "px-4")}
            onClick={onClose}
            type="button"
          >
            {cms.cancel}
          </button>
          <button
            className={cn(cmsBtn.base, cmsBtn.primary, "min-w-[6.5rem] px-4")}
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              setFormError(null);
              try {
                if (state.mode === "edit" && reason.trim().length < 3) {
                  setFormError(cms.reasonMin);
                  setSaving(false);
                  return;
                }
                const sc = form.strokeCount?.trim() ? Number(form.strokeCount) : undefined;
                const lv = form.level?.trim() ? Number(form.level) : undefined;
                if (state.mode === "create") {
                  if (kind === "lexeme") {
                    await onSave({
                      type: "lexeme",
                      headword: form.headword?.trim() ?? "",
                      jlptLevel: form.jlptLevel?.trim() || undefined,
                      kanjiMeaningVi: form.kanjiMeaningVi?.trim() || undefined,
                      reading: form.reading?.trim() || undefined,
                      shortMeaningVi: form.shortMeaningVi?.trim() || undefined,
                      status: (form.status as "active" | "archived" | "needs_review") ?? "needs_review"
                    });
                  } else if (kind === "kanji") {
                    await onSave({
                      type: "kanji",
                      character: form.character?.trim() ?? "",
                      kunyomi: form.kunyomi?.trim() || undefined,
                      level: lv !== undefined && !Number.isNaN(lv) ? lv : undefined,
                      meaningVi: form.meaningVi?.trim() || undefined,
                      onyomi: form.onyomi?.trim() || undefined,
                      status: (form.status as "active" | "archived" | "needs_review") ?? "needs_review",
                      strokeCount: sc !== undefined && !Number.isNaN(sc) ? sc : undefined
                    });
                  } else {
                    await onSave({
                      type: "grammar",
                      category: form.category?.trim() || undefined,
                      jlptLevel: form.jlptLevel?.trim() || undefined,
                      meaningVi: form.meaningVi?.trim() ?? "",
                      pattern: form.pattern?.trim() ?? "",
                      status: (form.status as "active" | "archived" | "needs_review") ?? "needs_review"
                    });
                  }
                } else {
                  const id = String(state.item?.id ?? "");
                  const reasonTrim = reason.trim() || "CMS content edit";
                  if (kind === "lexeme") {
                    await onSave({
                      body: {
                        headword: form.headword?.trim(),
                        jlptLevel: form.jlptLevel?.trim() || null,
                        kanjiMeaningVi: form.kanjiMeaningVi?.trim() || null,
                        reading: form.reading?.trim() || null,
                        reason: reasonTrim,
                        shortMeaningVi: form.shortMeaningVi?.trim() || null,
                        status: form.status as "active" | "archived" | "needs_review" | undefined
                      },
                      id,
                      method: "PATCH"
                    });
                  } else if (kind === "kanji") {
                    await onSave({
                      body: {
                        character: form.character?.trim(),
                        kunyomi: form.kunyomi?.trim() || null,
                        level: form.level?.trim() ? lv : null,
                        meaningVi: form.meaningVi?.trim() || null,
                        onyomi: form.onyomi?.trim() || null,
                        reason: reasonTrim,
                        status: form.status as "active" | "archived" | "needs_review" | undefined,
                        strokeCount: form.strokeCount?.trim() ? sc : null
                      },
                      id,
                      method: "PATCH"
                    });
                  } else {
                    await onSave({
                      body: {
                        category: form.category?.trim() || null,
                        jlptLevel: form.jlptLevel?.trim() || null,
                        meaningVi: form.meaningVi?.trim() || undefined,
                        pattern: form.pattern?.trim() || undefined,
                        reason: reasonTrim,
                        status: form.status as "active" | "archived" | "needs_review" | undefined
                      },
                      id,
                      method: "PATCH"
                    });
                  }
                }
                onClose();
              } catch (e) {
                if (e instanceof CmsRequestError) {
                  setFormError(
                    cms.errorDetail.replace(
                      "{detail}",
                      e.message.length > 0 ? e.message : `HTTP ${e.status}`
                    )
                  );
                } else {
                  setFormError(state.mode === "create" ? cms.createError : cms.updateError);
                }
              } finally {
                setSaving(false);
              }
            }}
            type="button"
          >
            {saving ? "…" : cms.save}
          </button>
        </div>
      </div>
    </div>
  );
}

function cnField(a: string, b: string) {
  return `${a} ${b}`;
}

function LabeledText({
  label,
  onChange,
  placeholder,
  readOnly,
  value
}: {
  label: string;
  onChange: (v: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  value: string | undefined;
}) {
  return (
    <label className="block text-xs font-medium text-slate-600">
      {label}
      <input
        className={fieldClass + " mt-1"}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
        value={value ?? ""}
      />
    </label>
  );
}

export function OperationsResourceClient({
  columns,
  common,
  contentCms,
  endpoint,
  extraFilters,
  grammarFilterLabels,
  grammarGroupLabels,
  lexemeExampleLabels,
  page,
  searchParam = "q",
  statusParam = "status"
}: {
  columns: Column[];
  common: CommonLabels;
  contentCms?: { kind: "grammar" | "kanji" | "lexeme"; labels: CmsLabels; levelFieldLabel?: string };
  endpoint?: string;
  extraFilters?: ExtraContentFilter[];
  /** Grammar: bộ lọc danh mục theo nhóm (i18n) */
  grammarFilterLabels?: GrammarFilterLabels;
  /** Grammar: tên hiển thị từng `GrammarCategoryGroupId` (i18n) */
  grammarGroupLabels?: Record<string, string>;
  /** Dictionary (lexeme): thêm cột ví dụ câu dưới mỗi từ mục */
  lexemeExampleLabels?: LexemeExampleLabels;
  page: PageLabels;
  searchParam?: string;
  statusParam?: string;
}) {
  const isCmsAdmin = isAdminContentListEndpoint(endpoint);
  const [error, setError] = useState(false);
  const [items, setItems] = useState<ResourceItem[]>([]);
  const [total, setTotal] = useState(0);
  const [listPage, setListPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [summary, setSummary] = useState<AdminContentSummaryResponse | null>(null);
  const [loading, setLoading] = useState(Boolean(endpoint));
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [extraParamState, setExtraParamState] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const [modal, setModal] = useState<CmsModalState | null>(null);

  const setExtra = useCallback((param: string, value: string) => {
    setExtraParamState((prev) => ({ ...prev, [param]: value }));
  }, []);

  const setGrammarCategoryFilters = useCallback((next: { category: string; categoryGroup: string }) => {
    setExtraParamState((prev) => ({
      ...prev,
      category: next.category,
      categoryGroup: next.categoryGroup
    }));
  }, []);

  const extraKey = useMemo(() => JSON.stringify(extraParamState), [extraParamState]);

  const loadCmsListCore = useCallback(async () => {
    if (!endpoint || !isCmsAdmin) {
      return;
    }
    const { listPath, params: merged } = mergeAdminContentQuery(
      endpoint,
      searchParam,
      statusParam,
      query,
      status,
      extraParamState
    );
    const listParams = new URLSearchParams(merged);
    listParams.set("page", String(listPage));
    listParams.set("pageSize", String(pageSize));
    const listUrl = `${listPath}?${listParams.toString()}`;

    const summaryParams = new URLSearchParams(merged);
    summaryParams.delete("page");
    summaryParams.delete("pageSize");
    const summaryPath = listPath.replace("/api/admin/content", "/api/admin/content/summary");
    const summaryUrl = `${summaryPath}?${summaryParams.toString()}`;

    const [sRes, lRes] = await Promise.all([adminApiFetch(summaryUrl), adminApiFetch(listUrl)]);
    if (!sRes.ok) {
      throw await toCmsRequestError(sRes);
    }
    if (!lRes.ok) {
      throw await toCmsRequestError(lRes);
    }
    const sJson = (await sRes.json()) as AdminContentSummaryResponse;
    const lJson = (await lRes.json()) as {
      items?: ResourceItem[];
      page?: number;
      pageSize?: number;
      total?: number;
    };
    setSummary(sJson);
    setItems(Array.isArray(lJson.items) ? lJson.items : []);
    setTotal(typeof lJson.total === "number" ? lJson.total : 0);
    setActionError(null);
  }, [
    endpoint,
    isCmsAdmin,
    listPage,
    pageSize,
    query,
    status,
    extraParamState,
    searchParam,
    statusParam
  ]);

  useEffect(() => {
    setListPage(1);
  }, [query, status, extraKey, searchParam, statusParam]);

  useEffect(() => {
    if (!endpoint) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(false);

    if (isCmsAdmin) {
      void (async () => {
        try {
          await loadCmsListCore();
        } catch {
          if (!cancelled) {
            setError(true);
            setSummary(null);
            setItems([]);
            setTotal(0);
          }
        } finally {
          if (!cancelled) {
            setLoading(false);
          }
        }
      })();
      return () => {
        cancelled = true;
      };
    }

    const params = new URLSearchParams();
    if (query.trim()) {
      params.set(searchParam, query.trim());
    }
    if (status) {
      params.set(statusParam, status);
    }
    for (const [k, v] of Object.entries(extraParamState)) {
      if (v && v.trim() !== "") {
        params.set(k, v.trim());
      }
    }
    const url = params.size > 0 ? `${endpoint}&${params.toString()}` : endpoint;
    setSummary(null);
    void adminApiFetch(url)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("load_failed");
        }
        const json = (await res.json()) as unknown;
        if (!cancelled) {
          if (Array.isArray(json)) {
            setItems(json as ResourceItem[]);
            setTotal(json.length);
          } else if (
            json &&
            typeof json === "object" &&
            "items" in json &&
            Array.isArray((json as { items: ResourceItem[] }).items)
          ) {
            setItems((json as { items: ResourceItem[] }).items);
            {
              const o = json as { total?: number };
              setTotal(typeof o.total === "number" ? o.total : 0);
            }
          } else {
            setItems([]);
            setTotal(0);
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [endpoint, extraKey, isCmsAdmin, listPage, loadCmsListCore, pageSize, query, searchParam, status, statusParam]);

  const pageCount = Math.max(1, Math.ceil(total / pageSize) || 1);
  const rowFrom = total === 0 ? 0 : (listPage - 1) * pageSize + 1;
  const rowTo = total === 0 ? 0 : Math.min(listPage * pageSize, total);

  const statusChartData = useMemo(() => {
    if (isCmsAdmin && summary) {
      return Object.entries(summary.byStatus).map(([name, value]) => ({ name, value }));
    }
    const counts = new Map<string, number>();
    for (const item of items) {
      const key = textValue(item, "status");
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()].map(([name, value]) => ({ name, value }));
  }, [isCmsAdmin, items, summary]);

  const { levelChartData, levelUniqueCount, statusGroupCount } = useMemo(() => {
    if (!contentCms) {
      return {
        levelChartData: [] as { name: string; value: number }[],
        levelUniqueCount: 0,
        statusGroupCount: 0
      };
    }
    if (isCmsAdmin && summary) {
      const raw = Object.entries(summary.byLevel).map(([name, value]) => ({ name, value: Number(value) }));
      if (contentCms.kind === "grammar") {
        return {
          levelChartData: sortGrammarLevelBarRows(raw),
          levelUniqueCount: summary.distinctLevelCount,
          statusGroupCount: Object.keys(summary.byStatus).length
        };
      }
      return {
        levelChartData: raw
          .sort((a, b) => b.value - a.value)
          .slice(0, 14),
        levelUniqueCount: summary.distinctLevelCount,
        statusGroupCount: Object.keys(summary.byStatus).length
      };
    }
    const key = contentCms.kind === "kanji" ? "level" : "jlptLevel";
    const counts = new Map<string, number>();
    const statusSet = new Set<string>();
    for (const item of items) {
      statusSet.add(textValue(item, "status"));
      const v = item[key];
      const label = v === null || v === undefined || v === "" ? "—" : String(v);
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    const rows = [...counts.entries()].map(([name, value]) => ({ name, value }));
    if (contentCms.kind === "grammar") {
      return {
        levelChartData: sortGrammarLevelBarRows(rows),
        levelUniqueCount: counts.size,
        statusGroupCount: statusSet.size
      };
    }
    return {
      levelChartData: rows.sort((a, b) => b.value - a.value).slice(0, 14),
      levelUniqueCount: counts.size,
      statusGroupCount: statusSet.size
    };
  }, [contentCms, isCmsAdmin, items, summary]);

  const categoryChartData = useMemo(() => {
    if (contentCms?.kind !== "grammar") {
      return [] as { name: string; value: number }[];
    }
    const labels = grammarGroupLabels;
    if (isCmsAdmin && labels) {
      const raw =
        summary?.byCategoryGroup ??
        (summary?.byCategory ? aggregateByCategoryGroup(summary.byCategory) : null);
      if (raw) {
        const out: { name: string; value: number }[] = [];
        for (const id of GRAMMAR_CATEGORY_GROUP_CHART_ORDER) {
          const v = Number(raw[id] ?? 0);
          if (v > 0) {
            out.push({ name: labels[id] ?? id, value: v });
          }
        }
        return out;
      }
    }
    const counts = new Map<string, number>();
    for (const item of items) {
      const c = item.category;
      const label = c === null || c === undefined || c === "" ? "—" : String(c);
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    if (labels) {
      const raw = aggregateByCategoryGroup(
        Object.fromEntries([...counts.entries()].map(([k, v]) => [k, v])) as Record<string, number>
      );
      const out: { name: string; value: number }[] = [];
      for (const id of GRAMMAR_CATEGORY_GROUP_CHART_ORDER) {
        const v = Number(raw[id] ?? 0);
        if (v > 0) {
          out.push({ name: labels[id] ?? id, value: v });
        }
      }
      return out;
    }
    return sortCategoryBarRows(
      Object.entries(aggregateByCategoryGroup(Object.fromEntries(counts) as Record<string, number>)).map(
        ([name, value]) => ({ name, value: Number(value) })
      )
    );
  }, [contentCms, grammarGroupLabels, isCmsAdmin, items, summary]);

  const typeSegment = contentCms?.kind ?? "lexeme";

  const saveCms = async (payload: unknown) => {
    const refreshAfterMutation = async () => {
      if (!isCmsAdmin || !endpoint) {
        return;
      }
      setLoading(true);
      try {
        try {
          await loadCmsListCore();
        } catch (e) {
          if (e instanceof CmsRequestError && contentCms) {
            throw new CmsRequestError(
              e.status,
              contentCms.labels.listRefreshFailed.replace(
                "{detail}",
                e.message.length > 0 ? e.message : `HTTP ${e.status}`
              )
            );
          }
          throw e;
        }
      } finally {
        setLoading(false);
      }
    };

    if (
      contentCms &&
      typeof payload === "object" &&
      payload &&
      "method" in payload &&
      (payload as { method: string }).method === "PATCH"
    ) {
      const p = payload as { body: Record<string, unknown>; id: string; method: "PATCH" };
      const res = await adminApiFetch(`/api/admin/content/${typeSegment}/${p.id}`, {
        body: JSON.stringify(p.body),
        headers: { "content-type": "application/json" },
        method: "PATCH"
      });
      if (!res.ok) {
        throw await toCmsRequestError(res);
      }
      setActionError(null);
      await refreshAfterMutation();
      return;
    }
    const res = await adminApiFetch("/api/admin/content", {
      body: JSON.stringify(payload),
      headers: { "content-type": "application/json" },
      method: "POST"
    });
    if (!res.ok) {
      throw await toCmsRequestError(res);
    }
    setActionError(null);
    await refreshAfterMutation();
  };

  const patchStatus = async (id: string, next: "active" | "archived" | "needs_review", reason: string) => {
    setActionError(null);
    const res = await adminApiFetch(`/api/admin/content/${typeSegment}/${id}/status`, {
      body: JSON.stringify({ reason, status: next }),
      headers: { "content-type": "application/json" },
      method: "PATCH"
    });
    if (!res.ok) {
      const err = await toCmsRequestError(res);
      setActionError(
        contentCms
          ? contentCms.labels.errorDetail.replace(
              "{detail}",
              err.message.length > 0 ? err.message : `HTTP ${err.status}`
            )
          : err.message
      );
      return;
    }
    setLoading(true);
    try {
      await loadCmsListCore();
    } catch (e) {
      if (e instanceof CmsRequestError) {
        setActionError(
          contentCms
            ? contentCms.labels.listRefreshFailed.replace(
                "{detail}",
                e.message.length > 0 ? e.message : `HTTP ${e.status}`
              )
            : e.message
        );
      } else {
        setActionError(contentCms ? contentCms.labels.updateError : common.error);
      }
    } finally {
      setLoading(false);
    }
  };

  const refreshAfterLexemeExampleChange = useCallback(async () => {
    if (!isCmsAdmin) {
      return;
    }
    setLoading(true);
    try {
      await loadCmsListCore();
    } catch (e) {
      if (e instanceof CmsRequestError) {
        setActionError(
          contentCms
            ? contentCms.labels.listRefreshFailed.replace(
                "{detail}",
                e.message.length > 0 ? e.message : `HTTP ${e.status}`
              )
            : e.message
        );
      } else {
        setActionError(contentCms ? contentCms.labels.updateError : common.error);
      }
    } finally {
      setLoading(false);
    }
  }, [isCmsAdmin, loadCmsListCore, contentCms, common.error]);

  const dataColSpan = columns.length + (contentCms ? 1 : 0);
  const showLexemeExampleSubrow =
    Boolean(contentCms?.kind === "lexeme" && lexemeExampleLabels);

  return (
    <div className="space-y-6">
      <AdminPageHeader description={page.subtitle} title={page.title} />

      {actionError ? (
        <div
          className="rounded-2xl border border-amber-200/80 bg-amber-50/95 px-4 py-3 text-sm text-amber-950 shadow-sm"
          role="alert"
        >
          {actionError}
        </div>
      ) : null}

      <div
        className={cn(
          "grid grid-cols-1 gap-4",
          contentCms ? "md:grid-cols-2 lg:grid-cols-4" : "md:grid-cols-3"
        )}
      >
        <AdminKpiCard
          label={common.records}
          value={
            loading
              ? "-"
              : (isCmsAdmin ? total : items.length).toLocaleString()
          }
        />
        {contentCms ? (
          <AdminKpiCard
            label={common.levelDistinctKpi}
            value={loading ? "-" : String(levelUniqueCount)}
          />
        ) : null}
        <AdminKpiCard
          label={common.kpiStatusGroups}
          value={
            loading
              ? "-"
              : contentCms
                ? String(statusGroupCount)
                : String(statusChartData.length || 0)
          }
        />
        <AdminKpiCard
          label={common.updatedAt}
          value={
            loading
              ? "-"
              : isCmsAdmin && summary?.lastUpdatedAt
                ? formatAdminDateTime(summary.lastUpdatedAt)
                : items[0]
                  ? formatAdminDateTime(items[0].updatedAt)
                  : "-"
          }
        />
      </div>

      <AdminSection
        actions={
          contentCms ? (
            <button
              className={cn(cmsBtn.base, cmsBtn.primary, "px-4 py-2 text-sm shadow-md")}
              onClick={() => setModal({ mode: "create" })}
              type="button"
            >
              {contentCms.labels.add}
            </button>
          ) : null
        }
        description={contentCms ? common.cmsFiltersHint : undefined}
        title={common.filters}
      >
        <div className="rounded-2xl border border-ink/10 bg-white/95 p-4 shadow-sm ring-1 ring-ink/5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            <AdminFilterField className="sm:col-span-2 lg:col-span-1 2xl:col-span-1" label={common.search}>
              <AdminSearchInput
                aria-label={common.search}
                className="w-full min-w-0 max-w-full md:max-w-md"
                onChange={(event) => setQuery(event.target.value)}
                placeholder={common.search}
                value={query}
              />
            </AdminFilterField>
            <AdminFilterField label={common.status}>
              <AdminSelect
                aria-label={common.status}
                className="w-full min-w-0"
                onChange={(event) => setStatus(event.target.value)}
                value={status}
              >
                <option value="">{common.allStatuses}</option>
                <option value="active">{statusOptionLabel(common, "active")}</option>
                <option value="needs_review">{statusOptionLabel(common, "needs_review")}</option>
                <option value="archived">{statusOptionLabel(common, "archived")}</option>
              </AdminSelect>
            </AdminFilterField>
            {contentCms?.kind === "grammar" && grammarGroupLabels && grammarFilterLabels ? (
              <GrammarCategoryFilter
                extra={extraParamState}
                groupLabels={grammarGroupLabels}
                labels={grammarFilterLabels}
                onChange={setGrammarCategoryFilters}
                rawCategoryCounts={summary?.byCategory}
              />
            ) : null}
            {extraFilters?.map((f) => {
              if (f.control === "select") {
                return (
                  <AdminFilterField key={f.param} label={f.label}>
                    <AdminSelect
                      aria-label={f.label}
                      className="w-full min-w-0"
                      onChange={(e) => setExtra(f.param, e.target.value)}
                      value={extraParamState[f.param] ?? ""}
                    >
                      {f.options.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </AdminSelect>
                  </AdminFilterField>
                );
              }
              if (f.control === "number") {
                return (
                  <AdminFilterField key={f.param} label={f.label}>
                    <input
                      aria-label={f.label}
                      className={cn(numberFieldClass, "w-full min-w-0 max-w-full")}
                      max={f.max}
                      min={f.min}
                      onChange={(e) => setExtra(f.param, e.target.value)}
                      placeholder={f.placeholder ?? f.label}
                      type="number"
                      value={extraParamState[f.param] ?? ""}
                    />
                  </AdminFilterField>
                );
              }
              return (
                <AdminFilterField key={f.param} label={f.label}>
                  <input
                    aria-label={f.label}
                    className="w-full min-w-0 rounded-lg border border-ink/12 bg-white px-3 py-2 text-sm text-ink shadow-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 md:max-w-xs"
                    onChange={(e) => setExtra(f.param, e.target.value)}
                    placeholder={f.placeholder}
                    type="search"
                    value={extraParamState[f.param] ?? ""}
                  />
                </AdminFilterField>
              );
            })}
          </div>
        </div>
      </AdminSection>

      <div
        className={cn(
          "grid grid-cols-1 gap-4",
          !contentCms && "max-w-2xl",
          contentCms &&
            (contentCms.kind === "grammar" ? "md:grid-cols-2 xl:grid-cols-3" : "lg:grid-cols-2")
        )}
      >
        <AdminChartCard description={common.status} title={common.statusDistribution}>
          {statusChartData.length > 0 ? (
            <div className="h-56 w-full min-w-0">
              <ResponsiveContainer height="100%" width="100%">
                <BarChart data={statusChartData} margin={{ bottom: 8, left: 0, right: 8, top: 8 }}>
                  <XAxis
                    dataKey="name"
                    fontSize={11}
                    interval={0}
                    tickLine={false}
                    tick={{ fill: "#475569" }}
                  />
                  <YAxis allowDecimals={false} fontSize={11} tickLine={false} width={28} />
                  <Tooltip
                    contentStyle={{
                      border: "1px solid rgba(23,33,31,0.12)",
                      borderRadius: "8px",
                      fontSize: "12px"
                    }}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {statusChartData.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={STATUS_BAR_COLORS[entry.name] ?? "#6366f1"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <AdminEmptyState title={common.noChartData} />
          )}
        </AdminChartCard>
        {contentCms ? (
          <AdminChartCard description={common.chartLevelDescription} title={common.chartLevelDistribution}>
            {levelChartData.length > 0 ? (
              <div className="h-56 w-full min-w-0">
                <ResponsiveContainer height="100%" width="100%">
                  <BarChart data={levelChartData} margin={{ bottom: 36, left: 0, right: 4, top: 8 }}>
                    <XAxis
                      angle={-22}
                      dataKey="name"
                      fontSize={10}
                      height={48}
                      interval={0}
                      textAnchor="end"
                      tickLine={false}
                      tick={{ fill: "#475569" }}
                    />
                    <YAxis allowDecimals={false} fontSize={11} tickLine={false} width={28} />
                    <Tooltip
                      contentStyle={{
                        border: "1px solid rgba(23,33,31,0.12)",
                        borderRadius: "8px",
                        fontSize: "12px",
                        maxWidth: 280
                      }}
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {levelChartData.map((entry, i) => (
                        <Cell
                          key={`${entry.name}-${i}`}
                          fill={LEVEL_BAR_PALETTE[i % LEVEL_BAR_PALETTE.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <AdminEmptyState title={common.noLevelChartData} />
            )}
          </AdminChartCard>
        ) : null}
        {contentCms?.kind === "grammar" ? (
          <AdminChartCard
            description={common.chartCategoryDescription}
            title={common.chartCategoryDistribution}
          >
            {categoryChartData.length > 0 ? (
              <div className="h-56 w-full min-w-0">
                <ResponsiveContainer height="100%" width="100%">
                  <BarChart data={categoryChartData} margin={{ bottom: 36, left: 0, right: 4, top: 8 }}>
                    <XAxis
                      angle={-22}
                      dataKey="name"
                      fontSize={10}
                      height={48}
                      interval={0}
                      textAnchor="end"
                      tickLine={false}
                      tick={{ fill: "#475569" }}
                    />
                    <YAxis allowDecimals={false} fontSize={11} tickLine={false} width={28} />
                    <Tooltip
                      contentStyle={{
                        border: "1px solid rgba(23,33,31,0.12)",
                        borderRadius: "8px",
                        fontSize: "12px",
                        maxWidth: 280
                      }}
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {categoryChartData.map((entry, i) => (
                        <Cell
                          key={`${entry.name}-${i}`}
                          fill={LEVEL_BAR_PALETTE[(i + 4) % LEVEL_BAR_PALETTE.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <AdminEmptyState title={common.noCategoryChartData} />
            )}
          </AdminChartCard>
        ) : null}
      </div>

      <AdminSection title={page.title}>
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            {loading ? <div className="p-6 text-sm text-slate-600">{common.loading}</div> : null}
            {error ? <div className="p-6 text-sm text-red-700">{common.error}</div> : null}
            {!loading && !error && !endpoint ? (
              <AdminEmptyState title={page.empty}>{common.backendMissing}</AdminEmptyState>
            ) : null}
            {!loading && !error && endpoint && items.length === 0 ? (
              <AdminEmptyState title={page.empty}>{common.empty}</AdminEmptyState>
            ) : null}
            {!loading && !error && items.length > 0 ? (
              <AdminDataTable>
                <AdminDataTableHead>
                  <AdminDataTableRow>
                    {columns.map((column) => (
                      <AdminDataTableTh key={column.key} title={column.thTitle}>
                        {column.label}
                      </AdminDataTableTh>
                    ))}
                    {contentCms ? <AdminDataTableTh>{contentCms.labels.actions}</AdminDataTableTh> : null}
                  </AdminDataTableRow>
                </AdminDataTableHead>
                <AdminDataTableBody>
                  {items.map((item, index) => {
                    const idKey = String(item.id ?? index);
                    const rawExamples = item.lexemeExamples;
                    const exampleRows: LexemeExampleRow[] = Array.isArray(rawExamples)
                      ? (rawExamples as LexemeExampleRow[])
                      : [];
                    const headword = String(item.headword ?? "");
                    const lexId = String(item.id ?? "");
                    const mainRow = (
                      <AdminDataTableRow>
                        {columns.map((column) => {
                          const value = cellDisplay(item, column);
                          return (
                            <AdminDataTableTd
                              key={column.key}
                              muted={column.key !== "status" && column.key !== columns[0]?.key}
                            >
                              {column.key === "status" ? (
                                <AdminStatusBadge tone={statusTone(value)}>{value}</AdminStatusBadge>
                              ) : (
                                value
                              )}
                            </AdminDataTableTd>
                          );
                        })}
                        {contentCms ? (
                          <AdminDataTableTd className="w-0 max-w-none align-middle">
                            <div
                              className="flex max-w-[100%] flex-nowrap items-center justify-end gap-1 overflow-x-auto pr-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                              role="group"
                              aria-label={contentCms.labels.actions}
                            >
                              <button
                                aria-label={contentCms.labels.edit}
                                className={cn(cmsIcon.base, cmsIcon.edit)}
                                onClick={() => setModal({ item, mode: "edit" })}
                                title={contentCms.labels.edit}
                                type="button"
                              >
                                <IconPencil />
                                <span className="sr-only">{contentCms.labels.edit}</span>
                              </button>
                              <button
                                aria-label={contentCms.labels.publish}
                                className={cn(cmsIcon.base, cmsIcon.publish)}
                                onClick={async () => {
                                  if (!window.confirm(contentCms.labels.publishConfirm)) {
                                    return;
                                  }
                                  await patchStatus(
                                    String(item.id),
                                    "active",
                                    "Quick publish from CMS"
                                  );
                                }}
                                title={contentCms.labels.publish}
                                type="button"
                              >
                                <IconCheckPublish />
                                <span className="sr-only">{contentCms.labels.publish}</span>
                              </button>
                              <button
                                aria-label={contentCms.labels.review}
                                className={cn(cmsIcon.base, cmsIcon.review)}
                                onClick={async () => {
                                  if (!window.confirm(contentCms.labels.reviewConfirm)) {
                                    return;
                                  }
                                  await patchStatus(
                                    String(item.id),
                                    "needs_review",
                                    "Mark needs review from CMS"
                                  );
                                }}
                                title={contentCms.labels.review}
                                type="button"
                              >
                                <IconFlagReview />
                                <span className="sr-only">{contentCms.labels.review}</span>
                              </button>
                              <button
                                aria-label={contentCms.labels.archive}
                                className={cn(cmsIcon.base, cmsIcon.danger)}
                                onClick={async () => {
                                  if (!window.confirm(contentCms.labels.archiveConfirm)) {
                                    return;
                                  }
                                  await patchStatus(
                                    String(item.id),
                                    "archived",
                                    "Archived from CMS list"
                                  );
                                }}
                                title={contentCms.labels.archive}
                                type="button"
                              >
                                <IconArchive />
                                <span className="sr-only">{contentCms.labels.archive}</span>
                              </button>
                            </div>
                          </AdminDataTableTd>
                        ) : null}
                      </AdminDataTableRow>
                    );
                    if (showLexemeExampleSubrow && lexemeExampleLabels) {
                      return (
                        <Fragment key={idKey}>
                          {mainRow}
                          <AdminDataTableRow>
                            <AdminDataTableTd
                              className="!p-0 border-b border-ink/8 bg-slate-50/80"
                              colSpan={dataColSpan}
                            >
                              <LexemeExamplesSubrow
                                examples={exampleRows}
                                headword={headword}
                                labels={lexemeExampleLabels}
                                lexemeId={lexId}
                                onChanged={refreshAfterLexemeExampleChange}
                              />
                            </AdminDataTableTd>
                          </AdminDataTableRow>
                        </Fragment>
                      );
                    }
                    return <Fragment key={idKey}>{mainRow}</Fragment>;
                  })}
                </AdminDataTableBody>
              </AdminDataTable>
            ) : null}
          </div>
          {isCmsAdmin ? (
            <div
              className="flex flex-col gap-3 border-t border-slate-200 p-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
            >
              <p className="text-sm text-slate-600">
                {common.paginationRowsRange
                  .replace("{from}", String(rowFrom))
                  .replace("{to}", String(rowTo))
                  .replace("{total}", String(total))}
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <span>{common.pageSizeLabel}</span>
                  <select
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-ink"
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setListPage(1);
                    }}
                    value={pageSize}
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </label>
                <span className="text-sm text-slate-600">
                  {common.paginationPageOf
                    .replace("{current}", String(listPage))
                    .replace("{totalPages}", String(pageCount))}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-ink enabled:hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={listPage <= 1 || loading}
                    onClick={() => setListPage((p) => Math.max(1, p - 1))}
                    type="button"
                  >
                    {common.paginationPrev}
                  </button>
                  <button
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-ink enabled:hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={listPage >= pageCount || loading}
                    onClick={() => setListPage((p) => Math.min(pageCount, p + 1))}
                    type="button"
                  >
                    {common.paginationNext}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </AdminSection>

      {contentCms ? (
        <CmsModal
          cms={contentCms.labels}
          kind={contentCms.kind}
          levelFieldLabel={contentCms.levelFieldLabel}
          onClose={() => setModal(null)}
          onSave={async (p) => saveCms(p)}
          open={modal != null}
          state={modal ?? { mode: "create" }}
        />
      ) : null}
    </div>
  );
}
