"use client";

import { useEffect, useState } from "react";

import { adminApiFetch } from "@/lib/admin-api";

interface IamLabels {
  error: string;
  eyebrow: string;
  loading: string;
  permissions: string;
  roles: string;
  subtitle: string;
  title: string;
}

interface AdminMe {
  displayName: string;
  email: string;
  roles: Array<{
    role: {
      code: string;
      permissions: Array<{ permission: { code: string } }>;
    };
  }>;
}

interface RoleRow {
  code: string;
  description?: string | null;
  permissions: Array<{ permission: { code: string } }>;
  _count?: { admins?: number };
}

interface PermissionRow {
  code: string;
  description?: string | null;
}

interface AdminRow {
  id: string;
  email: string;
  displayName?: string | null;
  status?: string | null;
  roles: Array<{ role: { code: string } }>;
}

interface RoleAuditRow {
  id: string;
  action: string;
  actorEmail?: string | null;
  targetEmail?: string | null;
  roleCode?: string | null;
  createdAt: string;
}

function unwrap<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object" && "items" in (data as Record<string, unknown>)) {
    const items = (data as { items?: unknown }).items;
    return Array.isArray(items) ? (items as T[]) : [];
  }
  return [];
}

export function IamClient({ labels }: { labels: IamLabels }) {
  const [admin, setAdmin] = useState<AdminMe | null>(null);
  const [roles, setRoles] = useState<RoleRow[] | null>(null);
  const [permissions, setPermissions] = useState<PermissionRow[] | null>(null);
  const [admins, setAdmins] = useState<AdminRow[] | null>(null);
  const [audit, setAudit] = useState<RoleAuditRow[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [meRes, rolesRes, permsRes, adminsRes, auditRes] = await Promise.all([
          adminApiFetch("/api/admin/me"),
          adminApiFetch("/api/admin/iam/roles"),
          adminApiFetch("/api/admin/iam/permissions"),
          adminApiFetch("/api/admin/iam/admins"),
          adminApiFetch("/api/admin/iam/role-audit?limit=10")
        ]);
        if (!meRes.ok) throw new Error("me failed");
        const me = (await meRes.json()) as AdminMe;
        const rolesData = rolesRes.ok ? await rolesRes.json() : [];
        const permsData = permsRes.ok ? await permsRes.json() : [];
        const adminsData = adminsRes.ok ? await adminsRes.json() : [];
        const auditData = auditRes.ok ? await auditRes.json() : [];
        if (!cancelled) {
          setAdmin(me);
          setRoles(unwrap<RoleRow>(rolesData));
          setPermissions(unwrap<PermissionRow>(permsData));
          setAdmins(unwrap<AdminRow>(adminsData));
          setAudit(unwrap<RoleAuditRow>(auditData));
        }
      } catch {
        if (!cancelled) setError(true);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const myPermissions = [
    ...new Set(
      admin?.roles.flatMap((r) => r.role.permissions.map((p) => p.permission.code)) ?? []
    )
  ];

  const totalRoles = roles?.length ?? 0;
  const totalPermissions = permissions?.length ?? 0;
  const totalAdmins = admins?.length ?? 0;
  const activeAdmins = admins?.filter((a) => (a.status ?? "active") === "active").length ?? 0;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <section className="admin-card">
        <p className="eyebrow">{labels.eyebrow}</p>
        <h1>{labels.title}</h1>
        <p className="lead">{labels.subtitle}</p>
        {error ? <p role="alert">{labels.error}</p> : null}
        {!admin && !error ? <p>{labels.loading}</p> : null}
      </section>

      {admin ? (
        <>
          <section className="grid gap-4 md:grid-cols-4">
            <div className="admin-card">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Roles</p>
              <p className="text-3xl font-bold">{totalRoles}</p>
            </div>
            <div className="admin-card">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Permissions</p>
              <p className="text-3xl font-bold">{totalPermissions}</p>
            </div>
            <div className="admin-card">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Admins (total)</p>
              <p className="text-3xl font-bold">{totalAdmins}</p>
            </div>
            <div className="admin-card">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Admins (active)</p>
              <p className="text-3xl font-bold">{activeAdmins}</p>
            </div>
          </section>

          <section className="admin-card">
            <h2>Signed in as</h2>
            <p>
              <strong>{admin.displayName}</strong> · {admin.email}
            </p>
            <h3 className="mt-4">{labels.roles}</h3>
            <ul className="deck-list">
              {admin.roles.map((r) => (
                <li key={r.role.code}>
                  <code>{r.role.code}</code>
                </li>
              ))}
            </ul>
            <h3 className="mt-4">
              {labels.permissions} ({myPermissions.length})
            </h3>
            <ul className="flex flex-wrap gap-2">
              {myPermissions.map((p) => (
                <li key={p}>
                  <code className="text-xs px-2 py-0.5 rounded bg-muted">{p}</code>
                </li>
              ))}
            </ul>
          </section>

          <section className="admin-card">
            <h2>Role distribution</h2>
            {roles && roles.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left">
                    <th className="py-2">Role</th>
                    <th className="py-2">Permissions</th>
                    <th className="py-2">Admins</th>
                  </tr>
                </thead>
                <tbody>
                  {roles.map((r) => (
                    <tr key={r.code} className="border-t">
                      <td className="py-2">
                        <code>{r.code}</code>
                      </td>
                      <td className="py-2">{r.permissions?.length ?? 0}</td>
                      <td className="py-2">{r._count?.admins ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-muted-foreground">No roles loaded.</p>
            )}
          </section>

          <section className="admin-card">
            <h2>Recent role audit</h2>
            {audit && audit.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left">
                    <th className="py-2">Action</th>
                    <th className="py-2">Actor</th>
                    <th className="py-2">Target</th>
                    <th className="py-2">Role</th>
                    <th className="py-2">When</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.map((row) => (
                    <tr key={row.id} className="border-t">
                      <td className="py-2">
                        <code>{row.action}</code>
                      </td>
                      <td className="py-2">{row.actorEmail ?? "—"}</td>
                      <td className="py-2">{row.targetEmail ?? "—"}</td>
                      <td className="py-2">
                        <code>{row.roleCode ?? "—"}</code>
                      </td>
                      <td className="py-2">{new Date(row.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-muted-foreground">No recent role audit entries.</p>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
