/**
 * Parses JSON error responses from the Nest API (e.g. BadRequestException) for user-safe copy.
 */
export class CmsRequestError extends Error {
  override readonly name = "CmsRequestError";

  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
  }
}

function flattenZodFieldErrors(obj: object): string | null {
  if (!("formErrors" in obj) && !("fieldErrors" in obj)) {
    return null;
  }
  const parts: string[] = [];
  const o = obj as { fieldErrors?: Record<string, string[]>; formErrors?: string[] };
  if (Array.isArray(o.formErrors) && o.formErrors.length) {
    parts.push(...o.formErrors);
  }
  if (o.fieldErrors && typeof o.fieldErrors === "object") {
    for (const [k, v] of Object.entries(o.fieldErrors)) {
      if (Array.isArray(v) && v.length) {
        parts.push(`${k}: ${v.join(", ")}`);
      }
    }
  }
  return parts.length ? parts.join(" · ") : null;
}

export async function readAdminApiErrorMessage(res: Response): Promise<string> {
  const text = await res.text();
  if (!text.trim()) {
    return res.statusText || `HTTP ${res.status}`;
  }
  try {
    const j = JSON.parse(text) as unknown;
    if (j && typeof j === "object") {
      if ("message" in j) {
        const m = (j as { message: unknown }).message;
        if (typeof m === "string" && m.trim()) {
          return m.trim();
        }
        if (Array.isArray(m) && m.length) {
          return m.map(String).join("; ");
        }
        if (m && typeof m === "object") {
          const flat = flattenZodFieldErrors(m as object);
          if (flat) {
            return flat;
          }
          try {
            return JSON.stringify(m);
          } catch {
            return String(m);
          }
        }
      }
    }
  } catch {
    // not JSON: fall through
  }
  return text.length > 800 ? `${text.slice(0, 800)}…` : text;
}

export async function toCmsRequestError(res: Response): Promise<CmsRequestError> {
  const detail = await readAdminApiErrorMessage(res);
  return new CmsRequestError(res.status, detail);
}
