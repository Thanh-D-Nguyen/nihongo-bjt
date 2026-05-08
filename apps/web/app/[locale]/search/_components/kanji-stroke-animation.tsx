"use client";

import { useEffect, useId, useRef, useState } from "react";

import { cn } from "@nihongo-bjt/ui";

import styles from "./kanji-stroke-animation.module.css";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type StrokeLoadErrorKind = "not_found" | "invalid_svg" | "network" | "forbidden" | "upstream" | "generic";

/** Must match `applySequentialStrokeDraw` timing (used for chained lexeme playback). */
export const KANJI_STROKE_DRAW_MS = 580;
export const KANJI_STROKE_GAP_MS = 95;

export function kanjiStrokeSequenceDurationMs(strokeCount: number): number {
  if (strokeCount <= 0) return 320;
  return (strokeCount - 1) * (KANJI_STROKE_DRAW_MS + KANJI_STROKE_GAP_MS) + KANJI_STROKE_DRAW_MS + 140;
}

export type KanjiStrokeVisualSize = "detail" | "lexemeTile";

export type KanjiStrokeChainSlot = "solo" | "active" | "complete" | "pending";

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return reduced;
}

function nullIfEmpty(s: string | null | undefined): string | null {
  if (s == null) return null;
  const t = s.trim();
  return t.length ? t : null;
}

