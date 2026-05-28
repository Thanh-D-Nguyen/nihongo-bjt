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
import { usePathname, useRouter } from "next/navigation";

import { learnerApiFetch } from "../../../../lib/learner-api";
import { parseBulkDeckLines } from "./bulk-deck-import-parse";

const allowedMime = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const maxImageBytes = 10 * 1024 * 1024;

function ImgWithFallback({ alt, className, src }: { alt: string; className: string; src: string }) {
  const [broken, setBroken] = useState(false);
  if (broken) {
    return (
      <div className={`${className} flex items-center justify-center bg-ink/5`}>
        <svg className="h-4 w-4 text-ink/25" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
        </svg>
      </div>
    );
  }
  return <img alt={alt} className={className} onError={() => setBroken(true)} src={src} />;
}

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
  composerImageUrlLabel: string;
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
  composerProgressTpl: string;
  composerReadingLabel: string;
  composerReadingPlaceholder: string;
  composerRowImageUrlPlaceholder: string;
  composerDuplicateHint: string;
  composerSearchPlaceholder: string;
  composerSave: string;
  composerShortcutsBody: string;
  composerShortcutsTitle: string;
  composerSwapSides: string;
  composerTermLabel: string;
  composerTermPlaceholder: string;
  composerToolbarAria: string;
  composerUploadImage: string;
  composerUploading: string;
  composerVisibilityLabel: string;
  imgSearchBtn: string;
  imgSearching: string;
  imgSearchEmpty: string;
  imgSearchRefresh: string;
  imgSearchQuotaTitle: string;
  imgSearchQuotaBody: string;
  imgSearchQuotaCta: string;
  imgSearchCredit: string;
  composerEmojiLabel: string;
  composerTemplateVocab: string;
  composerTemplateKanji: string;
  composerTemplateGrammar: string;
  composerTemplateSentence: string;
  composerShortcuts: string;
  suggestBtn: string;
  suggestTitle: string;
  suggestSubtitle: string;
  suggestLevel: string;
  suggestSource: string;
  suggestSourceLexeme: string;
  suggestSourceKanji: string;
  suggestSourceGrammar: string;
  suggestFetch: string;
  suggestFetching: string;
  suggestAddSelected: string;
  suggestEmpty: string;
  suggestSelectAll: string;
  suggestDeselectAll: string;
  suggestCount: string;
  suggestPremiumTitle: string;
  suggestPremiumBody: string;
  suggestPremiumCta: string;
  suggestClose: string;
  createDeckTitle: string;
  descLabel: string;
  descPlaceholder: string;
  editDeckTitle: string;
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
  cardId?: string;
  deckCardId?: string;
  front: string;
  id: string;
  imageAssetId: string | null;
  imageUrl: string;
  reading: string;
};

export type DeckComposerInitialData = {
  cards: Array<{
    backText: string;
    cardId: string;
    deckCardId: string;
    frontText: string;
    primaryImageAssetId?: string | null;
    reading: string | null;
  }>;
  deckId: string;
  descriptionVi?: string | null;
  titleJa?: string | null;
  titleVi: string;
  visibility: string;
};

