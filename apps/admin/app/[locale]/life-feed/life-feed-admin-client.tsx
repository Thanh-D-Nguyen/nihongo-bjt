"use client";

import { useCallback, useEffect, useState } from "react";

import { adminApiFetch } from "@/lib/admin-api";
import { permsFromMe, type MePayload } from "@/app/_components/admin-client-utils";

type Labels = Record<string, string>;
type LifeRow = {
  id: string;
  cardKey: string;
  topic: string;
  cityId: string | null;
  validFrom: string;
  validUntil: string;
  status: "draft" | "reviewed" | "published";
  rightsStatus: "unknown" | "blocked" | "cleared";
  card: unknown;
};
type Editor = { cityId: string; validFrom: string; validUntil: string; cardText: string };
const endpoint = "/api/admin/life/lessons";
const todayJST = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
const emptyEditor = (): Editor => ({ cityId: "", validFrom: todayJST(), validUntil: todayJST(), cardText: "" });
const fromRow = (row: LifeRow): Editor => ({
  cityId: row.cityId ?? "", validFrom: row.validFrom, validUntil: row.validUntil,
  cardText: JSON.stringify(row.card, null, 2)
});

export function LifeFeedAdminClient({ labels }: { labels: Labels }) {
  const [rows, setRows] = useState<LifeRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editor, setEditor] = useState<Editor>(emptyEditor);
  const [canWrite, setCanWrite] = useState(false);
  const [rightsStatus, setRightsStatus] = useState<"cleared" | "blocked">("blocked");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const selected = rows.find((row) => row.id === selectedId);

  const load = useCallback(async () => {
    const response = await adminApiFetch(endpoint);
    if (!response.ok) throw new Error(`${response.status}: ${labels.error}`);
    setRows(((await response.json()) as { items: LifeRow[] }).items);
  }, [labels.error]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([adminApiFetch("/api/admin/me"), adminApiFetch(endpoint)])
      .then(async ([me, result]) => {
        if (!result.ok) throw new Error(`${result.status}: ${labels.error}`);
        const items = ((await result.json()) as { items: LifeRow[] }).items;
        const permissions = me.ok ? permsFromMe((await me.json()) as MePayload) : new Set<string>();
        if (!cancelled) {
          setRows(items);
          setCanWrite(permissions.has("admin.content.write"));
        }
      })
      .catch((error: unknown) => { if (!cancelled) setMessage(String(error)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [labels.error]);

  async function perform(path: string, method: "POST" | "PUT", payload: unknown) {
    setBusy(true);
    setMessage("");
    try {
      const response = await adminApiFetch(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!response.ok) {
        const detail = (await response.json().catch(() => ({}))) as { message?: string; error?: string };
        throw new Error(detail.message ?? detail.error ?? `${labels.error} (${response.status})`);
      }
      await load();
      setMessage(labels.confirmed);
      return (await response.json()) as { id: string };
    } catch (error) {
      setMessage(error instanceof Error ? error.message : labels.error);
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    let card: unknown;
    try {
      card = JSON.parse(editor.cardText);
      if (!card || typeof card !== "object" || Array.isArray(card)) throw new Error();
    } catch {
      setMessage(labels.invalidJson);
      return;
    }
    const result = await perform(selectedId ? `${endpoint}/${selectedId}` : endpoint, selectedId ? "PUT" : "POST", {
      cityId: editor.cityId, validFrom: editor.validFrom, validUntil: editor.validUntil, card
    });
    if (result) setSelectedId(result.id);
  }

  const input = "rounded-lg border border-slate-300 bg-white p-2 text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-white";
  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">{labels.title}</h1>
        <p className="mt-2 text-sm text-slate-500">{labels.subtitle}</p>
      </header>
      {message && <p role="status" className="rounded-lg border p-3 text-sm">{message}</p>}
      <div className="flex gap-3">
        <button className={input} onClick={() => { setSelectedId(null); setEditor(emptyEditor()); setReason(""); }}>{labels.new}</button>
        <button className={input} onClick={() => void load().catch((e: unknown) => setMessage(String(e)))}>{labels.reload}</button>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(240px,1fr)_minmax(0,2fr)]">
        <section aria-label={labels.status} className="space-y-2">
          {loading && <p>{labels.loading}</p>}
          {!loading && rows.length === 0 && <p>{labels.empty}</p>}
          {rows.map((row) => (
            <button key={row.id} className={`w-full rounded-lg border p-3 text-left text-sm ${selectedId === row.id ? "border-blue-500" : "border-slate-300 dark:border-slate-600"}`}
              onClick={() => { setSelectedId(row.id); setEditor(fromRow(row)); setReason(""); }}>
              <strong className="block break-all">{row.cardKey}</strong>
              <span>{row.topic} · {row.cityId || "*"} · {row.status} / {row.rightsStatus}</span>
              <span className="mt-1 block text-xs opacity-70">{row.validFrom} – {row.validUntil}</span>
            </button>
          ))}
        </section>
        <section className="space-y-4 rounded-xl border border-slate-300 p-4 dark:border-slate-600">
          <h2 className="font-semibold">{selected ? `${labels.edit}: ${selected.cardKey}` : labels.new}</h2>
          <label className="block text-sm">{labels.city}<input className={`mt-1 block w-full ${input}`} value={editor.cityId} disabled={!canWrite || busy} onChange={(e) => setEditor({ ...editor, cityId: e.target.value })} /></label>
          <div className="grid grid-cols-2 gap-3">
            {(["validFrom", "validUntil"] as const).map((field) => (
              <label className="block text-sm" key={field}>{field === "validFrom" ? labels.from : labels.until}
                <input type="date" className={`mt-1 block w-full ${input}`} value={editor[field]} disabled={!canWrite || busy} onChange={(e) => setEditor({ ...editor, [field]: e.target.value })} />
              </label>
            ))}
          </div>
          <label className="block text-sm">{labels.card}
            <textarea className={`mt-1 block h-80 w-full font-mono text-xs ${input}`} value={editor.cardText} disabled={!canWrite || busy} spellCheck={false} onChange={(e) => setEditor({ ...editor, cardText: e.target.value })} />
          </label>
          {canWrite && <button className={input} onClick={() => void save()} disabled={busy}>{busy ? labels.saving : labels.save}</button>}
          {selected && canWrite && selected.status !== "published" && <div className="space-y-3 border-t pt-4 dark:border-slate-600">
            <label className="block text-sm">{labels.rights}
              <select className={`mt-1 block w-full ${input}`} value={rightsStatus} onChange={(e) => setRightsStatus(e.target.value as "cleared" | "blocked")}>
                <option value="blocked">{labels.blocked}</option><option value="cleared">{labels.cleared}</option>
              </select>
            </label>
            <label className="block text-sm">{labels.reason}
              <textarea className={`mt-1 block min-h-20 w-full ${input}`} value={reason} onChange={(e) => setReason(e.target.value)} />
            </label>
            <button className={input} disabled={busy || reason.trim().length < 10} onClick={() => void perform(`${endpoint}/${selected.id}/review`, "POST", { rightsStatus, reason })}>{labels.review}</button>
          </div>}
          {selected?.status === "reviewed" && selected.rightsStatus === "cleared" && canWrite &&
            <button className={input} disabled={busy} onClick={() => void perform(`${endpoint}/${selected.id}/publish`, "POST", {})}>{labels.publish}</button>}
        </section>
      </div>
    </main>
  );
}
