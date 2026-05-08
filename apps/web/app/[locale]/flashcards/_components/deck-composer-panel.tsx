"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent
} from "react";

import { learnerApiFetch } from "../../../../lib/learner-api";
import { parseBulkDeckLines } from "./bulk-deck-import-parse";

const allowedMime = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const maxImageBytes = 10 * 1024 * 1024;

export interface DeckComposerLabels {
  cancel: string;
  composerAddCard: string;
  composerCardLimit: string;
  composerCloseShortcuts: string;
  composerCreate: string;
  composerCreateAndPractice: string;
  composerCreating: string;
  composerDefinitionLabel: string;
  composerDefinitionPlaceholder: string;
  composerDeleteAll: string;
  composerDeleteAllConfirm: string;
  composerDeleteRowAria: string;
  composerDragHandleAria: string;
  composerHeadline: string;
  composerImageAttached: string;
  composerImportAppend: string;
  composerMoveRowDown: string;
  composerMoveRowUp: string;
  composerImportHint: string;
  composerImportInvalidLine: string;
  composerImportPlaceholder: string;
  composerImportReplace: string;
  composerImportTitle: string;
  composerImportTooMany: string;
  composerNeedOneCard: string;
  composerNeedTitle: string;
  composerNoSearchResults: string;
  composerRowImageUrlPlaceholder: string;
  composerSearchPlaceholder: string;
  composerShortcutsBody: string;
  composerShortcutsTitle: string;
  composerSwapSides: string;
  composerTermLabel: string;
  composerTermPlaceholder: string;
  composerToolbarAria: string;
  composerUploadImage: string;
  composerUploading: string;
  composerVisibilityLabel: string;
  composerShortcuts: string;
  createDeckTitle: string;
  descLabel: string;
  descPlaceholder: string;
  error: string;
  private: string;
  public: string;
  titleJaLabel: string;
  titleJaPlaceholder: string;
  titleLabel: string;
  titlePlaceholder: string;
}

type DraftRow = {
  back: string;
  front: string;
  id: string;
  imageAssetId: string | null;
  imageUrl: string;
};

function emptyRow(): DraftRow {
  return { back: "", front: "", id: crypto.randomUUID(), imageAssetId: null, imageUrl: "" };
}

async function uploadLearnerImage(file: File, userId: string): Promise<string> {
  if (!allowedMime.has(file.type)) {
    throw new Error("type");
  }
  if (file.size < 1 || file.size > maxImageBytes) {
    throw new Error("size");
  }
  const pres = await learnerApiFetch("/api/media/presign-upload", {
    body: JSON.stringify({
      fileName: file.name || "upload.bin",
      mimeType: file.type,
      userId
    }),
    headers: { "Content-Type": "application/json" },
    method: "POST"
  });
  if (!pres.ok) throw new Error("presign");
  const { assetId, uploadUrl } = (await pres.json()) as { assetId: string; uploadUrl: string };
  const put = await fetch(uploadUrl, { body: file, headers: { "Content-Type": file.type }, method: "PUT" });
  if (!put.ok) throw new Error("put");
  const done = await learnerApiFetch("/api/media/complete-upload", {
    body: JSON.stringify({ assetId, byteSize: file.size, userId }),
    headers: { "Content-Type": "application/json" },
    method: "POST"
  });
  if (!done.ok) throw new Error("complete");
  return assetId;
}

const btnBase =
  "inline-flex min-h-10 items-center justify-center rounded-xl px-4 text-sm font-bold outline-none ring-offset-2 transition focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-45";
const btnPrimary = `${btnBase} bg-leaf text-white hover:bg-leaf/90`;
const btnSecondary = `${btnBase} border border-ink/15 bg-surface text-ink hover:border-ink/25 hover:bg-paper`;
const btnNeutral = `${btnBase} border border-ink/12 bg-paper/80 text-ink hover:bg-paper`;
const inputClass =
  "min-h-11 w-full rounded-xl border border-ink/12 bg-paper/60 px-3 text-sm text-ink outline-none focus:border-leaf focus:ring-1 focus:ring-leaf";

