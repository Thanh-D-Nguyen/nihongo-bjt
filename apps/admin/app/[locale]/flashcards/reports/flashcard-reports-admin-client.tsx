"use client";

import {
  AdminDataTable, AdminDataTableBody, AdminDataTableHead, AdminDataTableRow,
  AdminDataTableTd, AdminDataTableTh, AdminEmptyState, AdminPageHeader, AdminSection
} from "@nihongo-bjt/ui";
import { useEffect, useState } from "react";

import { loadAdminPermissions } from "@/app/_components/admin-client-utils";
import { adminApiFetch } from "@/lib/admin-api";

type Status = "pending" | "resolved" | "dismissed";
type Report = {
  id: string;
  deckId: string;
  titleVi: string;
  titleJa: string | null;
  deckStatus: string;
  reason: string;
  status: Status;
  createdAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;
};
type ListResponse = { items: Report[]; total: number; page: number; pageSize: number };

export function FlashcardReportsAdminClient({
  labels: t,
  common
}: {
  labels: Record<string, string>;
  common: { loading: string; empty: string; error: string; records: string };
}) {
  const [permissions, setPermissions] = useState<Set<string> | null>(null);
  const [status, setStatus] = useState<Status>("pending");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [list, setList] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Report | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const canWrite = permissions?.has("admin.content.write") === true;

  useEffect(() => {
    let active = true;
    void loadAdminPermissions().then((value) => { if (active) setPermissions(value); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void (async () => {
      try {
        const res = await adminApiFetch(`/api/admin/flashcards/reports?status=${status}&page=${page}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as ListResponse;
        if (active) setList(data);
      } catch {
        if (active) { setList(null); setError(t.loadFailed); }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [status, page, revision, t.loadFailed]);

  function selectReport(report: Report) {
    setSelected(report);
    setNote("");
    setError("");
  }

  async function review(action: "remove" | "dismiss") {
    if (!selected || !canWrite || busy) return;
    const reviewNote = note.trim();
    if (Array.from(reviewNote).length < 3 || Array.from(reviewNote).length > 500) {
      setError(t.noteRequired);
      return;
    }
    if (action === "remove" && !window.confirm(t.confirmRemove)) return;
    setBusy(true);
    setError("");
    try {
      const res = await adminApiFetch(`/api/admin/flashcards/reports/${selected.id}/review`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, note: reviewNote })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSelected(null);
      setNote("");
      setRevision((n) => n + 1);
    } catch {
      setError(t.reviewFailed);
    } finally {
      setBusy(false);
    }
  }

  const pages = list ? Math.max(1, Math.ceil(list.total / list.pageSize)) : 1;

  return (
    <div className="space-y-4">
      <AdminPageHeader title={t.title} description={t.subtitle} />
      {permissions && !canWrite ? <p className="rounded border border-amber-300 p-3 text-sm">{t.readOnly}</p> : null}
      <AdminSection>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm" htmlFor="report-status">{t.filterStatus}</label>
          <select id="report-status" className="rounded border px-2 py-1 text-sm" value={status}
            onChange={(event) => { setStatus(event.target.value as Status); setPage(1); setSelected(null); }}>
            <option value="pending">{t.pending}</option>
            <option value="resolved">{t.resolved}</option>
            <option value="dismissed">{t.dismissed}</option>
          </select>
          <button type="button" className="rounded border px-3 py-1 text-sm" onClick={() => setRevision((n) => n + 1)}>{t.refresh}</button>
        </div>
      </AdminSection>

      {error ? <p role="alert" className="rounded border border-red-300 p-3 text-sm text-red-700">{error}</p> : null}

      <AdminSection>
        {loading ? <p className="p-3 text-sm">{common.loading}</p> : list?.items.length === 0 ? (
          <AdminEmptyState title={common.empty} />
        ) : list ? (
          <div className="overflow-x-auto">
            <AdminDataTable>
              <AdminDataTableHead><AdminDataTableRow>
                <AdminDataTableTh>{t.deck}</AdminDataTableTh>
                <AdminDataTableTh>{t.reason}</AdminDataTableTh>
                <AdminDataTableTh>{t.deckStatus}</AdminDataTableTh>
                <AdminDataTableTh>{t.date}</AdminDataTableTh>
                <AdminDataTableTh>{t.action}</AdminDataTableTh>
              </AdminDataTableRow></AdminDataTableHead>
              <AdminDataTableBody>{list.items.map((report) => (
                <AdminDataTableRow key={report.id}>
                  <AdminDataTableTd><span className="font-medium">{report.titleVi}</span>
                    {report.titleJa ? <span className="block text-xs">{report.titleJa}</span> : null}</AdminDataTableTd>
                  <AdminDataTableTd>{t[`reason_${report.reason}`] ?? report.reason}</AdminDataTableTd>
                  <AdminDataTableTd>{report.deckStatus}</AdminDataTableTd>
                  <AdminDataTableTd>{new Date(report.createdAt).toLocaleString()}</AdminDataTableTd>
                  <AdminDataTableTd>{status === "pending" && canWrite ? (
                    <button type="button" className="rounded border px-3 py-1 text-sm" onClick={() => selectReport(report)}>{t.action}</button>
                  ) : report.reviewNote ?? "—"}</AdminDataTableTd>
                </AdminDataTableRow>
              ))}</AdminDataTableBody>
            </AdminDataTable>
          </div>
        ) : null}
        {list && pages > 1 ? <div className="mt-3 flex items-center justify-end gap-3 text-sm">
          <button type="button" disabled={page <= 1} onClick={() => setPage((n) => n - 1)}>{t.previous}</button>
          <span>{t.page} {page} / {pages}</span>
          <button type="button" disabled={page >= pages} onClick={() => setPage((n) => n + 1)}>{t.next}</button>
        </div> : null}
      </AdminSection>

      {selected && canWrite ? <AdminSection>
        <div className="space-y-3 rounded border p-4">
          <h2 className="font-semibold">{selected.titleVi}</h2>
          <label className="block text-sm" htmlFor="review-note">{t.note}</label>
          <textarea id="review-note" className="w-full rounded border p-2 text-sm" rows={3} maxLength={500}
            value={note} onChange={(event) => { setNote(event.target.value); setError(""); }} />
          <div className="flex flex-wrap gap-2">
            <button className="rounded bg-red-700 px-3 py-2 text-sm text-white disabled:opacity-50" type="button"
              disabled={busy} onClick={() => void review("remove")}>{t.remove}</button>
            <button className="rounded border px-3 py-2 text-sm disabled:opacity-50" type="button"
              disabled={busy} onClick={() => void review("dismiss")}>{t.dismiss}</button>
            <button className="rounded border px-3 py-2 text-sm" type="button" disabled={busy}
              onClick={() => setSelected(null)}>{t.cancel}</button>
          </div>
        </div>
      </AdminSection> : null}
    </div>
  );
}
