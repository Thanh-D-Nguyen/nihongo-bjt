# Monetization Admin Pages — Full Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete all 7 stub monetization admin pages with real CRUD UI backed by existing backend APIs.

**Architecture:** Split the monolithic `monetization-console-client.tsx` into per-tab client components. Each component is self-contained: loads its own data, handles CRUD via `adminApiFetch`, uses existing `@nihongo-bjt/ui` components (Dialog, AdminDataTable, AdminSearchInput, AdminStatusBadge, useAdminToast). The parent component remains as a thin shell that routes to the correct child based on `initialTab`.

**Tech Stack:** React client components, `adminApiFetch` for API calls, `@nihongo-bjt/ui` admin components (Dialog, AdminDataTable, AdminSearchInput, AdminStatusBadge, AdminFilterBar, useAdminToast), i18n via JSON props.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `apps/admin/app/[locale]/monetization/monetization-console-client.tsx` | Modify | Thin shell — header, tab bar, delegates to child components |
| `apps/admin/app/[locale]/monetization/_components/subscriptions-tab.tsx` | Create | Subscriptions list + search/filter + edit modal |
| `apps/admin/app/[locale]/monetization/_components/quotas-tab.tsx` | Create | Quota policies + plan links + user overrides CRUD |
| `apps/admin/app/[locale]/monetization/_components/entitlements-tab.tsx` | Create | Entitlements table + create + link/unlink |
| `apps/admin/app/[locale]/monetization/_components/billing-events-tab.tsx` | Create | Coupons table + create/edit + webhook events viewer |
| `apps/admin/app/[locale]/monetization/_components/refunds-tab.tsx` | Create | Subscription status management (cancel/refund flow) |
| `apps/admin/app/[locale]/monetization/_components/provider-config-tab.tsx` | Create | Analytics + ad placements table + toggle/edit |
| `apps/admin/app/[locale]/monetization/_components/webhook-dlq-tab.tsx` | Create | Webhook events filtered by failed/dead_lettered + raw payload viewer |
| `apps/admin/app/[locale]/monetization/_components/monetization-types.ts` | Create | Shared TypeScript types for all monetization API responses |
| `apps/admin/messages/vi.json` | Modify | Add i18n keys for new CRUD labels |
| `apps/admin/messages/ja.json` | Modify | Add i18n keys for new CRUD labels |

---

## Task 1: Shared Types & i18n Keys

**Files:**
- Create: `apps/admin/app/[locale]/monetization/_components/monetization-types.ts`
- Modify: `apps/admin/messages/vi.json`
- Modify: `apps/admin/messages/ja.json`

- [ ] **Step 1: Create shared types file**

```typescript
// apps/admin/app/[locale]/monetization/_components/monetization-types.ts

export type Subscription = {
  id: string;
  userId: string;
  planId: string;
  status: string;
  provider: string;
  providerRef: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  trialEnd: string | null;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
  updatedAt: string;
  user: { id: string; email: string; displayName: string };
  plan: { slug: string; nameKey: string };
};

export type EntitlementDef = {
  id: string;
  key: string;
  description: string | null;
  category: string | null;
  createdAt: string;
  _count: { plans: number };
};

export type QuotaPolicy = {
  id: string;
  key: string;
  windowCode: string;
  description: string | null;
  warnThresholdPercent: number | null;
  createdAt: string;
};

export type PlanQuota = {
  id: string;
  planId: string;
  quotaPolicyId: string;
  limitValue: number;
  plan: { id: string; slug: string };
  quotaPolicy: QuotaPolicy;
};

export type QuotaOverride = {
  id: string;
  userId: string;
  quotaKey: string;
  limitValue: number;
  reason: string;
  expiresAt: string | null;
  createdByActorId: string | null;
  createdAt: string;
  user: { id: string; email: string; displayName: string };
};

export type Coupon = {
  id: string;
  code: string;
  discountType: string;
  discountValue: number;
  allowedPlanSlugs: string[];
  maxRedemptions: number | null;
  redemptionCount: number;
  status: string;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WebhookEvent = {
  id: string;
  provider: string;
  eventType: string;
  idempotencyKey: string;
  signatureVerified: boolean;
  status: string;
  meta: unknown;
  retryCount: number;
  lastError?: string;
  receivedAt: string;
  processedAt: string | null;
};

export type AdPlacement = {
  id: string;
  code: string;
  labelKey: string | null;
  config: unknown;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  impressions: number;
  clicks: number;
  ctr: number;
};

export type AuditEntry = {
  id: string;
  action: string;
  actorId?: string;
  userId?: string;
  actorKind?: string;
  targetId?: string;
  targetType?: string;
  payload?: unknown;
  at: string;
  source: string;
};

export type AnalyticsData = {
  billingProviderConnected: boolean;
  windowDays: number;
  eventsByName: Array<{ name: string; count: number }>;
  revenuePlaceholder: null;
};

/** Common prop shape passed from parent to every tab component */
export type TabCommonProps = {
  common: { error: string; loading: string; records: string; status: string; updatedAt: string };
  canRead: boolean;
  canManage: boolean;
};
```

- [ ] **Step 2: Add i18n keys for all new CRUD labels**

In `apps/admin/messages/vi.json`, inside `monetizationConsole`, add these keys alongside existing ones:

