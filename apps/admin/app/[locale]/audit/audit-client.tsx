"use client";

import { useEffect, useState } from "react";

import { adminApiFetch } from "@/lib/admin-api";

interface AuditLabels {
  empty: string;
  error: string;
  eyebrow: string;
  loading: string;
  subtitle: string;
  title: string;
}

interface AuditLog {
  action: string;
  actor: { displayName: string };
  createdAt: string;
  id: string;
  reason: string | null;
  targetId: string;
  targetType: string;
}

export function AuditClient({ labels }: { labels: AuditLabels }) {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadAudit() {
      try {
        const response = await adminApiFetch("/api/admin/audit");
        if (!response.ok) {
          throw new Error("Audit request failed");
        }
        const data = (await response.json()) as AuditLog[];
        if (!cancelled) {
          setAuditLogs(data);
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

    void loadAudit();

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
        {!loading && auditLogs.length === 0 ? <p>{labels.empty}</p> : null}
        <ul className="deck-list">
          {auditLogs.map((log) => (
            <li key={log.id}>
              <strong>{log.action}</strong>
              <span>
                {log.actor.displayName} · {log.targetType}:{log.targetId}
              </span>
              <span>{log.reason ?? new Date(log.createdAt).toLocaleString()}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
