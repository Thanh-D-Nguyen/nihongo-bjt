"use client";

import {
  AdminDataTable,
  AdminDataTableBody,
  AdminDataTableHead,
  AdminDataTableRow,
  AdminDataTableTd,
  AdminDataTableTh,
  AdminEmptyState,
  AdminPageHeader,
  AdminSection,
  AdminStatusBadge
} from "@nihongo-bjt/ui";
import { useCallback, useEffect, useMemo, useState } from "react";

import { adminApiFetch } from "@/lib/admin-api";

type CommonLabels = {
  empty: string;
  error: string;
  loading: string;
  records: string;
};

type ColumnDef = {
  key: string;
  label: string;
};

type JsonRow = Record<string, unknown>;

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.length > 0 ? value.map((entry) => String(entry)).join(", ") : "-";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

function toRows(payload: unknown): JsonRow[] {
  if (Array.isArray(payload)) {
    return payload.filter((row): row is JsonRow => typeof row === "object" && row !== null);
  }
  if (payload && typeof payload === "object") {
    const maybeItems = (payload as { items?: unknown }).items;
    if (Array.isArray(maybeItems)) {
      return maybeItems.filter((row): row is JsonRow => typeof row === "object" && row !== null);
    }
    return [payload as JsonRow];
  }
  return [];
}

export function AdminResourceTableClient({
  columns,
  common,
  description,
  endpoint,
  statusKeys,
  title
}: {
  columns: ColumnDef[];
  common: CommonLabels;
  description?: string;
  endpoint: string;
  statusKeys?: string[];
  title: string;
}) {
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<unknown>(null);

  const rows = useMemo(() => toRows(payload), [payload]);
  const statusKeySet = useMemo(() => new Set(statusKeys ?? ["status"]), [statusKeys]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const response = await adminApiFetch(endpoint);
      if (!response.ok) {
        throw new Error("admin_endpoint_failed");
      }
      setPayload((await response.json()) as unknown);
    } catch {
      setError(true);
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <AdminPageHeader description={description ?? ""} title={title} />
      <AdminSection description={`${common.records}: ${rows.length}`} title={title}>
        {loading ? <p className="text-sm text-slate-600">{common.loading}</p> : null}
        {error ? (
          <AdminEmptyState title={common.error}>{common.error}</AdminEmptyState>
        ) : null}
        {!loading && !error && rows.length === 0 ? (
          <AdminEmptyState title={common.empty}>{common.empty}</AdminEmptyState>
        ) : null}
        {!loading && !error && rows.length > 0 ? (
          <AdminDataTable>
            <AdminDataTableHead>
              <AdminDataTableRow>
                {columns.map((column) => (
                  <AdminDataTableTh key={column.key}>{column.label}</AdminDataTableTh>
                ))}
              </AdminDataTableRow>
            </AdminDataTableHead>
            <AdminDataTableBody>
              {rows.map((row, idx) => (
                <AdminDataTableRow key={String(row.id ?? `${endpoint}-${idx}`)}>
                  {columns.map((column) => {
                    const value = row[column.key];
                    if (statusKeySet.has(column.key)) {
                      return (
                        <AdminDataTableTd key={column.key}>
                          <AdminStatusBadge tone={String(value ?? "").includes("healthy") ? "good" : "warning"}>
                            {formatValue(value)}
                          </AdminStatusBadge>
                        </AdminDataTableTd>
                      );
                    }
                    return <AdminDataTableTd key={column.key}>{formatValue(value)}</AdminDataTableTd>;
                  })}
                </AdminDataTableRow>
              ))}
            </AdminDataTableBody>
          </AdminDataTable>
        ) : null}
      </AdminSection>
    </div>
  );
}