```jsonc
// Add to monetizationConsole object:
"subSearch": "Tìm email hoặc tên…",
"subStatusFilter": "Lọc trạng thái",
"subAllStatuses": "Tất cả",
"subEdit": "Sửa subscription",
"subCancel": "Hủy",
"subPlan": "Gói",
"subUser": "Người dùng",
"subProvider": "Provider",
"subPeriod": "Chu kỳ hiện tại",
"subTrialEnd": "Hết trial",
"subCancelAtEnd": "Hủy cuối kỳ",
"subUpdated": "Cập nhật",

"entCreate": "Tạo entitlement",
"entKey": "Key",
"entCategory": "Danh mục",
"entDesc": "Mô tả",
"entLinkedPlans": "Gói liên kết",
"entLinkPlan": "Gắn vào gói",
"entUnlink": "Gỡ",
"entSelectPlan": "Chọn gói…",

"quotaCreatePolicy": "Tạo quota policy",
"quotaKey": "Key",
"quotaWindow": "Window code",
"quotaWarnPct": "Ngưỡng cảnh báo (%)",
"quotaLinkPlan": "Gắn vào gói",
"quotaLimit": "Giới hạn",
"quotaOverrideCreate": "Tạo override",
"quotaOverrideUser": "User ID",
"quotaOverrideExpires": "Hết hạn",
"quotaOverrideDelete": "Xóa override",

"couponCreate": "Tạo coupon",
"couponCode": "Mã",
"couponType": "Loại giảm giá",
"couponValue": "Giá trị",
"couponPlans": "Gói áp dụng",
"couponMaxRedeem": "Số lượt tối đa",
"couponRedeemed": "Đã dùng",
"couponStarts": "Bắt đầu",
"couponEnds": "Kết thúc",

"whProvider": "Provider",
"whEventType": "Loại sự kiện",
"whStatus": "Trạng thái",
"whRetries": "Thử lại",
"whReceived": "Nhận lúc",
"whProcessed": "Xử lý lúc",
"whError": "Lỗi cuối",
"whViewRaw": "Xem payload",
"whFilterStatus": "Lọc trạng thái",

"adCode": "Placement code",
"adActive": "Bật",
"adImpressions": "Lượt hiện",
"adClicks": "Clicks",
"adCtr": "CTR",
"adToggle": "Bật/tắt",
"adEditConfig": "Sửa config",

"analyticsWindow": "Cửa sổ phân tích",
"analyticsEvents": "Sự kiện theo tên",
"analyticsNoEvents": "Chưa có sự kiện analytics.",

"refundDesc": "Quản lý hủy/hoàn tiền subscription. Chọn subscription → đổi trạng thái hoặc hủy cuối kỳ.",
"refundAction": "Hủy / hoàn tiền",

"confirmDelete": "Xác nhận xóa?",
"create": "Tạo mới",
"edit": "Sửa",
"delete": "Xóa",
"close": "Đóng",
"actions": "Thao tác",
"page": "Trang",
"of": "trên",
"noResults": "Không có kết quả.",
"pagination": "Phân trang"
```

Add equivalent Japanese translations in `ja.json`.

- [ ] **Step 3: Commit**

```bash
git add apps/admin/app/[locale]/monetization/_components/monetization-types.ts apps/admin/messages/vi.json apps/admin/messages/ja.json
git commit -m "feat(admin): add monetization shared types and i18n keys"
```

---

## Task 2: Subscriptions Tab (Full CRUD)

**Files:**
- Create: `apps/admin/app/[locale]/monetization/_components/subscriptions-tab.tsx`
- Modify: `apps/admin/app/[locale]/monetization/monetization-console-client.tsx` (wire up)

**Backend endpoints used:**
- `GET /api/admin/monetization/subscriptions?limit=&offset=&q=&status=`
- `PATCH /api/admin/monetization/subscriptions/:id`
- `GET /api/admin/monetization/plans` (for plan dropdown in edit)

- [ ] **Step 1: Create subscriptions-tab.tsx**

Component features:
- **Search**: `AdminSearchInput` — debounced `q` param searches email/displayName
- **Filter**: Status dropdown — all | active | trialing | past_due | canceled | expired | comped
- **Table columns**: user (email + name), plan slug, status (AdminStatusBadge), provider, period, trial end, cancelAtPeriodEnd, updatedAt, actions
- **Pagination**: offset-based with limit=20, "prev/next" buttons, total count display
- **Edit modal**: `Dialog` with fields: status (select), planId (select from plan list), trialEnd (datetime-local), currentPeriodEnd (datetime-local), cancelAtPeriodEnd (checkbox), reason (required textarea)
- **Save**: `PATCH /api/admin/monetization/subscriptions/:id` → reload list + toast

