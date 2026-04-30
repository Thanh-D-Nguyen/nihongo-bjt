"use client";

import { useEffect, useState } from "react";

import { adminApiFetch } from "@/lib/admin-api";

interface ReportRow {
  context: string | null;
  createdAt: string;
  id: string;
  kind: string;
  textHash: string;
  user: { displayName: string; id: string } | null;
}

interface Labels {
  empty: string;
  error: string;
  eyebrow: string;
  hashLabel: string;
  kindLabel: string;
  loading: string;
  subtitle: string;
  title: string;
  userLabel: string;
}

export function ReadingAssistAdminClient({ labels }: { labels: Labels }) {
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadReports() {
      try {
        const response = await adminApiFetch("/api/admin/reading-assist/reports?limit=50");
        if (!response.ok) {
          throw new Error("Reading assist reports failed");
        }
        const data = (await response.json()) as ReportRow[];
        if (!cancelled) {
          setRows(data);
        }
      } catch {
        if (!cancelled) {
          setError(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadReports();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <section className="admin-card">
        <p className="eyebrow">{labels.eyebrow}</p>
        <h1>{labels.title}</h1>
        <p>{labels.subtitle}</p>
        {error ? <p role="alert">{labels.error}</p> : null}
        {loading ? <p>{labels.loading}</p> : null}
        {!loading && rows.length === 0 ? <p>{labels.empty}</p> : null}
        <ul className="deck-list">
          {rows.map((row) => (
            <li key={row.id}>
              <strong>{labels.kindLabel}</strong> {row.kind}
              <br />
              <span>
                {labels.hashLabel} {row.textHash}
              </span>
              <br />
              <span>
                {labels.userLabel} {row.user ? `${row.user.displayName} (${row.user.id})` : "—"}
              </span>
              {row.context ? (
                <>
                  <br />
                  <span>{row.context}</span>
                </>
              ) : null}
              <br />
              <small>{new Date(row.createdAt).toISOString()}</small>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
