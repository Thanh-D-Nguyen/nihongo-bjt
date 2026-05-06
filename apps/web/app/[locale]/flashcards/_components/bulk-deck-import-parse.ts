export type BulkDeckRow = { backText: string; frontText: string; imageUrl?: string };

export type BulkParseResult =
  | { key: "invalid_line"; line: number; ok: false }
  | { key: "too_many"; ok: false }
  | { ok: true; rows: BulkDeckRow[] };

const MAX_ROWS = 200;

export function parseBulkDeckLines(raw: string): BulkParseResult {
  const lines = raw.split(/\r?\n/);
  const nonEmpty = lines.map((l) => l.trim()).filter((l) => l.length > 0);
  if (nonEmpty.length === 0) {
    return { ok: true, rows: [] };
  }
  if (nonEmpty.length > MAX_ROWS) {
    return { key: "too_many", ok: false };
  }
  const rows: BulkDeckRow[] = [];
  for (let i = 0; i < nonEmpty.length; i++) {
    const line = nonEmpty[i]!;
    const parts = line.split("\t");
    let front: string;
    let back: string;
    let imageUrl: string | undefined;
    if (parts.length >= 2) {
      front = parts[0]!.trim();
      back = parts[1]!.trim();
      imageUrl = parts[2]?.trim() || undefined;
    } else {
      const idx = line.indexOf("|");
      if (idx === -1) {
        return { key: "invalid_line", line: i + 1, ok: false };
      }
      front = line.slice(0, idx).trim();
      const rest = line.slice(idx + 1);
      const idx2 = rest.indexOf("|");
      if (idx2 === -1) {
        back = rest.trim();
      } else {
        back = rest.slice(0, idx2).trim();
        imageUrl = rest.slice(idx2 + 1).trim() || undefined;
      }
    }
    if (!front || !back) {
      return { key: "invalid_line", line: i + 1, ok: false };
    }
    rows.push({ backText: back, frontText: front, imageUrl });
  }
  return { ok: true, rows };
}
