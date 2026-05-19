# Monetization System Completion Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete all missing monetization frontend features and add a global monetization kill-switch so the system can run in "free for all" mode initially.

**Architecture:**
- Add `monetization.enforcement` feature flag — when disabled, quota enforcement is bypassed (unlimited), billing/ads/upgrade CTAs hidden from learner UI, and admin can still manage plans/data.
- Build learner pricing page, subscription management sub-page, and ad placement component.
- Harden Stripe webhook verification.

**Tech Stack:** NestJS, Prisma, Next.js (App Router), React, Tailwind, i18n (vi/ja/en), RuntimeFeatureGateService

---

## Phase 1: Global Monetization Kill-Switch

### Task 1: Add `monetization.enforcement` feature flag constant + bypass in QuotaService

**Files:**
- Modify: `apps/api/src/monetization/monetization.constants.ts`
- Modify: `apps/api/src/monetization/quota.service.ts`
- Modify: `apps/api/src/monetization/monetization.module.ts` (if RuntimeFeatureGateService not injected)
- Test: `apps/api/src/monetization/quota.service.test.ts`

**Behavior:** When `monetization.enforcement` flag is disabled (or missing with `missingBehavior: "allow"`), all `consumeQuota*` methods skip enforcement — treat limit as Infinity.

- [ ] **Step 1: Add constant**

```ts
// monetization.constants.ts — add to FeatureFlagKey
export const FeatureFlagKey = {
  billing_stripe: "billing.stripe.enabled",
  monetization_enforcement: "monetization.enforcement",
  quiz_official_simulation: "quiz.official_simulation.enabled"
} as const;
```

- [ ] **Step 2: Inject RuntimeFeatureGateService into QuotaService**

```ts
// quota.service.ts constructor
constructor(
  @Inject(MonetizationRepository) private readonly repository: MonetizationRepository,
  private readonly featureGate: RuntimeFeatureGateService
) {}
```

- [ ] **Step 3: Add enforcement check method**

```ts
private async isEnforcementEnabled(): Promise<boolean> {
  const { enabled } = await this.featureGate.status(FeatureFlagKey.monetization_enforcement, {
    missingBehavior: "allow"  // missing = don't enforce (free mode by default)
  });
  return enabled;
}
```

- [ ] **Step 4: Guard consumeQuotaInTransaction**

At the top of `consumeQuotaInTransaction`, add:
```ts
if (!(await this.isEnforcementEnabled())) return; // free mode — skip quota
```

- [ ] **Step 5: Write test**

```ts
it("should skip quota enforcement when monetization.enforcement flag disabled", async () => {
  featureGate.status.mockResolvedValue({ configured: true, enabled: false, key: "monetization.enforcement", killSwitch: false });
  // Should not throw even if limit is 0
  await expect(service.consumeFlashcardReviewInTransaction(tx, "user1")).resolves.toBeUndefined();
});
```

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(monetization): add monetization.enforcement flag bypass in QuotaService"
```

---

### Task 2: Hide billing/upgrade CTAs in learner UI when enforcement disabled

**Files:**
- Modify: `apps/api/src/monetization/learner-monetization.controller.ts` — add enforcement status to summary response
- Modify: `apps/web/app/[locale]/flashcards/_components/flashcards-client.tsx` — hide quota bar when enforcement disabled
- Modify: `apps/web/app/[locale]/quiz/_components/quiz-client.tsx` — hide upgrade CTA

**Behavior:** `GET /learner/monetization/summary` returns `{ enforcementEnabled: boolean, ... }`. Frontend hides quota UI + upgrade CTAs when `enforcementEnabled === false`.

- [ ] **Step 1: Add enforcementEnabled to summary response**

In `learner-monetization.controller.ts`, inside the summary endpoint:
```ts
const enforcement = await this.featureGate.status(FeatureFlagKey.monetization_enforcement, { missingBehavior: "allow" });
// Include in response:
return { ...existingResponse, enforcementEnabled: enforcement.enabled };
```

- [ ] **Step 2: Conditionally render quota bar in flashcards**

```tsx
{summary?.enforcementEnabled && (
  <div className="...quota bar...">{/* existing quota display */}</div>
)}
```

- [ ] **Step 3: Conditionally render upgrade CTA in quiz**

```tsx
{summary?.enforcementEnabled && quotaExceeded && (
  <button onClick={startOfficialUpgrade}>...</button>
)}
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(monetization): hide quota/upgrade UI when enforcement disabled"
```

---

### Task 3: Admin toggle for monetization enforcement in Settings

**Files:**
- Verify: `apps/admin/app/[locale]/settings/settings-admin-client.tsx` — feature flags UI already has CRUD

**Behavior:** No new code needed if admin settings already manages all featureFlag rows. Just seed the `monetization.enforcement` row.

- [ ] **Step 1: Add seed script entry**

```sql
INSERT INTO feature_flag (key, enabled, kill_switch, description, created_at, updated_at)
VALUES ('monetization.enforcement', false, false, 'When enabled, quota limits and billing are enforced. Disable for free-for-all mode.', NOW(), NOW())
ON CONFLICT (key) DO NOTHING;
```

- [ ] **Step 2: Verify admin settings page can toggle it**

Navigate to admin settings → feature flags → confirm `monetization.enforcement` appears and can be toggled.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(monetization): seed monetization.enforcement flag (disabled = free mode)"
```

