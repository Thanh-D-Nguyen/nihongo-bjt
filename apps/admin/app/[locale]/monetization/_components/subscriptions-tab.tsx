"use client";

import {
  AdminDataTable,
  AdminDataTableBody,
  AdminDataTableHead,
  AdminDataTableRow,
  AdminDataTableTd,
  AdminDataTableTh,
  AdminEmptyState,
  AdminSearchInput,
  AdminSelect,
  AdminSection,
  AdminStatusBadge,
  Dialog,
} from "@nihongo-bjt/ui";
import { useCallback, useEffect, useState } from "react";

import { adminApiFetch } from "@/lib/admin-api";
import type { Subscription, TabCommonProps } from "./monetization-types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Labels = Record<string, any>;

interface Props extends TabCommonProps {
  labels: Labels;
}

const PAGE_SIZE = 20;

function subTone(status: string): "danger" | "good" | "neutral" | "warning" {
  if (status === "active" || status === "trialing") return "good";
  if (status === "past_due") return "danger";
  if (status === "canceled" || status === "expired") return "neutral";
  return "warning";
}

export function SubscriptionsTab({ common, canRead, canManage, labels }: Props) {
  const [items, setItems] = useState<Subscription[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Subscription | null>(null);
  const [editStatus, setEditStatus] = useState("");
  const [editCancelAtEnd, setEditCancelAtEnd] = useState(false);
  const [editReason, setEditReason] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    if (!canRead) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(page * PAGE_SIZE),
      });
      if (query.trim()) params.set("q", query.trim());
      if (statusFilter) params.set("status", statusFilter);
      const res = await adminApiFetch(`/api/admin/monetization/subscriptions?${params}`);
      if (!res.ok) {
        setError(common.error);
        return;
      }
      const data = (await res.json()) as { items: Subscription[]; total: number };
      setItems(data.items);
      setTotal(data.total);
    } catch {
      setError(common.error);
    } finally {
      setLoading(false);
    }
  }, [canRead, page, query, statusFilter, common.error]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const openEdit = (sub: Subscription) => {
    setEditing(sub);
    setEditStatus(sub.status);
    setEditCancelAtEnd(sub.cancelAtPeriodEnd);
    setEditReason("");
  };

  const saveEdit = async () => {
    if (!editing || editReason.trim().length < 3) return;
    setSaving(true);
    try {
      const res = await adminApiFetch(`/api/admin/monetization/subscriptions/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: editStatus,
          cancelAtPeriodEnd: editCancelAtEnd,
          reason: editReason.trim(),
        }),
      });
      if (res.ok) {
        setEditing(null);
        void fetchData();
      } else {
        setError(common.error);
      }
    } catch {
      setError(common.error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminSection title={labels.tab?.subscriptions ?? "Subscriptions"}>
      {error && <p className="text-sm text-rose-600">{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <AdminSearchInput
          placeholder={labels.subSearch}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(0);
          }}
        />
        <AdminSelect
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(0);
          }}
        >
          <option value="">{labels.subAllStatuses}</option>
          {["active", "trialing", "past_due", "canceled", "expired"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </AdminSelect>
        <span className="ml-auto text-xs text-slate-500">
          {common.records}: {total}
        </span>
      </div>

      {loading && <p className="text-sm text-slate-500">{common.loading}…</p>}

      {!loading && items.length === 0 && (
        <AdminEmptyState title={labels.noResults}>{labels.noResults}</AdminEmptyState>
      )}

      {!loading && items.length > 0 && (
        <div className="max-w-full overflow-x-auto">
          <AdminDataTable>
            <AdminDataTableHead>
              <AdminDataTableRow>
                {[labels.subUser, labels.subPlan, common.status, labels.subProvider, labels.subPeriod, labels.subCancelAtEnd, labels.actions].map((h) => (
                  <AdminDataTableTh key={h} className="whitespace-nowrap">{h}</AdminDataTableTh>
                ))}
              </AdminDataTableRow>
            </AdminDataTableHead>
            <AdminDataTableBody>
              {items.map((sub) => (
                <AdminDataTableRow key={sub.id}>
                  <AdminDataTableTd className="text-xs">
                    <span className="font-medium">{sub.user?.displayName ?? "—"}</span>
                    <br />
                    <span className="text-slate-500">{sub.user?.email ?? sub.userId}</span>
                  </AdminDataTableTd>
                  <AdminDataTableTd className="text-xs font-mono">
                    {sub.plan?.slug ?? sub.planId}
                  </AdminDataTableTd>
                  <AdminDataTableTd>
                    <AdminStatusBadge tone={subTone(sub.status)}>{sub.status}</AdminStatusBadge>
                  </AdminDataTableTd>
                  <AdminDataTableTd className="text-xs">{sub.provider}</AdminDataTableTd>
                  <AdminDataTableTd className="text-xs">
                    {sub.currentPeriodStart
                      ? `${new Date(sub.currentPeriodStart).toLocaleDateString()} – ${sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString() : "∞"}`
                      : "—"}
                  </AdminDataTableTd>
                  <AdminDataTableTd className="text-xs">
                    {sub.cancelAtPeriodEnd ? "✓" : "—"}
                  </AdminDataTableTd>
                  <AdminDataTableTd>
                    {canManage && (
                      <button
                        type="button"
                        className="text-xs text-indigo-600 hover:underline"
                        onClick={() => openEdit(sub)}
                      >
                        {labels.editLabel}
                      </button>
                    )}
                  </AdminDataTableTd>
                </AdminDataTableRow>
              ))}
            </AdminDataTableBody>
          </AdminDataTable>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2 text-xs">
          <button
            type="button"
            className="rounded border px-2 py-1 disabled:opacity-40"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            ←
          </button>
          <span>
            {labels.page} {page + 1} {labels.of} {totalPages}
          </span>
          <button
            type="button"
            className="rounded border px-2 py-1 disabled:opacity-40"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            →
          </button>
        </div>
      )}

      <Dialog open={!!editing}>
        <h3 className="text-sm font-semibold text-slate-900">{labels.subEdit}</h3>
        {editing && (
          <div className="mt-3 space-y-3">
            <div className="text-xs text-slate-600">
              {editing.user?.displayName} ({editing.user?.email})
            </div>
            <label className="block text-xs text-slate-600">
              {common.status}
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
              >
                {["active", "trialing", "past_due", "canceled", "expired"].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={editCancelAtEnd}
                onChange={(e) => setEditCancelAtEnd(e.target.checked)}
              />
              {labels.subCancelAtEnd}
            </label>
            <label className="block text-xs text-rose-700">
              {labels.reasonLabel ?? "Reason"} *
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
              />
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
                onClick={() => setEditing(null)}
              >
                {labels.close}
              </button>
              <button
                type="button"
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
                disabled={saving || editReason.trim().length < 3}
                onClick={() => void saveEdit()}
              >
                {labels.save ?? "Save"}
              </button>
            </div>
          </div>
        )}
      </Dialog>
    </AdminSection>
  );
}