function emptyRow(): DraftRow {
  return { back: "", front: "", id: crypto.randomUUID(), imageAssetId: null, imageUrl: "", reading: "" };
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
  initialData,
  labels,
  mode = "create",
  onCancel,
  onSuccess,
  userId
}: {
  initialData?: DeckComposerInitialData;
  labels: DeckComposerLabels;
  mode?: "create" | "edit";
  onCancel: () => void;
  onSuccess: (opts: { startReview: boolean }) => void | Promise<void>;
  userId: string;
}) {
  const formId = useId();
  const router = useRouter();
  const pathname = usePathname();
  const locale = pathname.split("/")[1] || "vi";
  const isEdit = mode === "edit";
  const initialRows = useMemo<DraftRow[]>(() => {
    if (!initialData?.cards.length) return [emptyRow(), emptyRow(), emptyRow()];
    return initialData.cards.map((card) => ({
      back: card.backText,
      cardId: card.cardId,
      deckCardId: card.deckCardId,
      front: card.frontText,
      id: card.deckCardId,
      imageAssetId: card.primaryImageAssetId ?? null,
      imageUrl: "",
      reading: card.reading ?? ""
    }));
  }, [initialData]);
  const [titleVi, setTitleVi] = useState(initialData?.titleVi ?? "");
  const [titleJa, setTitleJa] = useState(initialData?.titleJa ?? "");
  const [descVi, setDescVi] = useState(initialData?.descriptionVi ?? "");
  const [visibility, setVisibility] = useState<"private" | "public">(
    initialData?.visibility === "public" ? "public" : "private"
  );
  const [rows, setRows] = useState<DraftRow[]>(() => initialRows);
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
  const [deckEmoji, setDeckEmoji] = useState("📚");
  const [previewRowId, setPreviewRowId] = useState<string | null>(null);

  // ── Suggest Cards state ──
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestLevel, setSuggestLevel] = useState("J5");
  const [suggestSources, setSuggestSources] = useState<("lexeme" | "kanji" | "grammar")[]>(["lexeme"]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<{ front: string; back: string; reading?: string; sourceType: string }[]>([]);
  const [selectedSuggest, setSelectedSuggest] = useState<Set<number>>(new Set());
  const [suggestPremiumLocked, setSuggestPremiumLocked] = useState(false);
  const [suggestFetched, setSuggestFetched] = useState(false);

  // ── Image Search state (per row) ──
  type ImgSuggestion = { id: string; thumbUrl: string; fullUrl: string; source: string };
  const [imgSearchResults, setImgSearchResults] = useState<Record<string, ImgSuggestion[]>>({});
  const [imgSearchLoading, setImgSearchLoading] = useState<Record<string, boolean>>({});
  const [imgSearchQuotaHit, setImgSearchQuotaHit] = useState(false);
  const [imgProxyingRowId, setImgProxyingRowId] = useState<string | null>(null);
  const imgSearchLastQuery = useRef<Record<string, string>>({});

  const searchImagesForRow = useCallback(async (rowId: string, query: string) => {
    if (!query.trim() || query.trim().length < 2) return;
    if (imgSearchLastQuery.current[rowId] === query.trim()) return;
    imgSearchLastQuery.current[rowId] = query.trim();
    setImgSearchLoading((p) => ({ ...p, [rowId]: true }));
    try {
      const res = await learnerApiFetch("/api/media/search-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim(), limit: 6, userId }),
      });
      if (res.status === 403) {
        const data = await res.json().catch(() => ({}));
        if (data?.code === "QUOTA_EXCEEDED") {
          setImgSearchQuotaHit(true);
          return;
        }
      }
      if (!res.ok) return;
      const data = await res.json();
      setImgSearchResults((p) => ({ ...p, [rowId]: data.images ?? [] }));
    } catch { /* silent */ } finally {
      setImgSearchLoading((p) => ({ ...p, [rowId]: false }));
    }
  }, [userId]);

  // ── Proxy image to S3 immediately on selection ──
  const proxyImageForRow = useCallback(async (rowId: string, rowIndex: number, fullUrl: string, altText: string, source: string) => {
    // Immediately show the image URL for instant visual feedback
    setRows((prev) => {
      const next = [...prev];
      const x = next[rowIndex];
      if (x) next[rowIndex] = { ...x, imageAssetId: null, imageUrl: fullUrl };
      return next;
    });
    // Proxy to S3 in background
    setImgProxyingRowId(rowId);
    try {
      const res = await learnerApiFetch("/api/media/proxy-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: fullUrl, userId, altText, source }),
      });
      if (res.ok) {
        const data = (await res.json()) as { assetId: string };
        setRows((prev) => {
          const next = [...prev];
          const idx = next.findIndex((r) => r.id === rowId);
          if (idx >= 0) {
            next[idx] = { ...next[idx]!, imageAssetId: data.assetId, imageUrl: "" };
          }
          return next;
        });
      }
      // If proxy fails, keep fullUrl — backend will retry on deck save
    } catch { /* silent — fallback to URL mode */ } finally {
      setImgProxyingRowId(null);
    }
  }, [userId]);

  // ── Auto-generate reading from Japanese text ──
  const readingLastQuery = useRef<Record<string, string>>({});
  const readingAutoFilled = useRef<Set<string>>(new Set());

  const fetchReadingForRow = useCallback(async (rowId: string, text: string) => {
    const trimmed = text.trim();
    if (trimmed.length < 1 || trimmed.length > 500) return;
    // Only trigger if text contains Japanese (hiragana, katakana, or kanji)
    if (!/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(trimmed)) return;
    if (readingLastQuery.current[rowId] === trimmed) return;
    readingLastQuery.current[rowId] = trimmed;
    try {
      const res = await learnerApiFetch("/api/reading-assist/readings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed, userId }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { reading: string };
      if (!data.reading) return;
      setRows((prev) => {
        const idx = prev.findIndex((r) => r.id === rowId);
        if (idx < 0) return prev;
        const row = prev[idx];
        // Only auto-fill if reading is still empty or was previously auto-filled
        if (row.reading.trim() && !readingAutoFilled.current.has(rowId)) return prev;
        readingAutoFilled.current.add(rowId);
        const next = [...prev];
        next[idx] = { ...row, reading: data.reading };
        return next;
      });
    } catch { /* silent */ }
  }, [userId]);

  // ── Progress: count filled cards ──
  const filledCount = useMemo(() => rows.filter((r) => r.front.trim() && r.back.trim()).length, [rows]);

  // ── Auto-add row when last row has content ──
  useEffect(() => {
    if (rows.length >= 200) return;
    const last = rows[rows.length - 1];
    if (last && (last.front.trim() || last.back.trim())) {
      setRows((prev) => (prev.length < 200 ? [...prev, emptyRow()] : prev));
    }
  }, [rows]);

  // ── Auto-save draft to localStorage ──
  const draftKey = `nihongo_deck_draft_${userId}`;
  useEffect(() => {
    if (isEdit) return;
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        const d = JSON.parse(saved) as { titleVi?: string; titleJa?: string; descVi?: string; visibility?: string; emoji?: string; rows?: DraftRow[] };
        if (d.titleVi) setTitleVi(d.titleVi);
        if (d.titleJa) setTitleJa(d.titleJa);
        if (d.descVi) setDescVi(d.descVi);
        if (d.visibility === "public") setVisibility("public");
        if (d.emoji) setDeckEmoji(d.emoji);
        if (d.rows?.length) setRows(d.rows.map((r) => ({ ...emptyRow(), ...r, id: r.id || crypto.randomUUID() })));
      }
    } catch { /* ignore corrupt draft */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit]);

  useEffect(() => {
    if (isEdit) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(draftKey, JSON.stringify({ descVi, emoji: deckEmoji, rows, titleJa, titleVi, visibility }));
      } catch { /* quota */ }
    }, 800);
    return () => clearTimeout(timer);
  }, [titleVi, titleJa, descVi, visibility, rows, deckEmoji, draftKey, isEdit]);

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
    setDeckEmoji("📚");
    try { localStorage.removeItem(draftKey); } catch { /* ok */ }
  }, [draftKey]);

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
        imageUrl: r.imageUrl ?? "",
        reading: ""
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
          cardId: r.cardId,
          deckCardId: r.deckCardId,
          frontText: r.front.trim(),
          imageUrl: r.imageUrl.trim() || undefined,
          primaryImageAssetId: r.imageAssetId || undefined,
          reading: r.reading.trim() || undefined
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
        const http = await learnerApiFetch(
          isEdit && initialData
            ? `/api/flashcards/decks/${encodeURIComponent(initialData.deckId)}`
            : "/api/flashcards/decks",
          {
          body: JSON.stringify({
            cards: filtered,
            descriptionVi: descVi.trim() || undefined,
            titleJa: titleJa.trim() || undefined,
            titleVi: titleVi.trim(),
            userId,
            visibility
          }),
          headers: { "Content-Type": "application/json" },
          method: isEdit ? "PATCH" : "POST"
          }
        );
        if (!http.ok) throw new Error(isEdit ? "update_failed" : "create_failed");
        if (!isEdit) resetForm();
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
      initialData,
      isEdit,
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
        {submitting ? labels.composerCreating : isEdit ? labels.composerSave : labels.composerCreate}
      </button>
      {!isEdit ? (
        <button className={btnPrimary} disabled={submitting} onClick={() => void submit(true)} type="button">
          {submitting ? labels.composerCreating : labels.composerCreateAndPractice}
        </button>
      ) : null}
    </div>
  );

  return (

    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-widest text-leaf">{labels.composerHeadline}</p>
          <h2 className="mt-1 text-lg font-black text-ink sm:text-xl" id={`${formId}-title`}>
            {isEdit ? labels.editDeckTitle : labels.createDeckTitle}
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

        {/* ── Emoji picker ── */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-muted">{labels.composerEmojiLabel}</span>
          <div className="flex flex-wrap gap-1">
            {["📚", "🎯", "✨", "🌸", "🔥", "💎", "🎌", "📝", "🗾", "💼", "🏆", "🧠"].map((e) => (
              <button
                key={e}
                type="button"
                aria-pressed={deckEmoji === e}
                className={`flex h-9 w-9 items-center justify-center rounded-lg text-lg transition ${
                  deckEmoji === e ? "bg-accent-soft ring-2 ring-accent scale-110" : "hover:bg-paper"
                }`}
                onClick={() => setDeckEmoji(e)}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        {/* ── Templates ── */}
        {!isEdit ? <div className="flex flex-wrap items-center gap-2">
          {[
            { label: labels.composerTemplateVocab, front: "日本語の単語…", back: "Nghĩa tiếng Việt…", reading: "ひらがな…" },
            { label: labels.composerTemplateKanji, front: "漢字", back: "Nghĩa + cách đọc…", reading: "おんよみ / くんよみ" },
            { label: labels.composerTemplateGrammar, front: "〜文法パターン", back: "Giải thích ngữ pháp…", reading: "" },
            { label: labels.composerTemplateSentence, front: "日本語の文…", back: "Bản dịch tiếng Việt…", reading: "" }
          ].map((tpl) => (
            <button
              key={tpl.label}
              type="button"
              className="rounded-lg border border-ink/10 bg-paper/80 px-3 py-1.5 text-[11px] font-bold text-muted transition hover:border-accent/30 hover:bg-accent-soft/30 hover:text-accent"
              onClick={() => {
                setRows((prev) => {
                  const hasContent = prev.some((r) => r.front.trim() || r.back.trim());
                  if (hasContent) return prev;
                  return [
                    { ...emptyRow(), front: tpl.front, back: tpl.back, reading: tpl.reading },
                    { ...emptyRow(), front: tpl.front, back: tpl.back, reading: tpl.reading },
                    emptyRow()
                  ];
                });
              }}
            >
              {tpl.label}
            </button>
          ))}
        </div> : null}

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
        <button
          className={`${btnSecondary} min-h-9 px-3 text-xs font-bold bg-gradient-to-r from-accent/10 to-leaf/10 border-accent/30 hover:from-accent/20 hover:to-leaf/20`}
          onClick={() => setSuggestOpen((v) => !v)}
          type="button"
        >
          {labels.suggestBtn}
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

      {/* ── Suggest Cards Modal ── */}
      {suggestOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink/40 backdrop-blur-sm animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-label={labels.suggestTitle}
          onKeyDown={(e) => { if (e.key === "Escape") setSuggestOpen(false); }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0" onClick={() => setSuggestOpen(false)} aria-hidden="true" />

          {/* Modal panel — bottom sheet on mobile, centered on desktop */}
          <div className="relative w-full max-w-lg animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300 rounded-t-3xl sm:rounded-2xl bg-surface shadow-2xl border border-ink/10 max-h-[85vh] sm:max-h-[80vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-ink/8">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-accent/15 to-leaf/15">
                  <svg className="h-5 w-5 text-accent" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-ink">{labels.suggestTitle}</h3>
                  <p className="text-xs text-muted">{labels.suggestSubtitle}</p>
                </div>
              </div>
              <button
                className="flex h-9 w-9 items-center justify-center rounded-xl text-muted hover:bg-ink/8 hover:text-ink transition-all active:scale-95 focus-visible:ring-2 focus-visible:ring-accent/35"
                onClick={() => setSuggestOpen(false)}
                type="button"
                aria-label={labels.suggestClose}
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {suggestPremiumLocked ? (
                <div className="text-center space-y-3 py-8">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-100 to-amber-50">
                    <svg className="h-7 w-7 text-amber-500" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                    </svg>
                  </div>
                  <p className="text-sm font-bold text-ink">{labels.suggestPremiumTitle}</p>
                  <p className="text-xs text-muted max-w-xs mx-auto">{labels.suggestPremiumBody}</p>
                  <button
                    className={`${btnPrimary} min-h-11 px-8 text-sm font-bold`}
                    onClick={() => router.push(`/${locale}/pricing`)}
                    type="button"
                  >
                    {labels.suggestPremiumCta}
                  </button>
                </div>
              ) : (
                <>
                  {/* Level selection */}
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-muted uppercase tracking-wide">{labels.suggestLevel}</p>
                    <div className="flex flex-wrap gap-2">
                      {["J5", "J4", "J3", "J2", "J1", "J1+"].map((lv) => (
                        <button
                          className={`rounded-xl px-4 py-2 text-xs font-bold transition-all active:scale-95 ${
                            suggestLevel === lv
                              ? "bg-accent text-white shadow-md shadow-accent/25"
                              : "bg-ink/6 text-muted hover:bg-ink/12 hover:shadow-sm"
                          }`}
                          key={lv}
                          onClick={() => setSuggestLevel(lv)}
                          type="button"
                        >
                          {lv}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Source selection */}
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-muted uppercase tracking-wide">{labels.suggestSource}</p>
                    <div className="flex flex-wrap gap-2">
                      {(["lexeme", "kanji", "grammar"] as const).map((src) => {
                        const label = src === "lexeme" ? labels.suggestSourceLexeme : src === "kanji" ? labels.suggestSourceKanji : labels.suggestSourceGrammar;
                        const active = suggestSources.includes(src);
                        return (
                          <button
                            className={`rounded-xl px-4 py-2 text-xs font-bold transition-all active:scale-95 ${
                              active
                                ? "bg-leaf text-white shadow-md shadow-leaf/25"
                                : "bg-ink/6 text-muted hover:bg-ink/12 hover:shadow-sm"
                            }`}
                            key={src}
                            onClick={() =>
                              setSuggestSources((prev) =>
                                active ? prev.filter((s) => s !== src) : [...prev, src]
                              )
                            }
                            type="button"
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Fetch button */}
                  <button
                    className={`${btnPrimary} min-h-11 w-full text-sm font-bold relative overflow-hidden`}
                    disabled={suggestLoading || suggestSources.length === 0}
                    onClick={async () => {
                      setSuggestLoading(true);
                      setSuggestPremiumLocked(false);
                      setSuggestions([]);
                      setSelectedSuggest(new Set());
                      try {
                        const res = await learnerApiFetch("/api/flashcards/cards/suggest", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ level: suggestLevel, sourceTypes: suggestSources, count: 10, userId }),
                        });
                        if (res.status === 403) {
                          setSuggestPremiumLocked(true);
                          return;
                        }
                        if (!res.ok) throw new Error("suggest failed");
                        const data = await res.json();
                        setSuggestions(data.suggestions ?? []);
                        setSuggestFetched(true);
                        // Auto-fill deck title from suggestion if title is empty
                        if (!titleVi.trim() && data.suggestedTitleVi) {
                          setTitleVi(data.suggestedTitleVi);
                        }
                        if (!titleJa.trim() && data.suggestedTitleJa) {
                          setTitleJa(data.suggestedTitleJa);
                        }
                      } catch {
                        setError("Suggest failed");
                      } finally {
                        setSuggestLoading(false);
                      }
                    }}
                    type="button"
                  >
                    {suggestLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z" />
                        </svg>
                        {labels.suggestFetching}
                      </span>
                    ) : labels.suggestFetch}
                  </button>

                  {/* Results */}
                  {suggestFetched && suggestions.length === 0 ? (
                    <div className="text-center py-6">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-ink/5 mb-2">
                        <svg className="h-6 w-6 text-muted" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                        </svg>
                      </div>
                      <p className="text-xs text-muted">{labels.suggestEmpty}</p>
                    </div>
                  ) : null}

                  {suggestions.length > 0 ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-ink">
                          {labels.suggestCount.replace("{n}", String(suggestions.length))}
                        </span>
                        <button
                          className="text-xs font-medium text-accent hover:text-accent/80 transition-colors active:scale-95"
                          onClick={() => {
                            if (selectedSuggest.size === suggestions.length) {
                              setSelectedSuggest(new Set());
                            } else {
                              setSelectedSuggest(new Set(suggestions.map((_, i) => i)));
                            }
                          }}
                          type="button"
                        >
                          {selectedSuggest.size === suggestions.length ? labels.suggestDeselectAll : labels.suggestSelectAll}
                        </button>
                      </div>

                      <div className="max-h-56 overflow-y-auto space-y-1 rounded-xl border border-ink/8 bg-ink/[0.02] p-1.5">
                        {suggestions.map((s, i) => (
                          <label
                            className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 transition-all ${
                              selectedSuggest.has(i)
                                ? "bg-leaf/10 border border-leaf/20 shadow-sm"
                                : "border border-transparent hover:bg-ink/4"
                            }`}
                            key={i}
                          >
                            <input
                              checked={selectedSuggest.has(i)}
                              className="h-4 w-4 accent-leaf rounded"
                              onChange={() =>
                                setSelectedSuggest((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(i)) next.delete(i);
                                  else next.add(i);
                                  return next;
                                })
                              }
                              type="checkbox"
                            />
                            <span className="flex-1 min-w-0">
                              <span className="block text-sm font-bold text-ink truncate">{s.front}</span>
                              <span className="block text-xs text-muted truncate">
                                {s.reading ? `${s.reading} — ` : ""}{s.back}
                              </span>
                            </span>
                            <span className="shrink-0 rounded-lg bg-ink/6 px-2 py-0.5 text-[10px] font-medium text-muted">
                              {s.sourceType}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </div>

            {/* Footer — sticky add button */}
            {suggestions.length > 0 && !suggestPremiumLocked ? (
              <div className="border-t border-ink/8 px-5 py-3 bg-surface/80 backdrop-blur-sm">
                <button
                  className={`${btnPrimary} min-h-11 w-full text-sm font-bold relative overflow-hidden`}
                  disabled={selectedSuggest.size === 0}
                  onClick={() => {
                    const newRows: DraftRow[] = Array.from(selectedSuggest)
                      .sort()
                      .map((i) => ({
                        back: suggestions[i]!.back,
                        front: suggestions[i]!.front,
                        id: crypto.randomUUID(),
                        imageAssetId: null,
                        imageUrl: "",
                        reading: suggestions[i]!.reading ?? "",
                      }));
                    setRows((prev) => [...prev, ...newRows].slice(0, 200));
                    setSuggestions([]);
                    setSelectedSuggest(new Set());
                    setSuggestOpen(false);
                    setSuggestFetched(false);
                  }}
                  type="button"
                >
                  {labels.suggestAddSelected} ({selectedSuggest.size})
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* ── Progress bar ── */}
      <div className="flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink/8">
          <div
            className="h-full rounded-full bg-gradient-to-r from-leaf to-accent transition-all duration-500 ease-out"
            style={{ width: `${rows.length > 0 ? Math.min(100, (filledCount / rows.length) * 100) : 0}%` }}
          />
        </div>
        <span className="shrink-0 text-xs font-black tabular-nums text-muted">
          {labels.composerProgressTpl.replace("{filled}", String(filledCount)).replace("{total}", String(rows.length))}
        </span>
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
          const isDuplicate = r.front.trim().length > 0 && rows.some((o, oi) => oi !== rowIndex && o.front.trim().toLowerCase() === r.front.trim().toLowerCase());
          const [showImageUrl, setShowImageUrl] = [r.imageUrl !== undefined, null]; // inline url always visible via field
          return (
              <div
                className={`min-w-0 rounded-xl border bg-white p-3 sm:p-4 transition-all duration-200 ease-in-out shadow-sm ${
                  isDuplicate ? "border-amber-400/60 ring-1 ring-amber-300/30" :
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
                {isDuplicate ? (
                  <p className="mb-2 text-[11px] font-bold text-amber-600">⚠ {labels.composerDuplicateHint}</p>
                ) : null}
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
                  <div className="flex items-center gap-1">
                    {/* Inline preview tooltip on hover */}
                    <div className="group/preview relative">
                      <button
                        aria-label={`Preview ${displayNum}`}
                        className="shrink-0 rounded-md p-1.5 text-muted/50 hover:bg-accent-soft hover:text-accent focus-visible:ring-2 focus-visible:ring-accent"
                        onClick={() => setPreviewRowId(previewRowId === r.id ? null : r.id)}
                        type="button"
                      >
                        <svg aria-hidden className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" strokeLinecap="round" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      </button>
                      {/* Hover tooltip - positioned to the left on desktop */}
                      {(r.front.trim() || r.back.trim()) ? (
                        <div className="pointer-events-none absolute right-0 top-full z-30 mt-1.5 w-64 opacity-0 transition-all duration-200 group-hover/preview:pointer-events-auto group-hover/preview:opacity-100 group-focus-within/preview:pointer-events-auto group-focus-within/preview:opacity-100">
                          <div className="overflow-hidden rounded-xl border border-ink/10 bg-paper shadow-lg ring-1 ring-ink/[0.03]">
                            <div className="border-b border-accent/10 bg-accent-soft/20 px-3 py-2">
                              <p className="text-[10px] font-black uppercase tracking-wider text-accent">{labels.composerTermLabel}</p>
                              <p className="mt-0.5 text-sm font-bold text-ink line-clamp-2" lang="ja">{r.front || "—"}</p>
                              {r.reading ? <p className="mt-0.5 text-xs text-muted" lang="ja">{r.reading}</p> : null}
                            </div>
                            <div className="px-3 py-2">
                              <p className="text-[10px] font-black uppercase tracking-wider text-leaf">{labels.composerDefinitionLabel}</p>
                              <p className="mt-0.5 text-xs leading-relaxed text-ink line-clamp-3">{r.back || "—"}</p>
                            </div>
                          </div>
                        </div>
                      ) : null}
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
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {/* ── Front (JP) — accent bg ── */}
                  <div className="min-w-0 rounded-lg border border-accent/15 bg-accent-soft/20 p-2.5">
                    <label className="sr-only" htmlFor={`${formId}-f-${r.id}`}>
                      {labels.composerTermPlaceholder}
                    </label>
                    <textarea
                      className="min-h-[4.5rem] w-full resize-y rounded-lg border border-accent/20 bg-white/80 px-3 py-2 text-sm text-ink outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
                      id={`${formId}-f-${r.id}`}
                      lang="ja"
                      maxLength={500}
                      onBlur={() => {
                        if (r.front.trim().length >= 2 && !r.imageUrl.trim() && !r.imageAssetId) {
                          void searchImagesForRow(r.id, r.front);
                        }
                        if (r.front.trim().length >= 1) {
                          void fetchReadingForRow(r.id, r.front);
                        }
                      }}
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
                    <div className="mt-1.5 flex items-center justify-between">
                      <p className="text-[10px] font-black uppercase tracking-wide text-accent">
                        {labels.composerTermLabel}
                      </p>
                      <span className={`text-[10px] tabular-nums ${r.front.length > 450 ? "font-bold text-sakura" : "text-muted/60"}`}>
                        {r.front.length}/500
                      </span>
                    </div>
                    {/* Reading / furigana */}
                    <input
                      className="mt-2 min-h-9 w-full rounded-lg border border-accent/15 bg-white/60 px-3 text-xs text-ink outline-none transition placeholder:text-muted/40 focus:border-accent focus:ring-1 focus:ring-accent"
                      id={`${formId}-r-${r.id}`}
                      lang="ja"
                      maxLength={300}
                      onChange={(e) => {
                        const v = e.target.value;
                        readingAutoFilled.current.delete(r.id);
                        setRows((prev) => {
                          const next = [...prev];
                          const x = next[rowIndex];
                          if (x) next[rowIndex] = { ...x, reading: v };
                          return next;
                        });
                      }}
                      placeholder={labels.composerReadingPlaceholder}
                      type="text"
                      value={r.reading}
                    />
                    <div className="mt-1 flex items-center justify-between">
                      <p className="text-[10px] font-bold text-accent/70">{labels.composerReadingLabel}</p>
                      <span className={`text-[10px] tabular-nums ${r.reading.length > 270 ? "font-bold text-sakura" : "text-muted/50"}`}>
                        {r.reading.length}/300
                      </span>
                    </div>
                  </div>

                  {/* ── Back (VI/meaning) — normal bg ── */}
                  <div className="min-w-0 rounded-lg border border-ink/8 bg-surface/60 p-2.5">
                    <label className="sr-only" htmlFor={`${formId}-b-${r.id}`}>
                      {labels.composerDefinitionPlaceholder}
                    </label>
                    <textarea
                      className="min-h-[4.5rem] w-full resize-y rounded-lg border border-ink/12 bg-white/80 px-3 py-2 text-sm text-ink outline-none transition focus:border-leaf focus:ring-1 focus:ring-leaf"
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
                    <div className="mt-1.5 flex items-center justify-between">
                      <p className="text-[10px] font-black uppercase tracking-wide text-muted">
                        {labels.composerDefinitionLabel}
                      </p>
                      <span className={`text-[10px] tabular-nums ${r.back.length > 1800 ? "font-bold text-sakura" : "text-muted/60"}`}>
                        {r.back.length}/2000
                      </span>
                    </div>
                  </div>
                </div>

                {/* ── Image area: upload + inline URL ── */}
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-ink/15 bg-surface transition-all duration-200 hover:border-leaf/40 cursor-pointer group">
                    {r.imageUrl.trim() ? (
                      <ImgWithFallback alt="" className="h-full w-full object-cover" src={r.imageUrl.trim()} />
                    ) : r.imageAssetId ? (
                      <div className="flex h-full w-full items-center justify-center bg-leaf/10">
                        <svg className="h-4 w-4 text-leaf" fill="currentColor" viewBox="0 0 20 20">
                          <path clipRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" fillRule="evenodd" />
                        </svg>
                      </div>
                    ) : (
                      <svg aria-hidden className="h-5 w-5 text-muted/40 group-hover:text-leaf" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <rect height="16" rx="2" width="18" x="3" y="4" strokeWidth="1.5" />
                        <circle cx="8.5" cy="9.5" r="1.5" />
                        <path d="m21 15-5-5L5 21" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
                      </svg>
                    )}
                    {imgProxyingRowId === r.id ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-paper/80">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-leaf/30 border-t-leaf" />
                      </div>
                    ) : null}
                    {uploadingRowId === r.id ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-paper/80 text-[9px] font-bold text-ink">
                        {labels.composerUploading}
                      </div>
                    ) : null}
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
                  <input
                    className="min-h-9 min-w-0 flex-1 rounded-lg border border-ink/10 bg-paper/60 px-3 text-xs text-ink outline-none transition placeholder:text-muted/40 focus:border-leaf focus:ring-1 focus:ring-leaf"
                    maxLength={2000}
                    onChange={(e) => {
                      const v = e.target.value;
                      setRows((prev) => {
                        const next = [...prev];
                        const x = next[rowIndex];
                        if (x) next[rowIndex] = { ...x, imageAssetId: null, imageUrl: v };
                        return next;
                      });
                    }}
                    placeholder={labels.composerRowImageUrlPlaceholder}
                    type="url"
                    value={r.imageUrl}
                  />
                  <span className="text-[10px] font-bold text-muted/50">{labels.composerImageUrlLabel}</span>
                  <button
                    className="rounded-md bg-ink/6 px-2 py-1 text-[10px] font-bold text-muted hover:bg-ink/12 transition-colors"
                    onClick={() => void searchImagesForRow(r.id, r.front)}
                    disabled={r.front.trim().length < 2 || imgSearchLoading[r.id]}
                    type="button"
                  >
                    {imgSearchLoading[r.id] ? labels.imgSearching : labels.imgSearchBtn}
                  </button>
                </div>

                {/* ── Image search suggestions ── */}
                {imgSearchQuotaHit && !imgSearchResults[r.id]?.length ? (
                  <div className="mt-2 rounded-lg border border-amber-300/40 bg-amber-50/60 p-2.5 text-center">
                    <p className="text-xs font-bold text-amber-700">{labels.imgSearchQuotaTitle}</p>
                    <p className="mt-0.5 text-[10px] text-amber-600">{labels.imgSearchQuotaBody}</p>
                    <button
                      className={`${btnPrimary} mt-1.5 min-h-7 px-4 text-[10px] font-bold`}
                      onClick={() => router.push(`/${locale}/pricing`)}
                      type="button"
                    >
                      {labels.imgSearchQuotaCta}
                    </button>
                  </div>
                ) : null}

                {imgSearchResults[r.id]?.length ? (
                  <div className="mt-2 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted">{labels.imgSearchCredit.replace("{source}", "Unsplash / Pixabay / Google")}</span>
                      <button
                        className="text-[10px] text-accent hover:underline"
                        onClick={() => {
                          imgSearchLastQuery.current[r.id] = "";
                          void searchImagesForRow(r.id, r.front);
                        }}
                        type="button"
                      >
                        {labels.imgSearchRefresh}
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
                      {imgSearchResults[r.id]!.map((img) => (
                        <button
                          className={`group/img relative aspect-square overflow-hidden rounded-lg border transition-all duration-150 hover:ring-2 hover:ring-leaf/40 ${
                            r.imageUrl === img.fullUrl || (r.imageAssetId && imgProxyingRowId !== r.id) ? "border-leaf ring-2 ring-leaf/30" : "border-ink/10"
                          }`}
                          key={img.id}
                          disabled={imgProxyingRowId === r.id}
                          onClick={() => {
                            void proxyImageForRow(r.id, rowIndex, img.fullUrl, r.front.slice(0, 200), img.source);
                          }}
                          type="button"
                        >
                          <img
                            alt=""
                            className="h-full w-full object-cover transition-transform duration-200 group-hover/img:scale-105"
                            loading="lazy"
                            src={img.thumbUrl}
                          />
                          {r.imageUrl === img.fullUrl && imgProxyingRowId === r.id ? (
                            <div className="absolute inset-0 flex items-center justify-center bg-leaf/20">
                              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/60 border-t-white" />
                            </div>
                          ) : r.imageAssetId && imgProxyingRowId !== r.id ? (
                            <div className="absolute inset-0 flex items-center justify-center bg-leaf/20">
                              <svg className="h-4 w-4 text-white drop-shadow" fill="currentColor" viewBox="0 0 20 20">
                                <path clipRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" fillRule="evenodd" />
                              </svg>
                            </div>
                          ) : r.imageUrl === img.fullUrl ? (
                            <div className="absolute inset-0 flex items-center justify-center bg-leaf/20">
                              <svg className="h-4 w-4 text-white drop-shadow" fill="currentColor" viewBox="0 0 20 20">
                                <path clipRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" fillRule="evenodd" />
                              </svg>
                            </div>
                          ) : null}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : imgSearchLoading[r.id] ? (
                  <div className="mt-2 flex items-center gap-2 text-xs text-muted">
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-leaf/30 border-t-leaf" />
                    {labels.imgSearching}
                  </div>
                ) : null}
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

      {/* ── Live preview modal ── */}
      {previewRowId ? (() => {
        const pr = rows.find((r) => r.id === previewRowId);
        if (!pr) return null;
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
            onClick={() => setPreviewRowId(null)}
            role="presentation"
          >
            <div
              className="w-full max-w-sm animate-in fade-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
            >
              <div className="overflow-hidden rounded-3xl border border-ink/10 bg-paper shadow-xl">
                <div className="border-b border-accent/15 bg-accent-soft/30 p-5">
                  <span className="inline-flex rounded-full border border-accent/25 bg-accent-soft/50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-accent">
                    {labels.composerTermLabel}
                  </span>
                  <p className="mt-3 text-2xl font-black text-ink" lang="ja">
                    {pr.front || "—"}
                  </p>
                  {pr.reading ? (
                    <p className="mt-1 text-sm font-medium text-muted" lang="ja">{pr.reading}</p>
                  ) : null}
                </div>
                <div className="p-5">
                  <span className="inline-flex rounded-full border border-leaf/35 bg-leaf/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-leaf">
                    {labels.composerDefinitionLabel}
                  </span>
                  <p className="mt-3 text-base font-semibold leading-relaxed text-ink">
                    {pr.back || "—"}
                  </p>
                </div>
              </div>
              <button
                className={`${btnPrimary} mt-3 w-full`}
                onClick={() => setPreviewRowId(null)}
                type="button"
              >
                {labels.composerCloseShortcuts}
              </button>
            </div>
          </div>
        );
      })() : null}
    </div>
  );
}
