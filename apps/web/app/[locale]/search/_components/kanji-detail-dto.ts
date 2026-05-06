export interface KanjiDetailDto {
  character: string;
  id: string;
  kunyomi: string | null;
  meaningVi: string | null;
  onyomi: string | null;
  strokeCount: number | null;
  level: number | null;
  strokeSvgHash?: string | null;
  strokeSvgPath?: string | null;
  strokeSvgSource?: string | null;
  examples?: Array<{ position?: number; word?: string | null }>;
  components?: Array<{ character: string; hanViet?: string | null; position?: number }>;
}

function pickField(r: Record<string, unknown>, camel: string, snake: string): unknown {
  if (Object.prototype.hasOwnProperty.call(r, camel)) return r[camel];
  if (Object.prototype.hasOwnProperty.call(r, snake)) return r[snake];
  return undefined;
}

function strOrNull(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "string") {
    const t = v.trim();
    return t.length ? t : null;
  }
  return String(v);
}

function numOrNull(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v);
  return null;
}

/** Normalize API / Prisma JSON (camelCase or snake_case) into `KanjiDetailDto`. */
export function normalizeKanjiDetailDto(raw: unknown): KanjiDetailDto {
  if (!raw || typeof raw !== "object") {
    return {
      character: "",
      components: [],
      examples: [],
      id: "",
      kunyomi: null,
      level: null,
      meaningVi: null,
      onyomi: null,
      strokeCount: null,
      strokeSvgHash: null,
      strokeSvgPath: null,
      strokeSvgSource: null
    };
  }
  const r = raw as Record<string, unknown>;
  const comps = Array.isArray(r.components) ? (r.components as KanjiDetailDto["components"]) : undefined;
  const ex = Array.isArray(r.examples) ? (r.examples as KanjiDetailDto["examples"]) : undefined;
  return {
    character: String(r.character ?? ""),
    components: comps,
    examples: ex,
    id: String(r.id ?? ""),
    kunyomi: strOrNull(pickField(r, "kunyomi", "kunyomi")),
    level: numOrNull(pickField(r, "level", "level")),
    meaningVi: strOrNull(pickField(r, "meaningVi", "meaning_vi")),
    onyomi: strOrNull(pickField(r, "onyomi", "onyomi")),
    strokeCount: numOrNull(pickField(r, "strokeCount", "stroke_count")),
    strokeSvgHash: strOrNull(pickField(r, "strokeSvgHash", "stroke_svg_hash")),
    strokeSvgPath: strOrNull(pickField(r, "strokeSvgPath", "stroke_svg_path")),
    strokeSvgSource: strOrNull(pickField(r, "strokeSvgSource", "stroke_svg_source"))
  };
}
