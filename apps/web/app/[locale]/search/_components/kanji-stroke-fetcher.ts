import type { KanjiDetailDto } from "./kanji-detail-dto";
import { normalizeKanjiDetailDto } from "./kanji-detail-dto";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const RATE_LIMIT_RETRY_MS = 200;
const RATE_LIMIT_RETRIES = 1;

type LookupResult =
  | { status: "ok"; dto: KanjiDetailDto }
  | { status: "empty" };

const pendingLookups = new Map<string, Promise<LookupResult>>();
const resolvedLookups = new Map<string, LookupResult>();

export function isSingleKanjiCharacter(value: string): boolean {
  return value.length === 1 && /\p{Script=Han}/u.test(value);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestKanjiLookup(value: string, attempt = 0): Promise<LookupResult> {
  const res = await fetch(`${API_BASE}/api/kanji?q=${encodeURIComponent(value)}&limit=1`, {
    cache: "no-store",
    credentials: "omit",
    mode: "cors"
  });

  if (res.status === 429 && attempt < RATE_LIMIT_RETRIES) {
    await sleep(RATE_LIMIT_RETRY_MS * (attempt + 1));
    return requestKanjiLookup(value, attempt + 1);
  }

  if (!res.ok) {
    return { status: "empty" };
  }

  const body: unknown = await res.json();
  if (!Array.isArray(body) || body.length === 0) {
    const result = { status: "empty" } satisfies LookupResult;
    resolvedLookups.set(value, result);
    return result;
  }

  const dto = normalizeKanjiDetailDto(body[0]);
  if (!dto.id) {
    const result = { status: "empty" } satisfies LookupResult;
    resolvedLookups.set(value, result);
    return result;
  }

  const result = { status: "ok", dto } satisfies LookupResult;
  resolvedLookups.set(value, result);
  return result;
}

export async function fetchKanjiByCharacter(value: string): Promise<LookupResult> {
  if (!isSingleKanjiCharacter(value)) {
    return { status: "empty" };
  }

  const resolved = resolvedLookups.get(value);
  if (resolved) {
    return resolved;
  }

  const pending = pendingLookups.get(value);
  if (pending) {
    return pending;
  }

  const promise: Promise<LookupResult> = (async () => {
    try {
      return await requestKanjiLookup(value);
    } catch {
      return { status: "empty" as const };
    } finally {
      pendingLookups.delete(value);
    }
  })();

  pendingLookups.set(value, promise);
  return promise;
}