---

## Phase 2: Learner Pricing Page

### Task 4: Build `/[locale]/pricing` page

**Files:**
- Create: `apps/web/app/[locale]/pricing/page.tsx`
- Create: `apps/web/app/[locale]/pricing/_components/pricing-client.tsx`
- Modify: `apps/web/messages/vi.json` — add `pricing` section
- Modify: `apps/web/messages/ja.json` — add `pricing` section

**Behavior:** Shows available plans from `GET /api/learner/monetization/plans` (new endpoint). Each plan card shows: name, quota limits, entitlements, price (from plan config JSON). CTA button calls checkout. Hidden entirely when `enforcementEnabled === false`.

- [ ] **Step 1: Add learner plans list endpoint**

In `learner-monetization.controller.ts`:
```ts
@Get("plans")
async listPlansForLearner() {
  return this.repository.listActivePlansForLearner();
}
```

Repository method:
```ts
async listActivePlansForLearner() {
  return this.prisma.plan.findMany({
    where: { status: "active" },
    include: {
      entitlements: { include: { entitlement: true } },
      planQuotas: { include: { quotaPolicy: true } }
    },
    orderBy: { sortOrder: "asc" }
  });
}
```

- [ ] **Step 2: Create pricing page component**

Responsive card grid showing plans. Free plan highlighted as current (if no sub). Premium plans with checkout CTA.

- [ ] **Step 3: Add i18n keys**

```json
"pricing": {
  "title": "Gói dịch vụ",
  "subtitle": "Chọn gói phù hợp với nhu cầu học tập",
  "current": "Gói hiện tại",
  "upgrade": "Nâng cấp",
  "free": "Miễn phí",
  "features": "Tính năng",
  "perMonth": "/tháng"
}
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(learner): add pricing page with plan cards + checkout CTA"
```

---

## Phase 3: Learner Subscription Management

### Task 5: Build `/[locale]/settings/subscription` sub-page

**Files:**
- Create: `apps/web/app/[locale]/settings/subscription/page.tsx`
- Create: `apps/web/app/[locale]/settings/subscription/_components/subscription-client.tsx`
- Modify: `apps/web/app/[locale]/settings/_components/settings-hub-client.tsx` — add subscription nav item
- Modify: `apps/web/messages/vi.json` — add `subscription` section
- Modify: `apps/web/messages/ja.json` — add `subscription` section

**Behavior:** Shows current plan, subscription status, period end date, quota usage summary. "Change Plan" → links to /pricing. "Cancel" → POST confirmation.

- [ ] **Step 1: Add learner subscription detail endpoint**

In `learner-monetization.controller.ts`:
```ts
@Get("subscription")
async getMySubscription(@Req() req) {
  const userId = req.user.sub;
  return this.repository.resolvePlanForUser(userId);
}
```

- [ ] **Step 2: Build subscription management component**

- Plan name + status badge
- Current period dates
- Quota usage bars (from summary endpoint)
- Cancel button (with confirmation dialog)
- Link to pricing page

- [ ] **Step 3: Add cancel subscription endpoint**

