export type AdminModuleContractStatus = "implemented" | "partial" | "planned";

export type AdminModuleContract = {
  moduleId: string;
  status: AdminModuleContractStatus;
  notes: string;
  endpoints: string[];
  featureFlag?: string;
};

/**
 * Canonical admin contract manifest for parity with admin shells.
 * This manifest must be honest: implemented = callable backend contract exists,
 * partial = subset exists, planned = no production endpoint yet.
 */
export const ADMIN_MODULE_CONTRACTS: readonly AdminModuleContract[] = [
  {
    endpoints: [
      "GET /api/admin/users/kpis",
      "GET /api/admin/users",
      "GET /api/admin/users/:id",
      "GET /api/admin/users/:id/audit",
      "PATCH /api/admin/users/:id/status",
      "PATCH /api/admin/users/:id/plan",
      "POST /api/admin/users/:id/support-notes",
      "POST /api/admin/users/invite"
    ],
    moduleId: "u.360",
    notes: "User support console and per-user diagnostic detail are available through admin user endpoints.",
    status: "implemented"
  },
  {
    endpoints: [
      "GET /api/admin/operations/feature-flags",
      "PATCH /api/admin/operations/feature-flags/:key"
    ],
    moduleId: "op.ff",
    notes: "Feature flag management is live and audited via admin operations APIs.",
    status: "implemented"
  },
  {
    endpoints: [
      "GET /api/admin/operations/kill-switches",
      "PATCH /api/admin/operations/kill-switches/:key"
    ],
    moduleId: "op.kill",
    notes: "Kill-switch management is live and audited via admin operations APIs.",
    status: "implemented"
  },
  {
    endpoints: [
      "GET /api/admin/operations/dead-letter-queue",
      "PATCH /api/admin/operations/dead-letter-queue/:id"
    ],
    moduleId: "op.dl",
    notes: "Dead-letter queue listing and resolution are available.",
    status: "implemented"
  },
  {
    endpoints: [
      "GET /api/admin/operations/import-staging/errors"
    ],
    moduleId: "op.failed",
    notes: "Import staging error listing is available. Manifest-level ingestion workflow remains pending.",
    status: "partial"
  },
  {
    endpoints: [
      "PATCH /api/admin/operations/import-staging/errors/:id/dead-letter"
    ],
    moduleId: "op.manifests",
    notes: "Import error escalation is available; manifest management endpoints are not yet implemented.",
    status: "partial"
  },
  {
    endpoints: [
      "GET /api/legal/consent/status",
      "POST /api/legal/consent/accept"
    ],
    moduleId: "lg.consent",
    notes: "Learner legal consent endpoints are implemented; admin legal document management is pending.",
    status: "partial"
  },
  {
    endpoints: [],
    featureFlag: "admin.privacy.requests",
    moduleId: "u.privacy",
    notes: "Admin privacy-request triage endpoint is not yet implemented. Keep route in honest scaffold state.",
    status: "planned"
  },
  {
    endpoints: [],
    featureFlag: "admin.privacy.exportDelete",
    moduleId: "u.export",
    notes: "Admin export/deletion management endpoint is not yet implemented. Keep route in honest scaffold state.",
    status: "planned"
  },
  {
    endpoints: [],
    featureFlag: "admin.legal.docs",
    moduleId: "lg.doc",
    notes: "Admin legal document CMS endpoint is not yet implemented.",
    status: "planned"
  },
  {
    endpoints: [],
    featureFlag: "admin.legal.terms",
    moduleId: "lg.terms",
    notes: "Admin terms/privacy version management endpoint is not yet implemented.",
    status: "planned"
  },
  {
    endpoints: [],
    featureFlag: "admin.legal.cookies",
    moduleId: "lg.cookies",
    notes: "Admin cookie policy management endpoint is not yet implemented.",
    status: "planned"
  },
  {
    endpoints: [],
    featureFlag: "admin.legal.tokushoho",
    moduleId: "lg.tt",
    notes: "Admin Tokushoho legal surface endpoint is not yet implemented.",
    status: "planned"
  },
  {
    endpoints: [],
    featureFlag: "admin.legal.retention",
    moduleId: "lg.ret",
    notes: "Admin retention policy endpoint is not yet implemented.",
    status: "planned"
  }
];
