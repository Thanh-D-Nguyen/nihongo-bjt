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
import { useEffect, useState } from "react";

import { adminApiFetch } from "@/lib/admin-api";

type Labels = Record<string, unknown>;
type CommonLabels = Record<string, string>;

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

export function IamClient({ common, labels }: { common?: CommonLabels; labels: Labels }) {
  const t = (k: string) => (typeof labels[k] === "string" ? labels[k] : common?.[k] ?? k) as string;

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
    <div className="space-y-4">
      <AdminPageHeader title={t("title")} description={t("subtitle")} />

      {error ? (
        <div role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          {t("error")}
        </div>
      ) : null}
      {!admin && !error ? (
        <div className="p-4 text-sm text-gray-500">{t("loading")}</div>
      ) : null}

      {admin ? (
        <>
          {/* KPI Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <a href="roles" className="admin-card block hover:ring-2 hover:ring-primary/30 transition-shadow">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("kpiRoles")}</p>
              <p className="text-3xl font-bold">{totalRoles}</p>
              <p className="text-xs text-muted-foreground">{t("manageRoles")}</p>
            </a>
            <a href="permissions" className="admin-card block hover:ring-2 hover:ring-primary/30 transition-shadow">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("kpiPermissions")}</p>
              <p className="text-3xl font-bold">{totalPermissions}</p>
              <p className="text-xs text-muted-foreground">{t("viewPermissions")}</p>
            </a>
            <a href="admins" className="admin-card block hover:ring-2 hover:ring-primary/30 transition-shadow">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("kpiAdminsTotal")}</p>
              <p className="text-3xl font-bold">{totalAdmins}</p>
              <p className="text-xs text-muted-foreground">{t("manageAdmins")}</p>
            </a>
            <a href="role-audit" className="admin-card block hover:ring-2 hover:ring-primary/30 transition-shadow">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("kpiActiveAdmins")}</p>
              <p className="text-3xl font-bold">{activeAdmins}</p>
              <p className="text-xs text-muted-foreground">{t("viewAudit")}</p>
            </a>
          </div>

          {/* Current session */}
          <AdminSection>
            <div className="p-4">
              <h2 className="text-sm font-semibold mb-2">{t("signedInAs")}</h2>
              <p className="text-sm">
                <strong>{admin.displayName}</strong> · <span className="text-gray-500">{admin.email}</span>
              </p>
              <div className="mt-3 flex flex-wrap gap-1">
                {admin.roles.map((r) => (
                  <AdminStatusBadge key={r.role.code} tone="neutral">{r.role.code}</AdminStatusBadge>
                ))}
              </div>
              <p className="mt-3 text-xs text-gray-500">
                {t("permissions")}: {myPermissions.length}
              </p>
              <div className="mt-1 flex flex-wrap gap-1">
                {myPermissions.slice(0, 20).map((p) => (
                  <code key={p} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-gray-600">{p}</code>
                ))}
                {myPermissions.length > 20 ? (
                  <span className="text-[10px] text-gray-400">+{myPermissions.length - 20}</span>
                ) : null}
              </div>
            </div>
          </AdminSection>

          {/* Role distribution */}
          <AdminSection>
            <div className="px-4 pt-3 pb-1">
              <h2 className="text-sm font-semibold">{t("roleDistribution")}</h2>
            </div>
            {roles && roles.length > 0 ? (
              <AdminDataTable>
                <AdminDataTableHead>
                  <AdminDataTableRow>
                    <AdminDataTableTh>{t("colRole")}</AdminDataTableTh>
                    <AdminDataTableTh>{t("colDescription")}</AdminDataTableTh>
                    <AdminDataTableTh>{t("colPermCount")}</AdminDataTableTh>
                    <AdminDataTableTh>{t("colAdminCount")}</AdminDataTableTh>
                  </AdminDataTableRow>
                </AdminDataTableHead>
                <AdminDataTableBody>
                  {roles.map((r) => (
                    <AdminDataTableRow key={r.code}>
                      <AdminDataTableTd>
                        <code className="text-xs font-semibold">{r.code}</code>
                      </AdminDataTableTd>
                      <AdminDataTableTd>
                        <span className="text-xs text-gray-600">{r.description ?? "—"}</span>
                      </AdminDataTableTd>
                      <AdminDataTableTd>{r.permissions?.length ?? 0}</AdminDataTableTd>
                      <AdminDataTableTd>{r._count?.admins ?? "—"}</AdminDataTableTd>
                    </AdminDataTableRow>
                  ))}
                </AdminDataTableBody>
              </AdminDataTable>
            ) : (
              <AdminEmptyState title={t("noRoles")} />
            )}
          </AdminSection>

          {/* Recent role audit */}
          <AdminSection>
            <div className="flex items-center justify-between px-4 pt-3 pb-1">
              <h2 className="text-sm font-semibold">{t("recentAudit")}</h2>
              <a href="role-audit" className="text-xs text-blue-600 hover:underline">{t("viewAll")}</a>
            </div>
            {audit && audit.length > 0 ? (
              <AdminDataTable>
                <AdminDataTableHead>
                  <AdminDataTableRow>
                    <AdminDataTableTh>{t("colAction")}</AdminDataTableTh>
                    <AdminDataTableTh>{t("colActorEmail")}</AdminDataTableTh>
                    <AdminDataTableTh>{t("colTargetEmail")}</AdminDataTableTh>
                    <AdminDataTableTh>{t("colRole")}</AdminDataTableTh>
                    <AdminDataTableTh>{t("colWhen")}</AdminDataTableTh>
                  </AdminDataTableRow>
                </AdminDataTableHead>
                <AdminDataTableBody>
                  {audit.map((row) => (
                    <AdminDataTableRow key={row.id}>
                      <AdminDataTableTd>
                        <AdminStatusBadge tone="neutral">{row.action}</AdminStatusBadge>
                      </AdminDataTableTd>
                      <AdminDataTableTd>
                        <span className="text-xs">{row.actorEmail ?? "—"}</span>
                      </AdminDataTableTd>
                      <AdminDataTableTd>
                        <span className="text-xs">{row.targetEmail ?? "—"}</span>
                      </AdminDataTableTd>
                      <AdminDataTableTd>
                        <code className="text-xs">{row.roleCode ?? "—"}</code>
                      </AdminDataTableTd>
                      <AdminDataTableTd>
                        <span className="whitespace-nowrap text-xs font-mono">
                          {new Date(row.createdAt).toLocaleString()}
                        </span>
                      </AdminDataTableTd>
                    </AdminDataTableRow>
                  ))}
                </AdminDataTableBody>
              </AdminDataTable>
            ) : (
              <AdminEmptyState title={t("noAudit")} />
            )}
          </AdminSection>
        </>
      ) : null}
    </div>
  );
}
