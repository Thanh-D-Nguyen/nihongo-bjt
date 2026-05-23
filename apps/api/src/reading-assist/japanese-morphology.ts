import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const kuromoji: {
  builder: (opts: { dicPath: string }) => {
    build: (cb: (err: Error | null, t: Tokenizer) => void) => void;
  };
} = require("kuromoji");

export type KuromojiToken = {
  basic_form: string;
  pos: string;
  reading?: string;
  surface_form: string;
  word_id: number;
};

type Tokenizer = { tokenize: (text: string) => KuromojiToken[] };

const dicPath = path.join(path.dirname(require.resolve("kuromoji/package.json")), "dict");

let tokenizerPromise: Promise<Tokenizer> | null = null;

function loadTokenizer(): Promise<Tokenizer> {
  if (tokenizerPromise) {
    return tokenizerPromise;
  }
  tokenizerPromise = new Promise((resolve, reject) => {
    kuromoji.builder({ dicPath }).build((err, tokenizer) => {
      if (err || !tokenizer) {
        reject(err ?? new Error("kuromoji tokenizer build failed"));
        return;
      }
      resolve(tokenizer);
    });
  });
  return tokenizerPromise;
}

export function normalizeTextForAnalysis(text: string): string {
  return text.normalize("NFKC").replace(/\s+/g, " ").trim();
}

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

export function katakanaToHiragana(s: unknown): string {
  if (typeof s !== "string" || s.length === 0) {
    return "";
  }
  return [...s]
    .map((ch) => {
      const c = ch.codePointAt(0) ?? 0;
      if (c >= 0x30a1 && c <= 0x30f6) {
        return String.fromCodePoint(c - 0x60);
      }
      return ch;
    })
    .join("");
}

/**
 * Returns raw kuromoji tokens and character span per token (contiguous to normalized text).
 */
export async function tokenizeJapanese(text: string) {
  const normalized = normalizeTextForAnalysis(text);
  if (!normalized) {
    return { normalized, spans: [] as Array<{ end: number; start: number; token: KuromojiToken }> };
  }
  const tokenizer = await loadTokenizer();
  const raw = tokenizer.tokenize(normalized);
  let start = 0;
  const spans: Array<{ end: number; start: number; token: KuromojiToken }> = [];
  for (const t of raw) {
    const len = t.surface_form.length;
    if (len === 0) {
      continue;
    }
    const end = start + len;
    if (normalized.slice(start, end) !== t.surface_form) {
      // Rare mismatch after normalization: realign by searching from current position
      const idx = normalized.indexOf(t.surface_form, Math.max(0, start - 1));
      if (idx < 0) {
        start = end;
        continue;
      }
      const realStart = idx;
      spans.push({ end: realStart + len, start: realStart, token: t });
      start = realStart + len;
      continue;
    }
    spans.push({ end, start, token: t });
    start = end;
  }
  return { normalized, spans };
}
