"use client";

import { adminApiFetch } from "@/lib/admin-api";

export type CommonLabels = {
  empty: string;
  error: string;
  loading: string;
  records: string;
};

export type Labels = Record<string, string>;

export type MePayload = {
  roles?: Array<{ role?: { permissions?: Array<{ permission?: { code?: string } }> } }>;
};

/** Set that treats `*` as a wildcard matching any permission code. */
class WildcardPermissionSet extends Set<string> {
  has(key: string): boolean {
    return super.has("*") || super.has(key);
  }
}

/** Compute permission code set from `/api/admin/me` payload. */
export function permsFromMe(me: MePayload): Set<string> {
  const out = new WildcardPermissionSet();
  for (const r of me.roles ?? []) {
    for (const link of r.role?.permissions ?? []) {
      const code = link.permission?.code;
      if (code) out.add(code);
    }
  }
  return out;
}

/** Fetch `/api/admin/me` and resolve a permission set. Resolves to empty set on error. */
export async function loadAdminPermissions(): Promise<Set<string>> {
  try {
    const r = await adminApiFetch("/api/admin/me");
    if (!r.ok) return new Set();
    const body = (await r.json()) as MePayload;
    return permsFromMe(body);
  } catch {
    return new Set();
  }
}

/** Quick CSV download helper for tables. */
export function downloadCsv(filename: string, header: string[], rows: string[][]) {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const body = [header, ...rows].map((r) => r.map(escape).join(",")).join("\n");
  const blob = new Blob([`\uFEFF${body}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Generic admin label picker for the `t(key)` helper used in clients. */
export function buildT(labels: Labels) {
  return (k: string) => labels[k] ?? k;
}