```typescript
// apps/admin/app/[locale]/monetization/_components/subscriptions-tab.tsx
"use client";

import {
  AdminDataTable, AdminDataTableBody, AdminDataTableHead, AdminDataTableRow,
  AdminDataTableTd, AdminDataTableTh, AdminEmptyState, AdminSearchInput,
  AdminSection, AdminStatusBadge, Dialog, cn,
} from "@nihongo-bjt/ui";
import { useCallback, useEffect, useState } from "react";
import { adminApiFetch } from "@/lib/admin-api";
import type { Subscription, TabCommonProps } from "./monetization-types";

type Labels = Record<string, string | Record<string, string>>;
type Props = TabCommonProps & { labels: Labels };

const SUB_STATUSES = ["active", "trialing", "past_due", "canceled", "expired", "comped"] as const;
const PAGE_SIZE = 20;

function subTone(s: string): "danger" | "good" | "neutral" | "warning" {
  if (s === "active" || s === "trialing" || s === "comped") return "good";
  if (s === "past_due") return "danger";
  if (s === "canceled" || s === "expired") return "neutral";
  return "warning";
}

export function SubscriptionsTab({ common, canRead, canManage, labels }: Props) {
  const [items, setItems] = useState<Subscription[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [offset, setOffset] = useState(0);
  const [err, setErr] = useState<string | null>(null);

  // Edit state
  const [editItem, setEditItem] = useState<Subscription | null>(null);
  const [editForm, setEditForm] = useState<Record<string, unknown>>({});
  const [editReason, setEditReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [plans, setPlans] = useState<Array<{ id: string; slug: string; nameKey: string }>>([]);

  const load = useCallback(async () => {
    if (!canRead) return;
    setLoading(true);
    setErr(null);
    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
      if (q.trim()) params.set("q", q.trim());
      if (statusFilter) params.set("status", statusFilter);
      const res = await adminApiFetch(`/api/admin/monetization/subscriptions?${params}`);
      if (res.ok) {
        const data = (await res.json()) as { items: Subscription[]; total: number };
        setItems(data.items);
        setTotal(data.total);
      } else {
        setErr(common.error);
      }
    } catch { setErr(common.error); }
    setLoading(false);
  }, [canRead, offset, q, statusFilter, common.error]);

  useEffect(() => { void load(); }, [load]);

  // Load plans for edit dropdown
  useEffect(() => {
    if (!canManage) return;
    void (async () => {
      const r = await adminApiFetch("/api/admin/monetization/plans");
      if (r.ok) setPlans((await r.json()) as Array<{ id: string; slug: string; nameKey: string }>);
    })();
  }, [canManage]);

  const startEdit = (item: Subscription) => {
    setEditItem(item);
    setEditForm({
      status: item.status,
      planId: item.planId,
      trialEnd: item.trialEnd?.slice(0, 16) ?? "",
      currentPeriodEnd: item.currentPeriodEnd?.slice(0, 16) ?? "",
      cancelAtPeriodEnd: item.cancelAtPeriodEnd,
    });
    setEditReason("");
  };

  const saveEdit = async () => {
    if (!editItem || editReason.trim().length < 3) return;
    setSaving(true);
    const body: Record<string, unknown> = { reason: editReason.trim() };
    if (editForm.status !== editItem.status) body.status = editForm.status;
    if (editForm.planId !== editItem.planId) body.planId = editForm.planId;
    if (editForm.cancelAtPeriodEnd !== editItem.cancelAtPeriodEnd) body.cancelAtPeriodEnd = editForm.cancelAtPeriodEnd;
    if (editForm.trialEnd) body.trialEnd = new Date(editForm.trialEnd as string).toISOString();
    if (editForm.currentPeriodEnd) body.currentPeriodEnd = new Date(editForm.currentPeriodEnd as string).toISOString();

    const res = await adminApiFetch(`/api/admin/monetization/subscriptions/${editItem.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (res.ok) {
      setEditItem(null);
      void load();
    } else {
      setErr(common.error);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  if (!canRead) return null;

  return (
    <div className="space-y-4">
      {/* Search + Filter */}
      <div className="flex flex-wrap items-center gap-3">
        <AdminSearchInput
          className="w-64"
          placeholder={labels.subSearch as string}
          value={q}
          onChange={(v: string) => { setQ(v); setOffset(0); }}
        />
        <select
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setOffset(0); }}
        >
          <option value="">{labels.subAllStatuses as string}</option>
          {SUB_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {err && <p className="text-sm text-rose-600">{err}</p>}

      <AdminSection title={`${labels.tab?.subscriptions ?? "Subscriptions"} (${total})`}>
        {loading && <p className="text-sm text-ink-muted">{common.loading}…</p>}
        {!loading && items.length === 0 && (
          <AdminEmptyState title={labels.tab?.subscriptions as string ?? "Subscriptions"}>
            {labels.noResults as string}
          </AdminEmptyState>
        )}
        {!loading && items.length > 0 && (
          <>
            <div className="max-w-full overflow-x-auto">
              <AdminDataTable>
                <AdminDataTableHead>
                  <AdminDataTableRow>
                    {[labels.subUser, labels.subPlan, common.status, labels.subProvider,
                      labels.subPeriod, labels.subTrialEnd, labels.subCancelAtEnd,
                      common.updatedAt, labels.actions].map((h, i) => (
                      <AdminDataTableTh key={i} className="whitespace-nowrap">{h as string}</AdminDataTableTh>
                    ))}
                  </AdminDataTableRow>
                </AdminDataTableHead>
                <AdminDataTableBody>
                  {items.map((s) => (
                    <AdminDataTableRow key={s.id}>
                      <AdminDataTableTd className="text-xs">
                        <div>{s.user.displayName}</div>
                        <div className="text-ink-muted">{s.user.email}</div>
                      </AdminDataTableTd>
                      <AdminDataTableTd className="font-mono text-xs">{s.plan.slug}</AdminDataTableTd>
                      <AdminDataTableTd>
                        <AdminStatusBadge tone={subTone(s.status)}>{s.status}</AdminStatusBadge>
                      </AdminDataTableTd>
                      <AdminDataTableTd className="text-xs">{s.provider}</AdminDataTableTd>
                      <AdminDataTableTd className="text-xs">
                        {s.currentPeriodStart ? new Date(s.currentPeriodStart).toLocaleDateString() : "—"}
                        {" → "}
                        {s.currentPeriodEnd ? new Date(s.currentPeriodEnd).toLocaleDateString() : "—"}
                      </AdminDataTableTd>
                      <AdminDataTableTd className="text-xs">
                        {s.trialEnd ? new Date(s.trialEnd).toLocaleDateString() : "—"}
                      </AdminDataTableTd>
                      <AdminDataTableTd className="text-xs">{s.cancelAtPeriodEnd ? "✓" : "—"}</AdminDataTableTd>
                      <AdminDataTableTd className="text-xs">{new Date(s.updatedAt).toLocaleString()}</AdminDataTableTd>
                      <AdminDataTableTd>
                        {canManage && (
                          <button className="text-xs text-indigo-600" onClick={() => startEdit(s)} type="button">
                            {labels.edit as string}
                          </button>
                        )}
                      </AdminDataTableTd>
                    </AdminDataTableRow>
                  ))}
                </AdminDataTableBody>
              </AdminDataTable>
            </div>
            {/* Pagination */}
            <div className="mt-3 flex items-center justify-between text-xs text-ink-muted">
              <span>{labels.page as string} {currentPage} {labels.of as string} {totalPages}</span>
              <div className="flex gap-2">
                <button className="rounded border px-2 py-1 disabled:opacity-40" disabled={offset === 0}
                  onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))} type="button">←</button>
                <button className="rounded border px-2 py-1 disabled:opacity-40" disabled={currentPage >= totalPages}
                  onClick={() => setOffset(offset + PAGE_SIZE)} type="button">→</button>
              </div>
            </div>
          </>
        )}
      </AdminSection>

      {/* Edit Dialog */}
      {editItem && (
        <Dialog open onClose={() => setEditItem(null)} title={labels.subEdit as string}>
          <div className="space-y-3">
            <p className="text-xs text-ink-muted">{editItem.user.displayName} ({editItem.user.email})</p>
            <label className="block text-xs">
              {common.status}
              <select className="mt-1 w-full rounded-lg border px-2 py-1.5 text-sm"
                value={editForm.status as string}
                onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}>
                {SUB_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label className="block text-xs">
              {labels.subPlan as string}
              <select className="mt-1 w-full rounded-lg border px-2 py-1.5 text-sm"
                value={editForm.planId as string}
                onChange={(e) => setEditForm((f) => ({ ...f, planId: e.target.value }))}>
                {plans.map((p) => <option key={p.id} value={p.id}>{p.slug}</option>)}
              </select>
            </label>
            <label className="block text-xs">
              {labels.subTrialEnd as string}
              <input type="datetime-local" className="mt-1 w-full rounded-lg border px-2 py-1.5 text-sm"
                value={editForm.trialEnd as string}
                onChange={(e) => setEditForm((f) => ({ ...f, trialEnd: e.target.value }))} />
            </label>
            <label className="block text-xs">
              {labels.subPeriod as string}
              <input type="datetime-local" className="mt-1 w-full rounded-lg border px-2 py-1.5 text-sm"
                value={editForm.currentPeriodEnd as string}
                onChange={(e) => setEditForm((f) => ({ ...f, currentPeriodEnd: e.target.value }))} />
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={editForm.cancelAtPeriodEnd as boolean}
                onChange={(e) => setEditForm((f) => ({ ...f, cancelAtPeriodEnd: e.target.checked }))} />
              {labels.subCancelAtEnd as string}
            </label>
            <label className="block text-xs text-rose-700">
              {labels.reasonLabel as string} *
              <input className="mt-1 w-full rounded-lg border px-2 py-1.5 text-sm"
                value={editReason} onChange={(e) => setEditReason(e.target.value)} />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button className="rounded-lg border px-3 py-1.5 text-sm" onClick={() => setEditItem(null)} type="button">
                {labels.cancel as string}
              </button>
              <button className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
                disabled={saving || editReason.trim().length < 3} onClick={() => void saveEdit()} type="button">
                {labels.save as string}
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire into parent component**

In `monetization-console-client.tsx`:
1. Import `SubscriptionsTab` from `./_components/subscriptions-tab`
2. Replace the inline `{tab === "subscriptions" && ...}` block with:
```tsx
{tab === "subscriptions" && (
  <SubscriptionsTab common={common} canRead={canRead} canManage={canManage} labels={labels as unknown as Record<string, string | Record<string, string>>} />
)}
```
3. Remove the `subs` / `setSubs` state from parent (no longer used there).

- [ ] **Step 3: Verify subscriptions page renders correctly**

Run: `pnpm dev:admin`
Navigate to: `http://localhost:3001/vi/monetization/subscriptions`
Expected: Table with search, filter, pagination; edit modal works.

- [ ] **Step 4: Commit**

```bash
git add apps/admin/app/[locale]/monetization/_components/subscriptions-tab.tsx apps/admin/app/[locale]/monetization/monetization-console-client.tsx
git commit -m "feat(admin): implement subscriptions tab with search/filter/edit"
```

---

## Task 3: Entitlements Tab (CRUD + Link/Unlink)

**Files:**
- Create: `apps/admin/app/[locale]/monetization/_components/entitlements-tab.tsx`
- Modify: `apps/admin/app/[locale]/monetization/monetization-console-client.tsx` (wire up)

**Backend endpoints used:**
- `GET /api/admin/monetization/entitlements`
- `POST /api/admin/monetization/entitlements`
- `GET /api/admin/monetization/plans` (for link dropdown)
- `POST /api/admin/monetization/plans/:planId/entitlements` (link)
- `DELETE /api/admin/monetization/plans/:planId/entitlements/:entitlementId?reason=` (unlink)

- [ ] **Step 1: Create entitlements-tab.tsx**

Component features:
- **Table columns**: key (mono), category (badge), plans count, description, actions
- **Create button** → Dialog: key input, category select (flashcard|bjt|reading_assist|analytics|media|ai|battle|ads|admin), description textarea, reason
- **Row expand/detail**: Show linked plans with unlink button
- **Link action**: Select a plan from dropdown → POST link → reload
- **Unlink action**: Confirm → DELETE with reason query param → reload

```typescript
// apps/admin/app/[locale]/monetization/_components/entitlements-tab.tsx
"use client";

import {
  AdminDataTable, AdminDataTableBody, AdminDataTableHead, AdminDataTableRow,
  AdminDataTableTd, AdminDataTableTh, AdminEmptyState, AdminSection,
  AdminStatusBadge, Dialog, cn,
} from "@nihongo-bjt/ui";
import { useCallback, useEffect, useState } from "react";
import { adminApiFetch } from "@/lib/admin-api";
import type { EntitlementDef, TabCommonProps } from "./monetization-types";

type Labels = Record<string, string | Record<string, string>>;
type Props = TabCommonProps & { labels: Labels };

const CATEGORIES = ["flashcard", "bjt", "reading_assist", "analytics", "media", "ai", "battle", "ads", "admin"] as const;

type PlanSummary = { id: string; slug: string; nameKey: string };

// Extended type with linked plans detail
type EntitlementWithPlans = EntitlementDef & {
  plans?: Array<{ planId: string; entitlementId: string; plan?: { id: string; slug: string; nameKey: string } }>;
};

export function EntitlementsTab({ common, canRead, canManage, labels }: Props) {
  const [items, setItems] = useState<EntitlementWithPlans[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [plans, setPlans] = useState<PlanSummary[]>([]);

  // Create state
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ key: "", category: "", description: "", reason: "" });
  const [saving, setSaving] = useState(false);

  // Expanded row for link/unlink
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [linkPlanId, setLinkPlanId] = useState("");
  const [linkReason, setLinkReason] = useState("");

  const load = useCallback(async () => {
    if (!canRead) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await adminApiFetch("/api/admin/monetization/entitlements");
      if (res.ok) setItems((await res.json()) as EntitlementWithPlans[]);
      else setErr(common.error);
    } catch { setErr(common.error); }
    setLoading(false);
  }, [canRead, common.error]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!canManage) return;
    void (async () => {
      const r = await adminApiFetch("/api/admin/monetization/plans");
      if (r.ok) setPlans((await r.json()) as PlanSummary[]);
    })();
  }, [canManage]);

  const handleCreate = async () => {
    if (!createForm.key.trim() || createForm.reason.trim().length < 3) return;
    setSaving(true);
    const body: Record<string, unknown> = {
      key: createForm.key.trim(),
      reason: createForm.reason.trim(),
    };
    if (createForm.category) body.category = createForm.category;
    if (createForm.description.trim()) body.description = createForm.description.trim();

    const res = await adminApiFetch("/api/admin/monetization/entitlements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (res.ok) {
      setShowCreate(false);
      setCreateForm({ key: "", category: "", description: "", reason: "" });
      void load();
    } else { setErr(common.error); }
  };

  const handleLink = async (entitlementId: string) => {
    if (!linkPlanId || linkReason.trim().length < 3) return;
    const res = await adminApiFetch(`/api/admin/monetization/plans/${linkPlanId}/entitlements`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entitlementId, reason: linkReason.trim() }),
    });
    if (res.ok) {
      setLinkPlanId("");
      setLinkReason("");
      void load();
    } else { setErr(common.error); }
  };

  const handleUnlink = async (planId: string, entitlementId: string) => {
    const reason = prompt(labels.reasonLabel as string);
    if (!reason || reason.trim().length < 3) return;
    const res = await adminApiFetch(
      `/api/admin/monetization/plans/${planId}/entitlements/${entitlementId}?reason=${encodeURIComponent(reason.trim())}`,
      { method: "DELETE" },
    );
    if (res.ok) void load();
    else setErr(common.error);
  };

  if (!canRead) return null;

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <button className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500"
            onClick={() => setShowCreate(true)} type="button">
            {labels.entCreate as string}
          </button>
        </div>
      )}

      {err && <p className="text-sm text-rose-600">{err}</p>}

      <AdminSection title={labels.tab?.entitlements as string ?? "Entitlements"}>
        {loading && <p className="text-sm text-ink-muted">{common.loading}…</p>}
        {!loading && items.length === 0 && (
          <AdminEmptyState title={labels.tab?.entitlements as string ?? "Entitlements"}>{labels.empty as string}</AdminEmptyState>
        )}
        {!loading && items.length > 0 && (
          <div className="max-w-full overflow-x-auto">
            <AdminDataTable>
              <AdminDataTableHead>
                <AdminDataTableRow>
                  {[labels.entKey, labels.entCategory, labels.entLinkedPlans, labels.entDesc, labels.actions].map((h, i) => (
                    <AdminDataTableTh key={i} className="whitespace-nowrap">{h as string}</AdminDataTableTh>
                  ))}
                </AdminDataTableRow>
              </AdminDataTableHead>
              <AdminDataTableBody>
                {items.map((e) => (
                  <>
                    <AdminDataTableRow key={e.key} className={cn(expandedKey === e.key && "bg-indigo-50/30")}>
                      <AdminDataTableTd className="font-mono text-xs">{e.key}</AdminDataTableTd>
                      <AdminDataTableTd className="text-xs">
                        {e.category ? <AdminStatusBadge tone="neutral">{e.category}</AdminStatusBadge> : "—"}
                      </AdminDataTableTd>
                      <AdminDataTableTd>{e._count.plans}</AdminDataTableTd>
                      <AdminDataTableTd className="max-w-[200px] truncate text-xs" muted>{e.description ?? "—"}</AdminDataTableTd>
                      <AdminDataTableTd>
                        <button className="text-xs text-indigo-600" type="button"
                          onClick={() => setExpandedKey(expandedKey === e.key ? null : e.key)}>
                          {expandedKey === e.key ? "▲" : "▼"} {labels.entLinkedPlans as string}
                        </button>
                      </AdminDataTableTd>
                    </AdminDataTableRow>
                    {expandedKey === e.key && (
                      <AdminDataTableRow key={`${e.key}-detail`}>
                        <AdminDataTableTd colSpan={5} className="bg-slate-50/50 p-3">
                          {/* Linked plans */}
                          <div className="space-y-2">
                            {e.plans && e.plans.length > 0 ? e.plans.map((lp) => (
                              <div key={lp.planId} className="flex items-center gap-2 text-xs">
                                <span className="font-mono">{lp.plan?.slug ?? lp.planId}</span>
                                {canManage && (
                                  <button className="text-rose-600" type="button"
                                    onClick={() => void handleUnlink(lp.planId, e.id)}>
                                    {labels.entUnlink as string}
                                  </button>
                                )}
                              </div>
                            )) : <p className="text-xs text-ink-muted">{labels.noResults as string}</p>}
                            {/* Link new */}
                            {canManage && (
                              <div className="mt-2 flex items-end gap-2">
                                <select className="rounded border px-2 py-1 text-xs" value={linkPlanId}
                                  onChange={(ev) => setLinkPlanId(ev.target.value)}>
                                  <option value="">{labels.entSelectPlan as string}</option>
                                  {plans.map((p) => <option key={p.id} value={p.id}>{p.slug}</option>)}
                                </select>
                                <input className="rounded border px-2 py-1 text-xs" placeholder={labels.reasonLabel as string}
                                  value={linkReason} onChange={(ev) => setLinkReason(ev.target.value)} />
                                <button className="rounded bg-indigo-600 px-2 py-1 text-xs text-white disabled:opacity-40"
                                  disabled={!linkPlanId || linkReason.trim().length < 3} type="button"
                                  onClick={() => void handleLink(e.id)}>
                                  {labels.entLinkPlan as string}
                                </button>
                              </div>
                            )}
                          </div>
                        </AdminDataTableTd>
                      </AdminDataTableRow>
                    )}
                  </>
                ))}
              </AdminDataTableBody>
            </AdminDataTable>
          </div>
        )}
      </AdminSection>

      {/* Create Dialog */}
      {showCreate && (
        <Dialog open onClose={() => setShowCreate(false)} title={labels.entCreate as string}>
          <div className="space-y-3">
            <label className="block text-xs">
              {labels.entKey as string} *
              <input className="mt-1 w-full rounded-lg border px-2 py-1.5 text-sm"
                value={createForm.key} onChange={(e) => setCreateForm((f) => ({ ...f, key: e.target.value }))} />
            </label>
            <label className="block text-xs">
              {labels.entCategory as string}
              <select className="mt-1 w-full rounded-lg border px-2 py-1.5 text-sm"
                value={createForm.category} onChange={(e) => setCreateForm((f) => ({ ...f, category: e.target.value }))}>
                <option value="">—</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="block text-xs">
              {labels.entDesc as string}
              <textarea className="mt-1 w-full rounded-lg border px-2 py-1.5 text-sm"
                value={createForm.description} onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))} />
            </label>
            <label className="block text-xs text-rose-700">
              {labels.reasonLabel as string} *
              <input className="mt-1 w-full rounded-lg border px-2 py-1.5 text-sm"
                value={createForm.reason} onChange={(e) => setCreateForm((f) => ({ ...f, reason: e.target.value }))} />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button className="rounded-lg border px-3 py-1.5 text-sm" onClick={() => setShowCreate(false)} type="button">
                {labels.cancel as string}
              </button>
              <button className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
                disabled={saving || !createForm.key.trim() || createForm.reason.trim().length < 3}
                onClick={() => void handleCreate()} type="button">
                {labels.save as string}
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire into parent and remove old inline entitlements block**

Replace the `{tab === "entitlements" && ...}` block in parent with:
```tsx
{tab === "entitlements" && (
  <EntitlementsTab common={common} canRead={canRead} canManage={canManage} labels={labels as unknown as Record<string, string | Record<string, string>>} />
)}
```
Remove `entRows` / `setEntRows` state from parent.

- [ ] **Step 3: Verify and commit**

```bash
git add apps/admin/app/[locale]/monetization/_components/entitlements-tab.tsx apps/admin/app/[locale]/monetization/monetization-console-client.tsx
git commit -m "feat(admin): implement entitlements tab with create and link/unlink"
```

---

## Task 4: Quotas Tab (Policies + Plan Links + Overrides)

**Files:**
- Create: `apps/admin/app/[locale]/monetization/_components/quotas-tab.tsx`
- Modify: `apps/admin/app/[locale]/monetization/monetization-console-client.tsx` (wire up)

**Backend endpoints used:**
- `GET /api/admin/monetization/quotas` → `{ policies, planQuotas }`
- `POST /api/admin/monetization/quotas/policies`
- `PATCH /api/admin/monetization/quotas/policies/:id`
- `POST /api/admin/monetization/quotas/plan-links`
- `GET /api/admin/monetization/quota-overrides`
- `POST /api/admin/monetization/quota-overrides`
- `DELETE /api/admin/monetization/quota-overrides/:id?reason=`
- `GET /api/admin/monetization/plans` (for dropdowns)

- [ ] **Step 1: Create quotas-tab.tsx**

Component features:
- **Section 1: Quota Policies table** — key, windowCode, warnThreshold%, description, actions (edit)
- **Create policy button** → Dialog: key, windowCode, warnThresholdPercent, description, reason
- **Edit policy** → Dialog: same fields (key is read-only)
- **Section 2: Plan-Quota Links table** — plan slug, quota key, limitValue
- **Link quota to plan button** → Dialog: planId select, quotaPolicyId select, limitValue number, reason
- **Section 3: User Overrides table** — user email, quotaKey, limitValue, reason, expiresAt, createdAt, delete
- **Create override button** → Dialog: userId, quotaKey, limitValue, expiresAt, reason

Follow same patterns as Tasks 2-3 (separate load functions, Dialog modals, adminApiFetch).

- [ ] **Step 2: Wire into parent and remove old inline quotas block**

Replace the `{tab === "quotas" && ...}` block. Remove `quotaData`/`setQuotaData`/`qOverrides`/`setQOverrides` from parent.

- [ ] **Step 3: Verify and commit**

```bash
git add apps/admin/app/[locale]/monetization/_components/quotas-tab.tsx apps/admin/app/[locale]/monetization/monetization-console-client.tsx
git commit -m "feat(admin): implement quotas tab with policies, plan links, overrides CRUD"
```

---

## Task 5: Billing Events Tab (Coupons + Webhook Events)

**Files:**
- Create: `apps/admin/app/[locale]/monetization/_components/billing-events-tab.tsx`
- Modify: `apps/admin/app/[locale]/monetization/monetization-console-client.tsx` (wire up)

**Backend endpoints used:**
- `GET /api/admin/monetization/coupons`
- `POST /api/admin/monetization/coupons`
- `PATCH /api/admin/monetization/coupons/:id`
- `GET /api/admin/billing/webhook?provider=&status=&take=`

- [ ] **Step 1: Create billing-events-tab.tsx**

Component features:
- **Two sub-sections**: "Coupons" and "Webhook Events" separated visually
- **Coupons section**:
  - Table: code (mono), discountType, discountValue, allowedPlanSlugs (tags), maxRedemptions, redemptionCount, status (badge), dates, actions
  - Create coupon → Dialog: code, discountType select, discountValue, allowedPlanSlugs (comma-separated), maxRedemptions, startsAt, endsAt, status, reason
  - Edit coupon → Dialog: same fields (code read-only)
- **Webhook Events section**:
  - Table: provider, eventType, status (badge), signatureVerified, retryCount, receivedAt, processedAt, lastError
  - Filter: status dropdown (all|pending|processing|processed|failed|dead_lettered)
  - Read-only — no mutations needed

- [ ] **Step 2: Wire into parent, remove old inline billing-events block and `coupons`/`setCoupons` state**

- [ ] **Step 3: Verify and commit**

```bash
git add apps/admin/app/[locale]/monetization/_components/billing-events-tab.tsx apps/admin/app/[locale]/monetization/monetization-console-client.tsx
git commit -m "feat(admin): implement billing events tab with coupons CRUD and webhook viewer"
```

---

## Task 6: Webhook DLQ Tab (Failed Webhooks + Raw Payload)

**Files:**
- Create: `apps/admin/app/[locale]/monetization/_components/webhook-dlq-tab.tsx`
- Modify: `apps/admin/app/[locale]/monetization/monetization-console-client.tsx` (wire up)

**Backend endpoints used:**
- `GET /api/admin/billing/webhook?status=dead_lettered&status=failed`
- `GET /api/admin/billing/webhook/:id/raw`

- [ ] **Step 1: Create webhook-dlq-tab.tsx**

Component features:
- Auto-filters to `status=failed` and `status=dead_lettered` webhooks
- Table: provider, eventType, idempotencyKey (mono, truncated), status (danger/warning badge), retryCount, lastError, receivedAt
- **View raw payload**: Click row → Dialog shows `GET /api/admin/billing/webhook/:id/raw` response as pretty-printed JSON
- Status filter: failed | dead_lettered | both

- [ ] **Step 2: Wire into parent, remove old inline webhook-dlq block and `audit`/`setAudit` state**

- [ ] **Step 3: Verify and commit**

```bash
git add apps/admin/app/[locale]/monetization/_components/webhook-dlq-tab.tsx apps/admin/app/[locale]/monetization/monetization-console-client.tsx
git commit -m "feat(admin): implement webhook DLQ tab with failed events and raw payload viewer"
```

---

## Task 7: Provider Config Tab (Analytics + Ad Placements)

**Files:**
- Create: `apps/admin/app/[locale]/monetization/_components/provider-config-tab.tsx`
- Modify: `apps/admin/app/[locale]/monetization/monetization-console-client.tsx` (wire up)

**Backend endpoints used:**
- `GET /api/admin/monetization/analytics`
- `GET /api/admin/monetization/ads/placements`
- `PATCH /api/admin/monetization/ads/placements/:id`

- [ ] **Step 1: Create provider-config-tab.tsx**

Component features:
- **Section 1: Provider Status**
  - KPI card: billingProviderConnected (green/red badge)
  - Analytics window: N days
  - Events by name table: name, count
- **Section 2: Ad Placements**
  - Table: code (mono), labelKey, active (toggle switch), impressions, clicks, CTR%, updatedAt, actions
  - Toggle active: PATCH with `{ active: !current, reason }` — prompt for reason
  - Edit config: Dialog → JSON textarea + reason

- [ ] **Step 2: Wire into parent, remove old inline provider-config block and `analytics`/`setAnalytics` state**

- [ ] **Step 3: Verify and commit**

```bash
git add apps/admin/app/[locale]/monetization/_components/provider-config-tab.tsx apps/admin/app/[locale]/monetization/monetization-console-client.tsx
git commit -m "feat(admin): implement provider config tab with analytics and ad placements"
```

---

## Task 8: Refunds Tab (Subscription Cancel/Refund)

**Files:**
- Create: `apps/admin/app/[locale]/monetization/_components/refunds-tab.tsx`
- Modify: `apps/admin/app/[locale]/monetization/monetization-console-client.tsx` (wire up)

**Backend endpoints used:**
- `GET /api/admin/monetization/subscriptions?status=active&status=past_due` (refund candidates)
- `PATCH /api/admin/monetization/subscriptions/:id` (cancel/expire)

- [ ] **Step 1: Create refunds-tab.tsx**

Component features:
- Description text explaining the refund workflow
- **Search**: Find subscription by user email
- **Table**: Same as subscriptions but filtered to active/past_due/trialing only
- **Actions per row**:
  - "Cancel at period end" → PATCH `{ cancelAtPeriodEnd: true, reason }`
  - "Cancel immediately" → PATCH `{ status: "canceled", reason }`
  - "Expire" → PATCH `{ status: "expired", reason }`
- Each action prompts for audit reason via Dialog

- [ ] **Step 2: Wire into parent, remove old inline refunds block**

- [ ] **Step 3: Verify and commit**

```bash
git add apps/admin/app/[locale]/monetization/_components/refunds-tab.tsx apps/admin/app/[locale]/monetization/monetization-console-client.tsx
git commit -m "feat(admin): implement refunds tab with subscription cancel/expire actions"
```

---

## Task 9: Clean Up Parent Component

**Files:**
- Modify: `apps/admin/app/[locale]/monetization/monetization-console-client.tsx`

- [ ] **Step 1: Remove all extracted state variables**

State to remove (already moved to child components):
- `subs`, `setSubs`
- `entRows`, `setEntRows`
- `quotaData`, `setQuotaData`, `qOverrides`, `setQOverrides`
- `coupons`, `setCoupons`
- `analytics`, `setAnalytics`
- `audit`, `setAudit`

- [ ] **Step 2: Simplify loadTab**

`loadTab` should only handle `tab === "plans"` (plans tab is still inline). All other tabs load their own data.

- [ ] **Step 3: Verify all 9 routes show correct, unique content**

Navigate through each route and confirm:
- `/monetization` → Overview with KPIs + charts ✓
- `/monetization/plans` → Plans table with edit ✓
- `/monetization/entitlements` → Entitlements with create + link/unlink ✓
- `/monetization/quotas` → Policies + plan links + overrides ✓
- `/monetization/subscriptions` → Subscription list with search/filter/edit ✓
- `/monetization/billing-events` → Coupons CRUD + webhook events viewer ✓
- `/monetization/refunds` → Subscription cancel/refund actions ✓
- `/monetization/provider-config` → Analytics + ad placements ✓
- `/monetization/webhook-dlq` → Failed webhooks + raw payload ✓

- [ ] **Step 4: Final commit**

```bash
git add apps/admin/app/[locale]/monetization/
git commit -m "refactor(admin): clean up monetization parent — extract all tabs to components"
```

---

## Execution Order

Tasks 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 (sequential — each builds on the prior).

Task 1 (types + i18n) is a prerequisite for all others.
Tasks 2-8 can technically parallelize but are safer sequential to avoid merge conflicts in the parent component.
Task 9 is cleanup — must be last.
