"use client";

import { AdminStatusBadge, cn } from "@nihongo-bjt/ui";
import { useCallback, useState } from "react";

import { CmsRequestError, toCmsRequestError } from "@/lib/admin-api-error";
import { adminApiFetch } from "@/lib/admin-api";

export type LexemeExampleRow = {
  exampleSentenceId: string;
  japaneseText: string;
  linkId: string;
  reading: string | null;
  senseId: string;
  sensePosition: number;
  status: string;
  translationVi: string | null;
};

export type LexemeExampleLabels = {
  add: string;
  addReasonDefault: string;
  cancel: string;
  editReasonDefault: string;
  delete: string;
  deleteReasonDefault: string;
  deleteReasonPlaceholder: string;
  edit: string;
  empty: string;
  error: string;
  japanese: string;
  reading: string;
  reason: string;
  saving: string;
  save: string;
  sectionTitle: string;
  translation: string;
};

const fieldClass =
  "mt-0.5 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-ink shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-200";

const btnPrimary =
  "rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-md shadow-indigo-600/20 ring-1 ring-indigo-500/20 hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-1 disabled:opacity-50";
const btnSecondary =
  "rounded-lg border-2 border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 shadow-sm hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-1 disabled:opacity-50";
/** Hàng ví dụ: Sửa */
const btnRowEdit =
  "inline-flex items-center justify-center rounded-lg border-2 border-indigo-300/80 bg-indigo-50 px-2.5 py-1.5 text-xs font-semibold text-indigo-900 shadow-sm hover:border-indigo-400 hover:bg-indigo-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-1";
/** Hàng ví dụ: Gỡ */
const btnRowDelete =
  "inline-flex items-center justify-center rounded-lg border-2 border-red-200/90 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-900 shadow-sm hover:border-red-300 hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-offset-1";
const btnCmsAdd =
  "w-full sm:w-auto rounded-lg border-2 border-indigo-500 bg-indigo-600 px-3 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-600/25 hover:border-indigo-400 hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-1 disabled:opacity-50";

function statusTone(s: string): "neutral" | "good" | "warning" {
  if (s === "active") {
    return "good";
  }
  if (s === "archived") {
    return "neutral";
  }
  return "warning";
}

