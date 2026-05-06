"use client";

export type PitchToken = { type: string; value: string };

export type PitchEntry = {
  kana?: string;
  accent?: string;
  tokenizedKana?: PitchToken[];
};

function splitMoraTokens(tokens: PitchToken[] | undefined): string[] {
  if (!tokens?.length) return [];
  return tokens.flatMap((t) => {
    if (t.type === "mora" && t.value) return [t.value];
    return [];
  });
}

function moraChunksFromKana(kana: string | undefined): string[] {
  if (!kana) return [];
  return Array.from(kana);
}

/** First H/L sequence of matching length (e.g. "HLL-L" → ["H","L","L"] for 3 morae). */
function parseAccentLevels(accent: string | undefined, moraCount: number): ("H" | "L")[] | null {
  if (!accent || moraCount < 1) return null;
  const upper = accent.toUpperCase();
  const groups = upper.split("-");
  for (const g of groups) {
    const raw = g.replace(/[^HL]/g, "");
    if (raw.length !== moraCount) continue;
    return raw.split("").map((ch) => (ch === "H" ? "H" : "L")) as ("H" | "L")[];
  }
  return null;
}

export function parsePitchEntries(pron: unknown): PitchEntry[] {
  if (!Array.isArray(pron)) return [];
  return pron.filter(
    (e): e is PitchEntry =>
      e !== null && typeof e === "object" && ("kana" in e || "accent" in e || "tokenizedKana" in e)
  ) as PitchEntry[];
}

/** True when at least one entry can be drawn (mora list + matching H/L accent group). */
export function hasRenderablePitch(pronunciation: unknown): boolean {
  for (const e of parsePitchEntries(pronunciation)) {
    const morae = splitMoraTokens(e.tokenizedKana);
    const moraeFinal = morae.length > 0 ? morae : moraChunksFromKana(e.kana);
    if (moraeFinal.length < 1) continue;
    if (parseAccentLevels(e.accent, moraeFinal.length)) return true;
  }
  return false;
}

/**
 * OJAD Suzuki-kun–like: thin smooth pitch curve + overline (“mũ”) on high morae.
 * Curve: cubic easing between plateaus (not Mazii square steps).
 */
const MORA_CELL_PX = 40;
const PITCH_TAIL_PX = 14;
const PITCH_VB_H = 38;
const PITCH_CURVE_TENSION = 0.38;

type Pt = { x: number; y: number };

function buildSuzukiStylePath(cellW: number, levels: ("H" | "L")[], yHigh: number, yLow: number): string {
  const yAt = (lvl: "H" | "L") => (lvl === "H" ? yHigh : yLow);
  const n = levels.length;

  const centers = (i: number) => (i + 0.5) * cellW;
  const pts: Pt[] = [{ x: 0, y: yAt(levels[0]) }, { x: centers(0), y: yAt(levels[0]) }];
  for (let i = 1; i < n; i += 1) {
    pts.push({ x: centers(i), y: yAt(levels[i]) });
  }
  pts.push({ x: n * cellW + PITCH_TAIL_PX, y: yAt(levels[n - 1]) });

  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let k = 0; k < pts.length - 1; k += 1) {
    const a = pts[k];
    const b = pts[k + 1];
    if (a.y === b.y) {
      d += ` L ${b.x} ${b.y}`;
    } else {
      const dx = b.x - a.x;
      const t = PITCH_CURVE_TENSION;
      d += ` C ${a.x + dx * t} ${a.y} ${b.x - dx * t} ${b.y} ${b.x} ${b.y}`;
    }
  }
  return d;
}

type PitchContourProps = {
  morae: string[];
  levels: ("H" | "L")[];
};

function PitchContour({ morae, levels }: PitchContourProps) {
  const n = morae.length;
  if (n < 1 || levels.length !== n) return null;

  const cellW = MORA_CELL_PX;
  const lowY = 29;
  const highY = 9;
  const w = n * cellW + PITCH_TAIL_PX;
  const d = buildSuzukiStylePath(cellW, levels, highY, lowY);

  return (
    <svg
      className="mb-1 shrink-0 text-[var(--color-sakura)]"
      width={w}
      height={PITCH_VB_H}
      viewBox={`0 0 ${w} ${PITCH_VB_H}`}
      aria-hidden
    >
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.35}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        opacity={0.92}
      />
    </svg>
  );
}

type PitchRowProps = {
  morae: string[];
  levels: ("H" | "L")[];
};

function PitchRow({ morae, levels }: PitchRowProps) {
  const n = morae.length;
  if (n < 1 || levels.length !== n) return null;

  const w = n * MORA_CELL_PX + PITCH_TAIL_PX;

  return (
    <div className="space-y-0">
      <PitchContour morae={morae} levels={levels} />
      <div
        className="flex items-end border-b border-ink/10 pb-1"
        style={{ width: w, maxWidth: "100%" }}
      >
        {morae.map((m, i) => {
          const hi = levels[i] === "H";
          return (
            <div
              key={`${m}-${i}`}
              className="flex flex-col items-center justify-end"
              style={{ width: MORA_CELL_PX, minWidth: MORA_CELL_PX }}
            >
              <span className="mb-1 flex h-[4px] w-full items-end justify-center" aria-hidden>
                {hi ? (
                  <span className="block h-[2px] w-[1.2rem] rounded-[1px] bg-[var(--color-sakura)] opacity-[0.95]" />
                ) : (
                  <span className="block h-[2px] w-[1.2rem]" />
                )}
              </span>
              <span
                className={
                  hi
                    ? "jp-text text-center font-mono text-sm font-semibold tabular-nums text-[var(--color-sakura)]"
                    : "jp-text text-center font-mono text-sm font-medium tabular-nums text-ink/75"
                }
              >
                {m}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type PitchAccentDisplayProps = {
  pronunciation: unknown;
  /** i18n: short legend under diagrams */
  legend?: string;
  /** i18n: “Biến thể {n}” */
  variantLabelTpl?: string;
};

export function PitchAccentDisplay({ pronunciation, legend, variantLabelTpl }: PitchAccentDisplayProps) {
  const entries = parsePitchEntries(pronunciation);
  const rows: { morae: string[]; levels: ("H" | "L")[]; kana?: string }[] = [];

  for (const e of entries) {
    const morae = splitMoraTokens(e.tokenizedKana);
    const moraeFinal = morae.length > 0 ? morae : moraChunksFromKana(e.kana);
    if (moraeFinal.length < 1) continue;
    const levels = parseAccentLevels(e.accent, moraeFinal.length);
    if (!levels) continue;
    rows.push({ morae: moraeFinal, levels, kana: e.kana });
  }

  if (rows.length < 1) return null;

  return (
    <div className="space-y-0 divide-y divide-ink/10">
      {rows.map((row, idx) => (
        <div key={`${row.kana ?? ""}-${idx}`} className={idx > 0 ? "pt-4" : ""}>
          {rows.length > 1 && variantLabelTpl ? (
            <p className="mb-2 text-xs font-medium text-muted">
              {variantLabelTpl.replace("{n}", String(idx + 1))}
            </p>
          ) : null}
          <div className="max-w-full overflow-x-auto">
            <PitchRow morae={row.morae} levels={row.levels} />
          </div>
        </div>
      ))}
      {legend ? <p className="text-xs leading-relaxed text-muted">{legend}</p> : null}
    </div>
  );
}