```ts
@Post("subscription/cancel")
async cancelMySubscription(@Req() req) {
  // Mark subscription as "canceled" with period end = current period end
}
```

- [ ] **Step 4: Add nav item in settings hub**

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(learner): add subscription management page in settings"
```

---

## Phase 4: Stripe Webhook Hardening

### Task 6: Implement HMAC-SHA256 webhook signature verification

**Files:**
- Modify: `apps/api/src/monetization/billing/billing-webhook.service.ts`
- Test: `apps/api/src/monetization/billing/billing-webhook.service.test.ts`

**Behavior:** Before processing any webhook, verify signature using `stripe.webhooks.constructEvent()`. Reject with 400 if invalid.

- [ ] **Step 1: Replace TODO with real verification**

```ts
private verifyStripeSignature(rawBody: Buffer, signature: string): Stripe.Event {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  return stripe.webhooks.constructEvent(
    rawBody,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET!
  );
}
```

- [ ] **Step 2: Wire into ingestWebhook flow**

- [ ] **Step 3: Test with mock signatures**

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "fix(billing): implement Stripe webhook HMAC-SHA256 verification"
```

---

## Phase 5: Ad Placement Component (Learner)

### Task 7: Build reusable `<AdSlot>` component for learner web

**Files:**
- Create: `apps/web/components/ad-slot.tsx`
- Modify: applicable layout files to insert ad slots

**Behavior:** Calls `GET /api/learner/monetization/ad?placementCode=X&userId=Y`. If eligible, renders ad creative. If not (premium user, disabled, or enforcement off), renders nothing. Respects `ads.enabled` flag.

- [ ] **Step 1: Build AdSlot component**

```tsx
export function AdSlot({ placementCode }: { placementCode: string }) {
  // Fetch ad decision
  // If decisionKey + eligible → render ad
  // If not → return null
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat(learner): add reusable AdSlot component"
```

---

## Phase 6: Admin Monetization Enable/Disable UX Enhancement

### Task 8: Add monetization mode indicator to admin monetization console header

**Files:**
- Modify: `apps/admin/app/[locale]/monetization/monetization-console-client.tsx`
- Modify: `apps/admin/messages/vi.json`
- Modify: `apps/admin/messages/ja.json`
- Modify: `apps/admin/messages/en.json`

**Behavior:** Show a prominent badge/banner at the top of monetization console: "🟢 Enforcement Active" or "⚪ Free Mode (enforcement off)". Link to settings to toggle.

- [ ] **Step 1: Fetch monetization.enforcement flag status in overview**

Add to overview data fetch: check flag status.

- [ ] **Step 2: Render status badge in header**

```tsx
<span className={cn("rounded-full px-3 py-1 text-xs font-medium", enforcementEnabled ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600")}>
  {enforcementEnabled ? labels.enforcement.active : labels.enforcement.freeMode}
</span>
```

- [ ] **Step 3: Add i18n keys**

```json
"enforcement": {
  "active": "Đang thu phí",
  "freeMode": "Miễn phí toàn diện",
  "toggleHint": "Thay đổi trong Cài đặt → Feature Flags"
}
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(admin): show monetization enforcement mode badge in console header"
```

---

## Summary — Priority Order

| Phase | Task | Impact | Effort |
|-------|------|--------|--------|
| 1 | Monetization kill-switch (flag + bypass) | 🔴 Critical — enables free launch | Small |
| 1 | Hide learner CTAs when disabled | 🔴 Critical — UX coherence | Small |
| 1 | Seed flag + admin verify | 🟡 Medium | Tiny |
| 6 | Admin enforcement mode badge | 🟡 Medium — admin clarity | Small |
| 2 | Learner pricing page | 🟡 Medium — needed before enabling billing | Medium |
| 3 | Subscription management | 🟡 Medium — needed for paid users | Medium |
| 4 | Stripe webhook HMAC | 🟡 Medium — security for production | Small |
| 5 | Ad slot component | 🟠 Low — ads come later | Small |

**Total estimated scope:** ~8 tasks, mostly small-medium.

**Recommendation:** Start with Phase 1 (Tasks 1–3) immediately — this unblocks free launch. Phase 2–3 before enabling billing. Phase 4–5 before production ads/payments.