export function LexemeExamplesSubrow({
  examples,
  headword,
  labels,
  lexemeId,
  onChanged
}: {
  examples: LexemeExampleRow[];
  headword: string;
  labels: LexemeExampleLabels;
  lexemeId: string;
  onChanged: () => void | Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  /** `new` = add; else linkId for edit */
  const [editing, setEditing] = useState<"new" | null | string>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [jp, setJp] = useState("");
  const [read, setRead] = useState("");
  const [vi, setVi] = useState("");
  const [reason, setReason] = useState("");
  const [deleteReason, setDeleteReason] = useState("");

  const loadFieldsFor = useCallback(
    (ex: LexemeExampleRow) => {
      setJp(ex.japaneseText);
      setRead(ex.reading ?? "");
      setVi(ex.translationVi ?? "");
      setReason(labels.editReasonDefault);
    },
    [labels.editReasonDefault]
  );

  const clearForm = useCallback(() => {
    setJp("");
    setRead("");
    setVi("");
    setReason("");
    setFormError(null);
  }, []);

  const startAdd = useCallback(() => {
    setEditing("new");
    setDeleting(null);
    setJp("");
    setRead("");
    setVi("");
    setReason(labels.addReasonDefault);
    setFormError(null);
  }, [labels.addReasonDefault]);

  const doSave = useCallback(
    async (isNew: boolean) => {
      const r = reason.trim();
      if (r.length < 3) {
        setFormError(labels.reason);
        return;
      }
      if (!jp.trim()) {
        setFormError(labels.japanese);
        return;
      }
      setSaving(true);
      setFormError(null);
      try {
        if (isNew) {
          const res = await adminApiFetch(`/api/admin/lexemes/${lexemeId}/examples`, {
            body: JSON.stringify({
              japaneseText: jp.trim(),
              reason: r,
              reading: read.trim() || null,
              translationVi: vi.trim() || null
            }),
            headers: { "content-type": "application/json" },
            method: "POST"
          });
          if (!res.ok) {
            throw await toCmsRequestError(res);
          }
        } else {
          const res = await adminApiFetch(`/api/admin/lexemes/${lexemeId}/examples/${editing}`, {
            body: JSON.stringify({
              japaneseText: jp.trim(),
              reason: r,
              reading: read.trim() || null,
              translationVi: vi.trim() || null
            }),
            headers: { "content-type": "application/json" },
            method: "PATCH"
          });
          if (!res.ok) {
            throw await toCmsRequestError(res);
          }
        }
        await onChanged();
        setEditing(null);
        setDeleting(null);
        clearForm();
      } catch (e) {
        if (e instanceof CmsRequestError) {
          setFormError(e.message);
        } else {
          setFormError(labels.error);
        }
      } finally {
        setSaving(false);
      }
    },
    [clearForm, editing, jp, labels.error, labels.japanese, labels.reason, lexemeId, onChanged, read, reason, vi]
  );

  const doDelete = useCallback(
    async (linkId: string) => {
      const r = deleteReason.trim();
      if (r.length < 3) {
        setFormError(labels.deleteReasonPlaceholder);
        return;
      }
      setSaving(true);
      setFormError(null);
      try {
        const res = await adminApiFetch(`/api/admin/lexemes/${lexemeId}/examples/${linkId}`, {
          body: JSON.stringify({ reason: r }),
          headers: { "content-type": "application/json" },
          method: "DELETE"
        });
        if (!res.ok) {
          throw await toCmsRequestError(res);
        }
        await onChanged();
        setDeleting(null);
        setDeleteReason("");
        setFormError(null);
      } catch (e) {
        if (e instanceof CmsRequestError) {
          setFormError(e.message);
        } else {
          setFormError(labels.error);
        }
      } finally {
        setSaving(false);
      }
    },
    [deleteReason, labels.deleteReasonPlaceholder, labels.error, lexemeId, onChanged]
  );

  return (
    <div className="space-y-3 border-l-2 border-indigo-200/80 bg-slate-50/80 py-2 pl-3 pr-1">
      <h4 className="text-xs font-semibold text-slate-700">
        {labels.sectionTitle}
        <span className="ml-1 font-normal text-slate-500">「{headword}」</span>
      </h4>

      {examples.length === 0 && editing !== "new" ? <p className="text-xs text-slate-600">{labels.empty}</p> : null}

      <ul className="space-y-2">
        {examples.map((ex) => {
          const isRowEdit = editing === ex.linkId;
          return (
            <li
              className="rounded-md border border-slate-200/80 bg-white/90 px-2 py-1.5 text-xs shadow-sm"
              key={ex.linkId}
            >
              {isRowEdit ? (
                <div className="space-y-1.5">
                  <label className="block">
                    <span className="text-slate-600">{labels.japanese}</span>
                    <textarea
                      className={cn(fieldClass, "min-h-[52px]")}
                      onChange={(e) => setJp(e.target.value)}
                      value={jp}
                    />
                  </label>
                  <label className="block">
                    <span className="text-slate-600">{labels.reading}</span>
                    <input className={fieldClass} onChange={(e) => setRead(e.target.value)} value={read} />
                  </label>
                  <label className="block">
                    <span className="text-slate-600">{labels.translation}</span>
                    <input className={fieldClass} onChange={(e) => setVi(e.target.value)} value={vi} />
                  </label>
                  <label className="block">
                    <span className="text-slate-600">{labels.reason}</span>
                    <input className={fieldClass} onChange={(e) => setReason(e.target.value)} value={reason} />
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      className={btnPrimary}
                      disabled={saving}
                      onClick={() => void doSave(false)}
                      type="button"
                    >
                      {saving ? labels.saving : labels.save}
                    </button>
                    <button
                      className={btnSecondary}
                      disabled={saving}
                      onClick={() => {
                        setEditing(null);
                        clearForm();
                        setFormError(null);
                      }}
                      type="button"
                    >
                      {labels.cancel}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="whitespace-pre-wrap break-words font-medium text-ink">{ex.japaneseText}</p>
                    {ex.reading ? <p className="text-[11px] text-slate-500">{ex.reading}</p> : null}
                    {ex.translationVi ? <p className="text-slate-600">{ex.translationVi}</p> : null}
                    <div className="mt-0.5">
                      <AdminStatusBadge tone={statusTone(ex.status)}>{ex.status}</AdminStatusBadge>
                    </div>
                  </div>
                  {deleting !== ex.linkId ? (
                    <div className="flex shrink-0 flex-wrap gap-1.5">
                      <button
                        className={btnRowEdit}
                        onClick={() => {
                          setEditing(ex.linkId);
                          setDeleting(null);
                          loadFieldsFor(ex);
                          setFormError(null);
                        }}
                        type="button"
                      >
                        {labels.edit}
                      </button>
                      <button
                        className={btnRowDelete}
                        onClick={() => {
                          setDeleting(ex.linkId);
                          setDeleteReason(labels.deleteReasonDefault);
                          setFormError(null);
                        }}
                        type="button"
                      >
                        {labels.delete}
                      </button>
                    </div>
                  ) : null}
                </div>
              )}
              {deleting === ex.linkId && !isRowEdit ? (
                <div className="mt-2 space-y-1.5 border-t border-red-100 pt-2">
                  <input
                    className={fieldClass}
                    onChange={(e) => setDeleteReason(e.target.value)}
                    placeholder={labels.deleteReasonPlaceholder}
                    value={deleteReason}
                  />
                  <div className="flex gap-1.5">
                    <button
                      className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-md shadow-red-600/20 ring-1 ring-red-500/20 hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-1 disabled:opacity-50"
                      disabled={saving}
                      onClick={() => void doDelete(ex.linkId)}
                      type="button"
                    >
                      {labels.delete}
                    </button>
                    <button
                      className={btnSecondary}
                      disabled={saving}
                      onClick={() => {
                        setDeleting(null);
                        setDeleteReason("");
                      }}
                      type="button"
                    >
                      {labels.cancel}
                    </button>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {formError ? <p className="text-xs text-red-800">{formError}</p> : null}

      {editing === "new" ? (
        <div className="space-y-1.5 rounded-md border border-indigo-200/60 bg-white p-2">
          <label className="block">
            <span className="text-xs text-slate-600">{labels.japanese}</span>
            <textarea
              className={cn(fieldClass, "min-h-[52px]")}
              onChange={(e) => setJp(e.target.value)}
              value={jp}
            />
          </label>
          <label className="block">
            <span className="text-xs text-slate-600">{labels.reading}</span>
            <input className={fieldClass} onChange={(e) => setRead(e.target.value)} value={read} />
          </label>
          <label className="block">
            <span className="text-xs text-slate-600">{labels.translation}</span>
            <input className={fieldClass} onChange={(e) => setVi(e.target.value)} value={vi} />
          </label>
          <label className="block">
            <span className="text-xs text-slate-600">{labels.reason}</span>
            <input className={fieldClass} onChange={(e) => setReason(e.target.value)} value={reason} />
          </label>
          <div className="flex gap-1.5">
            <button className={btnPrimary} disabled={saving} onClick={() => void doSave(true)} type="button">
              {saving ? labels.saving : labels.save}
            </button>
            <button
              className={btnSecondary}
              disabled={saving}
              onClick={() => {
                setEditing(null);
                clearForm();
              }}
              type="button"
            >
              {labels.cancel}
            </button>
          </div>
        </div>
      ) : null}

      {editing == null && !saving ? (
        <button className={btnCmsAdd} onClick={startAdd} type="button">
          {labels.add}
        </button>
      ) : null}
    </div>
  );
}