/** Resolve relative SVG paths against the API origin (legacy direct fetch when no `kanjiId`). */
export function resolveStrokeSvgFetchUrl(raw: string): string {
  const t = raw.trim();
  if (!t || t.startsWith("<")) return "";
  if (/^https?:\/\//i.test(t)) return t;
  if (t.startsWith("//")) return `https:${t}`;
  try {
    const base = new URL(API_BASE);
    if (t.startsWith("/")) return `${base.origin}${t}`;
    return new URL(t, `${base.origin}/`).toString();
  } catch {
    return t;
  }
}

const DISALLOWED_TAGS = new Set([
  "script",
  "foreignobject",
  "iframe",
  "object",
  "embed",
  "audio",
  "video",
  "style",
  "image"
]);

/** KanjiVG uses `kvg:*` attributes; without `xmlns:kvg` the XML SVG parser rejects the document. */
export const KANJIVG_XMLNS = "http://kanjivg.tagaini.net";

export function ensureKanjivgXmlnsForDomParser(svgText: string): string {
  const t = svgText.trim();
  if (!/\bkvg:[a-z]/i.test(t)) return svgText;
  if (/\sxmlns:kvg\s*=/i.test(t)) return svgText;
  return t.replace(/<svg\b/i, `<svg xmlns:kvg="${KANJIVG_XMLNS}" `);
}

function sanitizeSvgRoot(svg: SVGSVGElement): void {
  const all = [svg, ...svg.querySelectorAll<SVGElement>("*")];
  for (const el of all) {
    const tag = el.tagName.toLowerCase();
    if (DISALLOWED_TAGS.has(tag)) {
      el.remove();
    }
  }
  const rest = [svg, ...svg.querySelectorAll<SVGElement>("*")];
  for (const el of rest) {
    for (const attr of [...el.attributes]) {
      const ln = attr.name.toLowerCase();
      if (ln.startsWith("on")) {
        el.removeAttribute(attr.name);
        continue;
      }
      if ((ln === "href" || ln === "xlink:href") && /^\s*javascript:/i.test(attr.value)) {
        el.removeAttribute(attr.name);
      }
      if (ln === "style" && /\burl\s*\(/i.test(attr.value)) {
        el.removeAttribute(attr.name);
      }
    }
  }
}

function parseSvgDocument(svgText: string, visualSize: KanjiStrokeVisualSize = "detail"): SVGSVGElement | null {
  const prepared = ensureKanjivgXmlnsForDomParser(svgText);
  const doc = new DOMParser().parseFromString(prepared, "image/svg+xml");
  if (doc.querySelector("parsererror")) return null;
  let root: Element | null = doc.documentElement;
  if (root.tagName.toLowerCase() !== "svg") {
    root = doc.querySelector("svg");
  }
  if (!root || root.tagName.toLowerCase() !== "svg") return null;
  const svg = root as SVGSVGElement;
  sanitizeSvgRoot(svg);
  svg.setAttribute("role", "img");
  if (!svg.getAttribute("aria-hidden")) svg.setAttribute("aria-hidden", "true");
  const sizeClasses =
    visualSize === "lexemeTile"
      ? (["max-h-52", "w-full", "max-w-[200px]", "shrink-0", "text-ink"] as const)
      : (["max-h-80", "w-full", "max-w-[340px]", "sm:max-h-96", "sm:max-w-[380px]", "text-ink"] as const);
  svg.classList.add(...sizeClasses);
  return svg;
}

function isInsideClipPath(el: Element): boolean {
  return Boolean(el.closest("clipPath"));
}

/** Attribute-only check (KanjiVG often inherits stroke from a parent `<g>`). */
function isStrokeDrawableFromAttributes(el: SVGGeometryElement): boolean {
  if (isInsideClipPath(el)) return false;
  const tag = el.tagName.toLowerCase();
  if (!["path", "line", "polyline", "polygon"].includes(tag)) return false;
  const stroke = (el.getAttribute("stroke") ?? "").trim().toLowerCase();
  const sw = (el.getAttribute("stroke-width") ?? "").trim();
  if (stroke && stroke !== "none") return true;
  if (sw && sw !== "0") return true;
  const fill = (el.getAttribute("fill") ?? "").trim().toLowerCase();
  if (fill === "none" && (stroke === "" || stroke === "none")) {
    return Boolean(sw);
  }
  return false;
}

/**
 * Stroke-order paths to animate. Prefer computed style so inherited `stroke` from
 * KanjiVG `<g style="stroke:...">` is detected (attribute-only check misses those).
 */
function isStrokeDrawable(el: SVGGeometryElement): boolean {
  if (isInsideClipPath(el)) return false;
  const tag = el.tagName.toLowerCase();
  if (!["path", "line", "polyline", "polygon"].includes(tag)) return false;

  if (typeof window !== "undefined") {
    try {
      const cs = window.getComputedStyle(el);
      const stroke = cs.stroke;
      if (stroke && stroke !== "none") {
        const w = parseFloat(cs.strokeWidth);
        if (Number.isFinite(w) && w > 0) return true;
      }
    } catch {
      /* ignore */
    }
  }

  return isStrokeDrawableFromAttributes(el);
}

function collectStrokeCandidates(svg: SVGSVGElement): SVGGeometryElement[] {
  const nodes = svg.querySelectorAll<SVGGeometryElement>("path, line, polyline, polygon");
  const out: SVGGeometryElement[] = [];
  for (const el of nodes) {
    if (!isStrokeDrawable(el)) continue;
    if (el instanceof SVGPathElement) {
      try {
        if (el.getTotalLength() < 2) continue;
      } catch {
        continue;
      }
    }
    out.push(el);
  }
  return out;
}

function sortStrokesDomOrder(strokes: SVGGeometryElement[]): SVGGeometryElement[] {
  return [...strokes].sort((a, b) => {
    const pos = a.compareDocumentPosition(b);
    if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
    if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
    return 0;
  });
}

/** KanjiVG path ids end with `-s{strokeIndex}` (e.g. `kvg:04e9c-s3`). */
export function strokeNumberFromKanjiVgPathId(id: string | null): number | null {
  if (!id) return null;
  const m = id.match(/[._-]s(\d+)$/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function findKanjiVgStrokeNumberTexts(svg: SVGSVGElement): SVGTextElement[] {
  const g = svg.querySelector<SVGGElement>('g[id*="StrokeNumbers"]');
  if (!g) return [];
  return [...g.querySelectorAll<SVGTextElement>("text")].filter((t) => /^\s*\d+\s*$/.test(t.textContent ?? ""));
}

/**
 * One label per animated stroke, aligned by KanjiVG path id (`-sN` → text "N").
 * Falls back to DOM order when counts match and ids are missing.
 */
function alignStrokeNumberLabels(
  strokes: SVGGeometryElement[],
  svg: SVGSVGElement
): Array<SVGTextElement | null> {
  const texts = findKanjiVgStrokeNumberTexts(svg);
  if (texts.length === 0) return strokes.map(() => null);

  const byNum = new Map<number, SVGTextElement>();
  for (const t of texts) {
    const n = parseInt(t.textContent?.trim() ?? "", 10);
    if (Number.isFinite(n) && n > 0 && !byNum.has(n)) byNum.set(n, t);
  }

  const mapped = strokes.map((p) => {
    const n = strokeNumberFromKanjiVgPathId(p.getAttribute("id"));
    return n != null ? (byNum.get(n) ?? null) : null;
  });

  if (mapped.every((x) => x == null) && texts.length === strokes.length) {
    const sorted = [...texts].sort(
      (a, b) => parseInt(a.textContent?.trim() ?? "0", 10) - parseInt(b.textContent?.trim() ?? "0", 10)
    );
    return sorted.map((t) => t);
  }

  return mapped;
}

function clearStrokeAnimationStyles(strokes: SVGGeometryElement[]) {
  for (const p of strokes) {
    p.style.strokeDasharray = "";
    p.style.strokeDashoffset = "";
    p.style.opacity = "";
    p.style.strokeLinecap = "";
    p.style.strokeLinejoin = "";
  }
}

function applySequentialStrokeDraw(
  svg: SVGSVGElement,
  strokes: SVGGeometryElement[],
  reducedMotion: boolean,
  onSequenceComplete?: () => void
): (() => void) | void {
  if (strokes.length === 0) {
    queueMicrotask(() => onSequenceComplete?.());
    return;
  }

  const strokeLabels = alignStrokeNumberLabels(strokes, svg);

  if (reducedMotion) {
    for (const p of strokes) {
      p.style.strokeDasharray = "";
      p.style.strokeDashoffset = "0";
      p.style.opacity = "1";
    }
    for (const t of findKanjiVgStrokeNumberTexts(svg)) {
      t.style.opacity = "1";
    }
    queueMicrotask(() => onSequenceComplete?.());
    return;
  }

  for (const t of findKanjiVgStrokeNumberTexts(svg)) {
    t.style.opacity = "0";
  }

  const cleanups: Array<() => void> = [];

  for (const p of strokes) {
    let len: number;
    try {
      if (p instanceof SVGPathElement) len = p.getTotalLength();
      else {
        const bb = p.getBBox?.();
        len = bb ? (bb.width + bb.height) * 2 : 80;
      }
    } catch {
      len = 80;
    }
    if (!Number.isFinite(len) || len < 2) len = 80;
    p.style.strokeLinecap = "round";
    p.style.strokeLinejoin = "round";
    p.style.strokeDasharray = `${len}`;
    p.style.strokeDashoffset = `${len}`;
    p.style.opacity = "0.14";
  }

  const baseDelayMs = KANJI_STROKE_GAP_MS;
  const strokeMs = KANJI_STROKE_DRAW_MS;

  strokes.forEach((p, i) => {
    let len: number;
    try {
      if (p instanceof SVGPathElement) len = p.getTotalLength();
      else len = 120;
    } catch {
      len = 120;
    }
    if (!Number.isFinite(len) || len < 2) len = 120;
    const stepDelay = i * (strokeMs + baseDelayMs);
    const fadeIn = p.animate([{ opacity: 0.14 }, { opacity: 1 }], {
      delay: stepDelay,
      duration: Math.min(220, strokeMs * 0.35),
      easing: "cubic-bezier(0.33, 1, 0.68, 1)",
      fill: "forwards"
    });
    const draw = p.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], {
      delay: stepDelay,
      duration: strokeMs,
      easing: "cubic-bezier(0.25, 0.1, 0.25, 1)",
      fill: "forwards"
    });
    cleanups.push(() => {
      fadeIn.cancel();
      draw.cancel();
    });

    const label = strokeLabels[i];
    if (label) {
      const numIn = label.animate([{ opacity: 0 }, { opacity: 1 }], {
        delay: stepDelay,
        duration: Math.min(200, strokeMs * 0.32),
        easing: "cubic-bezier(0.33, 1, 0.68, 1)",
        fill: "forwards"
      });
      cleanups.push(() => numIn.cancel());
    }
  });

  if (onSequenceComplete) {
    const totalMs = (strokes.length - 1) * (strokeMs + baseDelayMs) + strokeMs + 80;
    const tid = window.setTimeout(() => {
      onSequenceComplete();
    }, totalMs);
    cleanups.push(() => window.clearTimeout(tid));
  }

  return () => {
    for (const c of cleanups) c();
    clearStrokeAnimationStyles(strokes);
    for (const t of findKanjiVgStrokeNumberTexts(svg)) {
      t.style.opacity = "";
    }
  };
}

function strokeErrorMessage(kind: StrokeLoadErrorKind, labels: KanjiStrokeAnimationLabels): string {
  switch (kind) {
    case "not_found":
      return labels.errorNotFound;
    case "invalid_svg":
      return labels.errorInvalidSvg;
    case "network":
      return labels.errorNetwork;
    case "forbidden":
      return labels.errorForbidden;
    case "upstream":
      return labels.errorUpstream;
    default:
      return labels.errorGeneric;
  }
}

function classifyHttpError(status: number): StrokeLoadErrorKind {
  if (status === 404) return "not_found";
  if (status === 403) return "forbidden";
  if (status === 401) return "forbidden";
  if (status >= 500) return "upstream";
  return "generic";
}

export type KanjiStrokeAnimationLabels = {
  attributionTpl: string;
  errorForbidden: string;
  errorGeneric: string;
  errorInvalidSvg: string;
  errorNetwork: string;
  errorNotFound: string;
  errorUpstream: string;
  loading: string;
  replay: string;
  sectionTitle: string;
};

export function IconReplayStroke({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      className={className}
      fill="none"
      height="18"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.75"
      viewBox="0 0 24 24"
      width="18"
    >
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8V3h-5" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16v5h5" />
    </svg>
  );
}

export function KanjiStrokeAnimation({
  chainSlot = "solo",
  compactChrome = false,
  kanjiId,
  labels,
  onChainAdvance,
  orchestratorReplay = 0,
  strokeSvgHash,
  strokeSvgPath,
  strokeSvgSource,
  visualSize = "detail"
}: {
  chainSlot?: KanjiStrokeChainSlot;
  compactChrome?: boolean;
  kanjiId?: string | null;
  labels: KanjiStrokeAnimationLabels;
  onChainAdvance?: () => void;
  orchestratorReplay?: number;
  strokeSvgPath: string | null | undefined;
  strokeSvgHash?: string | null;
  strokeSvgSource?: string | null | undefined;
  visualSize?: KanjiStrokeVisualSize;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const fetchedSvgMarkupRef = useRef<string | null>(null);
  const onChainAdvanceRef = useRef(onChainAdvance);
  onChainAdvanceRef.current = onChainAdvance;

  const [loadErrorKind, setLoadErrorKind] = useState<StrokeLoadErrorKind | null>(null);
  const [loading, setLoading] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const [replayToken, setReplayToken] = useState(0);
  const headingId = useId();

  const raw = nullIfEmpty(typeof strokeSvgPath === "string" ? strokeSvgPath : null);
  const inlineSvg = raw?.startsWith("<") && /<svg[\s>/]/i.test(raw) ? raw : null;
  const kid = nullIfEmpty(typeof kanjiId === "string" ? kanjiId : null);
  const useProxy = Boolean(kid) && !inlineSvg;
  const proxyUrl =
    useProxy && kid
      ? `${API_BASE}/api/kanji/${encodeURIComponent(kid)}/stroke${
          strokeSvgHash ? `?h=${encodeURIComponent(strokeSvgHash)}` : ""
        }`
      : null;
  const fetchUrl = inlineSvg ? null : raw ? resolveStrokeSvgFetchUrl(raw) : null;
  const directBust =
    !useProxy && strokeSvgHash && fetchUrl
      ? `${fetchUrl}${fetchUrl.includes("?") ? "&" : "?"}h=${encodeURIComponent(strokeSvgHash)}`
      : !useProxy
        ? fetchUrl
        : null;

  const requestUrl = proxyUrl ?? directBust;

  useEffect(() => {
    fetchedSvgMarkupRef.current = null;
  }, [raw, inlineSvg, requestUrl]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !raw) return;

    let cancelled = false;
    let animCleanup: (() => void) | undefined;

    const clearHost = () => {
      animCleanup?.();
      animCleanup = undefined;
      host.innerHTML = "";
    };

    const mountFromMarkup = (svgText: string) => {
      clearHost();
      setLoadErrorKind(null);
      const parsed = parseSvgDocument(svgText, visualSize);
      if (!parsed) {
        setLoadErrorKind("invalid_svg");
        return;
      }
      const clone = parsed.cloneNode(true) as SVGSVGElement;
      sanitizeSvgRoot(clone);
      host.appendChild(clone);
      const strokes = sortStrokesDomOrder(collectStrokeCandidates(clone));
      const slot = chainSlot;
      const staticPlayback = reducedMotion || slot === "complete" || slot === "pending";
      const onSeq =
        !staticPlayback && typeof onChainAdvance === "function"
          ? () => {
              onChainAdvanceRef.current?.();
            }
          : undefined;
      const c = applySequentialStrokeDraw(clone, strokes, staticPlayback, onSeq);
      if (typeof c === "function") animCleanup = c;
    };

    if (inlineSvg) {
      fetchedSvgMarkupRef.current = inlineSvg;
      mountFromMarkup(inlineSvg);
      return () => {
        cancelled = true;
        clearHost();
      };
    }

    if (!requestUrl) {
      setLoadErrorKind("generic");
      return () => {
        cancelled = true;
        clearHost();
      };
    }

    if (fetchedSvgMarkupRef.current) {
      mountFromMarkup(fetchedSvgMarkupRef.current);
      return () => {
        cancelled = true;
        clearHost();
      };
    }

    setLoading(true);
    void fetch(requestUrl, { credentials: "omit", mode: "cors" })
      .then((res) => {
        if (cancelled) return;
        if (!res.ok) {
          setLoadErrorKind(classifyHttpError(res.status));
          setLoading(false);
          return;
        }
        return res.text();
      })
      .then((text) => {
        if (cancelled) return;
        if (typeof text !== "string") {
          setLoadErrorKind("generic");
          setLoading(false);
          return;
        }
        fetchedSvgMarkupRef.current = text;
        mountFromMarkup(text);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          if (err instanceof TypeError) {
            setLoadErrorKind("network");
          } else {
            setLoadErrorKind("generic");
          }
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      clearHost();
    };
  }, [
    chainSlot,
    inlineSvg,
    orchestratorReplay,
    raw,
    reducedMotion,
    replayToken,
    requestUrl,
    visualSize
  ]);

  if (!raw) return null;

  const attribution =
    strokeSvgSource && strokeSvgSource.trim().length > 0
      ? labels.attributionTpl.replace(/\{source\}/g, strokeSvgSource.trim())
      : null;

  const loadError = loadErrorKind !== null;

  const diagramBox = (
    <div
      className={cn(
        "relative flex items-center justify-center rounded-xl border border-ink/10 bg-paper/70 px-2 py-3",
        compactChrome ? "min-h-[5.5rem]" : "mt-2 min-h-[7rem]",
        loadError && "border-sakura/30 bg-sakura/5"
      )}
    >
      {loading ? (
        <p
          className="absolute inset-0 z-[1] flex items-center justify-center bg-paper/85 px-2 text-center text-xs text-muted"
          role="status"
        >
          {labels.loading}
        </p>
      ) : null}
      {loadError && loadErrorKind ? (
        <p
          className="absolute inset-0 z-[2] flex items-center justify-center bg-paper/90 px-2 text-center text-xs text-sakura"
          role="alert"
        >
          {strokeErrorMessage(loadErrorKind, labels)}
        </p>
      ) : null}
      <div
        className={cn(
          styles.host,
          chainSlot === "pending" && styles.hostPending,
          "flex w-full flex-col items-center gap-2",
          (loading || loadError) && "pointer-events-none opacity-0"
        )}
        ref={hostRef}
      />
    </div>
  );

  if (compactChrome) {
    return (
      <div className="flex w-full min-w-0 flex-col items-center">
        {diagramBox}
        {attribution ? (
          <p className="mt-1 max-w-full truncate text-[9px] leading-relaxed text-muted">{attribution}</p>
        ) : null}
      </div>
    );
  }

  return (
    <section aria-labelledby={headingId} className="mb-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-bold uppercase tracking-wide text-muted" id={headingId}>
          {labels.sectionTitle}
        </h3>
        {!reducedMotion && !loadError && !loading && chainSlot === "solo" ? (
          <button
            aria-label={labels.replay}
            className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-ink/12 bg-paper text-ink/80 hover:bg-ink/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
            onClick={() => setReplayToken((n) => n + 1)}
            title={labels.replay}
            type="button"
          >
            <IconReplayStroke />
          </button>
        ) : null}
      </div>
      {diagramBox}
      {attribution ? <p className="mt-1.5 text-[10px] leading-relaxed text-muted">{attribution}</p> : null}
    </section>
  );
}