export function DeckComposerPanel({
  labels,
  onCancel,
  onSuccess,
  userId
}: {
  labels: DeckComposerLabels;
  onCancel: () => void;
  onSuccess: (opts: { startReview: boolean }) => void | Promise<void>;
  userId: string;
}) {
  const formId = useId();
  const [titleVi, setTitleVi] = useState("");
  const [titleJa, setTitleJa] = useState("");
  const [descVi, setDescVi] = useState("");
  const [visibility, setVisibility] = useState<"private" | "public">("private");
  const [rows, setRows] = useState<DraftRow[]>(() => [emptyRow(), emptyRow(), emptyRow()]);
  const [search, setSearch] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingRowId, setUploadingRowId] = useState<string | null>(null);
  const dragFrom = useRef<number | null>(null);
  const submittingRef = useRef(false);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  const filteredIndexes = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows.map((_, i) => i);
    return rows
      .map((r, i) => (r.front.toLowerCase().includes(q) || r.back.toLowerCase().includes(q) ? i : -1))
      .filter((i) => i >= 0);
  }, [rows, search]);

  const resetForm = useCallback(() => {
    setTitleVi("");
    setTitleJa("");
    setDescVi("");
    setVisibility("private");
    setRows([emptyRow(), emptyRow(), emptyRow()]);
    setSearch("");
    setImportText("");
    setError(null);
  }, []);

  const commitImport = useCallback(
    (mode: "append" | "replace") => {
      const parsed = parseBulkDeckLines(importText);
      if (!parsed.ok) {
        if (parsed.key === "too_many") {
          setError(labels.composerImportTooMany);
        } else {
          setError(labels.composerImportInvalidLine.replace("{line}", String(parsed.line)));
        }
        return;
      }
      const next: DraftRow[] = parsed.rows.map((r) => ({
        back: r.backText,
        front: r.frontText,
        id: crypto.randomUUID(),
        imageAssetId: null,
        imageUrl: r.imageUrl ?? ""
      }));
      if (mode === "replace") {
        setRows(next.length ? next : [emptyRow()]);
      } else {
        setRows((prev) => [...prev, ...next].slice(0, 200));
      }
      setImportOpen(false);
      setImportText("");
      setError(null);
    },
    [importText, labels]
  );

  const swapAll = useCallback(() => {
    setRows((prev) => prev.map((r) => ({ ...r, back: r.front, front: r.back })));
  }, []);

  const deleteAll = useCallback(() => {
    if (typeof window !== "undefined" && window.confirm(labels.composerDeleteAllConfirm)) {
      setRows([emptyRow(), emptyRow(), emptyRow()]);
    }
  }, [labels.composerDeleteAllConfirm]);

  const moveRow = useCallback((from: number, to: number) => {
    if (from === to || from < 0 || to < 0) return;
    setRows((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      if (!item) return prev;
      next.splice(to, 0, item);
      return next;
    });
  }, []);

  const onDragStartRow = (e: DragEvent, index: number) => {
    dragFrom.current = index;
    setDraggingIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("application/x-nihongo-row-index", String(index));
    e.dataTransfer.setData("text/plain", String(index));
  };

  const onDragEndRow = () => {
    dragFrom.current = null;
    setDraggingIndex(null);
    setDragOverIndex(null);
  };

  const onDragOverCard = (e: DragEvent, rowIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    setDragOverIndex(rowIndex);
  };

  const onDropRow = (e: DragEvent, toIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    const raw =
      e.dataTransfer.getData("application/x-nihongo-row-index") || e.dataTransfer.getData("text/plain");
    const from = Number.parseInt(raw, 10);
    onDragEndRow();
    if (Number.isNaN(from)) {
      return;
    }
    moveRow(from, toIndex);
  };

  const submit = useCallback(
    async (startReview: boolean) => {
      setError(null);
      if (submittingRef.current) {
        return;
      }
      if (!titleVi.trim()) {
        setError(labels.composerNeedTitle);
        return;
      }
      const cards = rows
        .map((r) => ({
          backText: r.back.trim(),
          frontText: r.front.trim(),
          imageUrl: r.imageUrl.trim() || undefined,
          primaryImageAssetId: r.imageAssetId || undefined
        }))
        .filter((c) => c.frontText.length > 0 && c.backText.length > 0);
      if (cards.length === 0) {
        setError(labels.composerNeedOneCard);
        return;
      }
      if (cards.length > 200) {
        setError(labels.composerCardLimit);
        return;
      }
      submittingRef.current = true;
      setSubmitting(true);
      try {
        const filtered = cards.map((c) => {
          const { primaryImageAssetId, ...rest } = c;
          if (primaryImageAssetId) {
            return { ...rest, primaryImageAssetId };
          }
          return rest;
        });
        const http = await learnerApiFetch("/api/flashcards/decks", {
          body: JSON.stringify({
            cards: filtered,
            descriptionVi: descVi.trim() || undefined,
            titleJa: titleJa.trim() || undefined,
            titleVi: titleVi.trim(),
            userId,
            visibility
          }),
          headers: { "Content-Type": "application/json" },
          method: "POST"
        });
        if (!http.ok) throw new Error("create_failed");
        resetForm();
        await onSuccess({ startReview });
      } catch {
        setError(labels.error);
      } finally {
        submittingRef.current = false;
        setSubmitting(false);
      }
    },
    [
      descVi,
      labels,
      onSuccess,
      resetForm,
      rows,
      titleJa,
      titleVi,
      userId,
      visibility
    ]
  );

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if ((ev.metaKey || ev.ctrlKey) && ev.key === "Enter") {
        ev.preventDefault();
        void submit(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [submit]);

  const handleRowFile = async (rowId: string, ev: ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0];
    ev.target.value = "";
    if (!file) return;
    const idx = rows.findIndex((r) => r.id === rowId);
    if (idx < 0) return;
    setUploadingRowId(rowId);
    setError(null);
    try {
      const assetId = await uploadLearnerImage(file, userId);
      setRows((prev) => {
        const next = [...prev];
        const r = next[idx];
        if (r) {
          next[idx] = { ...r, imageAssetId: assetId, imageUrl: "" };
        }
        return next;
      });
    } catch {
      setError(labels.error);
    } finally {
      setUploadingRowId(null);
    }
  };

  const actionBar = () => (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <button
        className={btnNeutral}
        disabled={submitting}
        onClick={onCancel}
        type="button"
      >
        {labels.cancel}
      </button>
      <button
        className={btnSecondary}
        disabled={submitting}
        onClick={() => void submit(false)}
        type="button"
      >
        {submitting ? labels.composerCreating : labels.composerCreate}
      </button>
      <button className={btnPrimary} disabled={submitting} onClick={() => void submit(true)} type="button">
        {submitting ? labels.composerCreating : labels.composerCreateAndPractice}
      </button>
    </div>
  );

  return (

    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-widest text-leaf">{labels.composerHeadline}</p>
          <h2 className="mt-1 text-lg font-black text-ink sm:text-xl" id={`${formId}-title`}>
            {labels.createDeckTitle}
          </h2>
        </div>
        {actionBar()}
      </div>

      <div className="space-y-4 rounded-xl border border-ink/8 bg-white p-3 sm:p-5 shadow-sm transition-shadow duration-300">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <span className="text-xs font-bold text-muted">{labels.composerVisibilityLabel}</span>
          <div className="inline-flex rounded-xl border border-ink/10 bg-paper/50 p-0.5" role="group">
            <button
              aria-pressed={visibility === "private"}
              className={`rounded-lg px-3 py-2 text-xs font-black outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-accent transition-colors duration-200 ${
                visibility === "private" ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"
              }`}
              onClick={() => setVisibility("private")}
              type="button"
            >
              {labels.private}
            </button>
            <button
              aria-pressed={visibility === "public"}
              className={`rounded-lg px-3 py-2 text-xs font-black outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-accent transition-colors duration-200 ${
                visibility === "public" ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"
              }`}
              onClick={() => setVisibility("public")}
              type="button"
            >
              {labels.public}
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-bold text-ink" htmlFor={`${formId}-tv`}>
              {labels.titleLabel}
            </label>
            <input
              className="min-h-11 w-full border-b-2 border-ink/12 bg-transparent px-0 text-base font-semibold text-ink outline-none transition-all duration-200 placeholder:text-muted/50 focus:border-leaf focus:shadow focus:shadow-leaf/10"
              id={`${formId}-tv`}
              maxLength={120}
              onChange={(e) => setTitleVi(e.target.value)}
              placeholder={labels.titlePlaceholder}
              type="text"
              value={titleVi}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-ink" htmlFor={`${formId}-tj`}>
              {labels.titleJaLabel}
            </label>
            <input
              className="min-h-10 w-full border-b-2 border-ink/8 bg-transparent px-0 text-sm text-ink outline-none transition-all duration-200 placeholder:text-muted/40 focus:border-leaf focus:shadow focus:shadow-leaf/10"
              id={`${formId}-tj`}
              maxLength={120}
              onChange={(e) => setTitleJa(e.target.value)}
              placeholder={labels.titleJaPlaceholder}
              type="text"
              value={titleJa}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-ink" htmlFor={`${formId}-d`}>
              {labels.descLabel}
            </label>
            <input
              className="min-h-10 w-full border-b-2 border-ink/8 bg-transparent px-0 text-sm text-ink outline-none transition-all duration-200 placeholder:text-muted/40 focus:border-leaf focus:shadow focus:shadow-leaf/10"
              id={`${formId}-d`}
              maxLength={500}
              onChange={(e) => setDescVi(e.target.value)}
              placeholder={labels.descPlaceholder}
              type="text"
              value={descVi}
            />
          </div>
        </div>

      </div>

      <div
        aria-label={labels.composerToolbarAria}
        className="flex flex-wrap items-center gap-2"
        role="toolbar"
      >
        <button
          className={`${btnSecondary} min-h-9 px-3 text-xs font-bold`}
          onClick={() => setImportOpen(true)}
          type="button"
        >
          + {labels.composerImportTitle}
        </button>
        <button className={`${btnSecondary} min-h-9 px-3 text-xs font-bold`} onClick={swapAll} type="button">
          {labels.composerSwapSides}
        </button>
        <div className="flex-1" />
        <input
          aria-label={labels.composerSearchPlaceholder}
          className={`${inputClass} min-h-9 min-w-0 max-w-xs text-xs`}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={labels.composerSearchPlaceholder}
          type="search"
          value={search}
        />
        <button
          className={`${btnNeutral} min-h-9 px-3 text-xs font-bold`}
          onClick={() => setShortcutsOpen(true)}
          type="button"
        >
          {labels.composerShortcuts}
        </button>
        <button
          className={`${btnNeutral} min-h-9 border-sakura/25 px-3 text-xs font-bold text-sakura hover:bg-sakura/10`}
          onClick={deleteAll}
          type="button"
        >
          {labels.composerDeleteAll}
        </button>
      </div>

      {error ? (
        <p className="text-sm text-sakura" role="alert">
          {error}
        </p>
      ) : null}

      <div className="space-y-3">
        {filteredIndexes.length === 0 && search.trim() ? (
          <p className="text-sm text-muted">{labels.composerNoSearchResults}</p>
        ) : null}
        {filteredIndexes.map((rowIndex) => {
          const r = rows[rowIndex]!;
          const displayNum = rowIndex + 1;
          const isDropTarget = dragOverIndex === rowIndex;
            const isDragging = draggingIndex === rowIndex;
            return (
              <div
                className={`min-w-0 rounded-xl border bg-white p-3 sm:p-4 transition-all duration-200 ease-in-out shadow-sm ${
                  isDropTarget ? "border-leaf ring-2 ring-leaf/25 scale-[1.01] shadow-leaf/10" : "border-ink/8"
                } ${isDragging ? "opacity-55" : ""}`}
                key={r.id}
                tabIndex={0}
                aria-label={`Card ${displayNum}`}
                onDragLeave={(e) => {
                  const rel = e.relatedTarget as Node | null;
                  if (rel && e.currentTarget.contains(rel)) return;
                  setDragOverIndex((v) => (v === rowIndex ? null : v));
                }}
                onDragOver={(e) => onDragOverCard(e, rowIndex)}
                onDrop={(e) => onDropRow(e, rowIndex)}
                onFocus={() => setDragOverIndex(rowIndex)}
                onBlur={() => setDragOverIndex(null)}
              >
                <div className="mb-2.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-ink/6 pb-2.5">
                  <div className="flex min-w-0 items-center gap-1 flex-wrap">
                    <span
                      aria-hidden
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-ink/5 text-xs font-black text-muted select-none"
                    >
                      {displayNum}
                    </span>
                    <div
                      aria-label={`${labels.composerDragHandleAria} ${displayNum}`}
                      className="flex h-7 w-7 shrink-0 cursor-grab touch-none select-none items-center justify-center rounded-md text-muted/60 hover:bg-ink/10 hover:text-ink active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-leaf"
                      draggable
                      onDragEnd={onDragEndRow}
                      onDragStart={(e) => onDragStartRow(e, rowIndex)}
                      role="button"
                      tabIndex={0}
                    >
                      <svg aria-hidden className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm8 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM8 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm8 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm-8 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm8 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0z" />
                      </svg>
                    </div>
                    <button
                      aria-label={labels.composerMoveRowUp}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-muted/60 hover:bg-ink/10 hover:text-ink focus-visible:ring-2 focus-visible:ring-leaf disabled:pointer-events-none disabled:opacity-30"
                      disabled={rowIndex <= 0}
                      onClick={() => moveRow(rowIndex, rowIndex - 1)}
                      type="button"
                    >
                      <svg aria-hidden className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path d="m18 15-6-6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                    <button
                      aria-label={labels.composerMoveRowDown}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-muted/60 hover:bg-ink/10 hover:text-ink focus-visible:ring-2 focus-visible:ring-leaf disabled:pointer-events-none disabled:opacity-30"
                      disabled={rowIndex >= rows.length - 1}
                      onClick={() => moveRow(rowIndex, rowIndex + 1)}
                      type="button"
                    >
                      <svg aria-hidden className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>
                    <button
                      aria-label={`${labels.composerDeleteRowAria} ${displayNum}`}
                      className="shrink-0 rounded-md p-1.5 text-muted/50 hover:bg-sakura/10 hover:text-sakura focus-visible:ring-2 focus-visible:ring-sakura"
                      onClick={() =>
                        setRows((prev) =>
                          prev.length <= 1 ? prev : prev.filter((x) => x.id !== r.id)
                        )
                      }
                      type="button"
                    >
                    <svg aria-hidden className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M3 6h18M8 6V4h8v2M19 6v14H5V6" strokeLinecap="round" />
                      <path d="M10 11v6M14 11v6" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto]">
                  <div className="min-w-0">
                    <label className="sr-only" htmlFor={`${formId}-f-${r.id}`}>
                      {labels.composerTermPlaceholder}
                    </label>
                    <textarea
                      className={`${inputClass} min-h-[5rem] resize-y py-2`}
                      id={`${formId}-f-${r.id}`}
                      lang="ja"
                      maxLength={500}
                      onChange={(e) => {
                        const v = e.target.value;
                        setRows((prev) => {
                          const next = [...prev];
                          const x = next[rowIndex];
                          if (x) next[rowIndex] = { ...x, front: v };
                          return next;
                        });
                      }}
                      placeholder={labels.composerTermPlaceholder}
                      value={r.front}
                    />
                    <p className="mt-1.5 text-[10px] font-black uppercase tracking-wide text-muted">
                      {labels.composerTermLabel}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <label className="sr-only" htmlFor={`${formId}-b-${r.id}`}>
                      {labels.composerDefinitionPlaceholder}
                    </label>
                    <textarea
                      className={`${inputClass} min-h-[5rem] resize-y py-2`}
                      id={`${formId}-b-${r.id}`}
                      maxLength={2000}
                      onChange={(e) => {
                        const v = e.target.value;
                        setRows((prev) => {
                          const next = [...prev];
                          const x = next[rowIndex];
                          if (x) next[rowIndex] = { ...x, back: v };
                          return next;
                        });
                      }}
                      placeholder={labels.composerDefinitionPlaceholder}
                      value={r.back}
                    />
                    <p className="mt-1.5 text-[10px] font-black uppercase tracking-wide text-muted">
                      {labels.composerDefinitionLabel}
                    </p>
                  </div>

                  <div className="flex flex-col items-center gap-2 sm:w-24">
                    <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-ink/15 bg-surface transition-all duration-200 hover:border-leaf/40 cursor-pointer group">
                      {r.imageUrl.trim() ? (
                        <img
                          alt=""
                          className="h-full w-full object-cover"
                          src={r.imageUrl.trim()}
                        />
                      ) : r.imageAssetId ? (
                        <span className="px-1 text-center text-[10px] font-bold text-leaf">{labels.composerImageAttached}</span>
                      ) : (
                        <svg aria-hidden className="h-7 w-7 text-muted/40 group-hover:text-leaf" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <rect height="16" rx="2" width="18" x="3" y="4" strokeWidth="1.5" />
                          <circle cx="8.5" cy="9.5" r="1.5" />
                          <path d="m21 15-5-5L5 21" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
                        </svg>
                      )}
                      {uploadingRowId === r.id ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-paper/80 text-[10px] font-bold text-ink">
                          {labels.composerUploading}
                        </div>
                      ) : null}
                      {/* Overlay trigger for popover/modal */}
                      <button
                        type="button"
                        aria-label={labels.composerUploadImage}
                        className="absolute inset-0 z-10 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                        onClick={() => {
                          const el = document.getElementById(`${formId}-img-${r.id}`);
                          if (el) el.click();
                        }}
                        tabIndex={0}
                      />
                    </div>
                    <input
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="sr-only"
                      id={`${formId}-img-${r.id}`}
                      onChange={(e) => void handleRowFile(r.id, e)}
                      type="file"
                    />
                    <button
                      type="button"
                      className="text-[11px] text-muted underline hover:text-leaf focus-visible:text-leaf"
                      style={{padding: 0, minHeight: 0, minWidth: 0}}
                      onClick={() => {
                        const url = prompt('Dán URL ảnh hoặc tìm trên Google Images:', r.imageUrl || '');
                        if (url && url.trim()) {
                          setRows((prev) => {
                            const next = [...prev];
                            const x = next[rowIndex];
                            if (x) next[rowIndex] = { ...x, imageAssetId: null, imageUrl: url.trim() };
                            return next;
                          });
                        }
                      }}
                    >
                      Dán URL ảnh / Google
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
      </div>

      <div className="flex justify-center">
        <button
          className={`${btnNeutral} min-h-10 px-6 text-sm`}
          disabled={rows.length >= 200}
          onClick={() => setRows((p) => [...p, emptyRow()].slice(0, 200))}
          type="button"
        >
          + {labels.composerAddCard}
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-ink/8 pt-4">
        {actionBar()}
      </div>

      {importOpen ? (
        <div
          aria-modal
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-3 sm:items-center"
          role="dialog"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-2xl border border-ink/10 bg-surface p-4 shadow-xl">
            <h3 className="text-base font-bold text-ink">{labels.composerImportTitle}</h3>
            <p className="mt-2 text-xs leading-snug text-muted">{labels.composerImportHint}</p>
            <textarea
              className={`${inputClass} mt-3 min-h-[10rem] font-mono text-xs sm:text-sm`}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={labels.composerImportPlaceholder}
              spellCheck={false}
              value={importText}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <button className={btnSecondary} onClick={() => commitImport("replace")} type="button">
                {labels.composerImportReplace}
              </button>
              <button className={btnPrimary} onClick={() => commitImport("append")} type="button">
                {labels.composerImportAppend}
              </button>
              <button
                className={btnNeutral}
                onClick={() => {
                  setImportOpen(false);
                  setImportText("");
                }}
                type="button"
              >
                {labels.cancel}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {shortcutsOpen ? (
        <div
          aria-modal
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-3 sm:items-center"
          role="dialog"
        >
          <div className="w-full max-w-md rounded-2xl border border-ink/10 bg-surface p-5 shadow-xl">
            <h3 className="text-base font-bold text-ink">{labels.composerShortcutsTitle}</h3>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted">{labels.composerShortcutsBody}</p>
            <button className={`${btnPrimary} mt-4 w-full`} onClick={() => setShortcutsOpen(false)} type="button">
              {labels.composerCloseShortcuts}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
