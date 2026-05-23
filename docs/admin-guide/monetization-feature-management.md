# Hướng dẫn quản lý tính năng tính phí — NihonGo BJT

> Tài liệu cho Admin quản lý gói cước, tính năng premium, quota (giới hạn), và bật/tắt feature.

---

## Mục lục

1. [Tổng quan kiến trúc](#1-tổng-quan-kiến-trúc)
2. [Truy cập Admin Panel](#2-truy-cập-admin-panel)
3. [Hướng dẫn từng bước](#3-hướng-dẫn-từng-bước)
4. [Template tạo gói cước mới](#4-template-tạo-gói-cước-mới)
5. [Template thêm tính năng tính phí](#5-template-thêm-tính-năng-tính-phí)
6. [Template cấu hình Quota](#6-template-cấu-hình-quota)
7. [Bật/Tắt tính năng runtime](#7-bật-tắt-tính-năng-runtime)
8. [Ma trận đề xuất Free vs Premium](#8-ma-trận-đề-xuất-free-vs-premium)
9. [Checklist khi thay đổi gói](#9-checklist-khi-thay-đổi-gói)

---

## 1. Tổng quan kiến trúc

```
┌──────────────────────────────────────────────────────────────┐
│                    ADMIN PANEL (UI)                           │
│  Plans │ Entitlements │ Quotas │ Feature Flags │ Overrides   │
└──────────┬──────────────┬────────────┬──────────────┬────────┘
           │              │            │              │
           ▼              ▼            ▼              ▼
┌──────────────────────────────────────────────────────────────┐
│                   BACKEND API (NestJS)                        │
│                                                              │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │ Entitlement │  │ QuotaService │  │ RuntimeFeatureGate │  │
│  │   Guard     │  │ (transact.)  │  │    Service         │  │
│  └─────────────┘  └──────────────┘  └────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
           │              │            │
           ▼              ▼            ▼
┌──────────────────────────────────────────────────────────────┐
│                  PostgreSQL (Source of Truth)                  │
│                                                              │
│  Plan ──┬── PlanEntitlement ──── EntitlementDefinition       │
│         └── PlanQuota ────────── QuotaPolicy                 │
│                                                              │
│  UserSubscription ── (links user → plan)                     │
│  UsageCounter ── (tracks quota usage per window)             │
│  QuotaUserOverride ── (VIP/exception per user)               │
│  FeatureFlag ── (bật/tắt toàn hệ thống)                     │
└──────────────────────────────────────────────────────────────┘
```

### 3 lớp bảo vệ (Server-side, không bypass được từ frontend)

| Lớp | Mục đích | Denial Code |
|-----|----------|-------------|
| **Entitlement Guard** | Chặn tính năng premium (user không có quyền) | `ENTITLEMENT_DENIED` (403) |
| **Quota Service** | Giới hạn số lần dùng/ngày/tháng | `QUOTA_EXCEEDED` (403) |
| **Feature Flag** | Bật/tắt tính năng toàn hệ thống | `feature_disabled` (503) |

---

## 2. Truy cập Admin Panel

**URL**: `http://localhost:3001/{locale}/monetization`

**Tabs có sẵn**:
- Overview — KPIs, biểu đồ phân bổ plan, funnel
- Plans — Quản lý gói cước
- Entitlements — Quản lý quyền tính năng
- Quotas — Quản lý giới hạn sử dụng
- Subscriptions — Xem đăng ký user
- Billing Events — Sự kiện thanh toán
- Refunds — Hoàn tiền
- Provider Config — Cấu hình Stripe/provider
- Webhook DLQ — Dead-letter queue

**Quyền cần có**: `admin.monetization.read` (xem) + `admin.monetization.write` (sửa)

---

## 3. Hướng dẫn từng bước

### 3.1. Tạo gói cước (Plan) mới

1. Vào **Admin → Monetization → Plans**
2. Click **"Tạo Plan mới"**
3. Điền:
   - **Slug**: identifier duy nhất (VD: `pro`, `premium`, `enterprise`)
   - **Name Key**: i18n key hiển thị (VD: `plan.pro.name`)
   - **Status**: `draft` → test trước, chuyển `active` khi sẵn sàng
   - **Reason**: lý do tạo (bắt buộc, ≥3 ký tự)
4. Sau khi tạo → gắn Entitlements và Quotas

### 3.2. Gắn Entitlement (quyền tính năng) vào Plan

1. Vào **Entitlements** tab
2. Chọn entitlement cần gắn → Click **"Link Plan"**
3. Chọn Plan muốn gắn + nhập Reason
4. Confirm

**Ví dụ**: Gắn `quiz.official_simulation` vào plan `premium` → chỉ user premium được thi mock exam.

### 3.3. Cấu hình Quota (giới hạn)

1. Vào **Quotas** tab
2. **Tạo Policy** (nếu chưa có):
   - Key: `flashcard_reviews_per_day`
   - Window: `day` / `week` / `month`
   - Warn Threshold: 80 (cảnh báo khi dùng 80%)
3. **Link Plan với Limit**:
   - Chọn Policy → Plan → Nhập limit (VD: free = 20, pro = 200, premium = unlimited)
4. User dùng quá limit → API trả 403 `QUOTA_EXCEEDED`

### 3.4. Override Quota cho user cụ thể

1. Vào **Quotas** → **Create Override**
2. Nhập:
   - User ID
   - Quota Key (VD: `flashcard_reviews_per_day`)
   - Limit Value (override)
   - Expires At (tùy chọn — hết hạn tự động)
   - Reason (bắt buộc)
3. User đó sẽ dùng limit override thay vì limit từ plan

### 3.5. Bật/Tắt Feature Flag

Feature flags bật/tắt toàn bộ tính năng mà không cần deploy. Hiện tại quản lý qua DB trực tiếp hoặc API:

```sql
-- Bật monetization enforcement (bắt đầu thu phí)
UPDATE ops.feature_flag 
SET enabled = true, updated_at = NOW() 
WHERE key = 'monetization.enforcement';

-- Tắt tạm BJT simulation (maintenance)
UPDATE ops.feature_flag 
SET enabled = false, updated_at = NOW() 
WHERE key = 'quiz.official_simulation.enabled';

-- Kill switch (emergency — override enabled)
UPDATE ops.feature_flag 
SET kill_switch = true, updated_at = NOW() 
WHERE key = 'billing.stripe.enabled';
```

---

## 4. Template tạo gói cước mới

### Template JSON cho Plan config:

```json
{
  "slug": "pro",
  "nameKey": "plan.pro.name",
  "status": "draft",
  "config": {
    "pricing": {
      "monthly": 149000,
      "yearly": 1490000,
      "currency": "VND"
    },
    "billing_interval": "monthly",
    "trial_days": 7,
    "features_highlight": [
      "unlimited_reviews",
      "unlimited_quizzes",
      "reduced_ads",
      "ai_card_gen"
    ]
  }
}
```

### Bảng template 3 gói đề xuất:

| Field | Free | Pro | Premium |
|-------|------|-----|---------|
| slug | `free` | `pro` | `premium` |
| nameKey | `plan.free.name` | `plan.pro.name` | `plan.premium.name` |
| Giá/tháng | 0 | 99,000–149,000 VND | 199,000–299,000 VND |
| Trial | — | 7 ngày | 14 ngày |
| Status | `active` | `active` | `active` |

---

## 5. Template thêm tính năng tính phí

### Bước 1: Tạo Entitlement Definition

| Field | Giá trị | Ghi chú |
|-------|---------|---------|
| **key** | `{module}.{feature}` | VD: `analytics.detailed_report` |
| **category** | flashcard / bjt / reading_assist / analytics / media / ai / battle / ads / admin | Phân loại |
| **description** | Mô tả ngắn | VD: "Access detailed weekly analytics report" |

### Bước 2: Link vào Plans

| Entitlement Key | Free | Pro | Premium |
|----------------|------|-----|---------|
| `learner.basic` | ✅ | ✅ | ✅ |
| `ads.reduced` | ❌ | ✅ | ✅ |
| `ads.remove` | ❌ | ❌ | ✅ |
| `flashcard.suggest_cards` | ❌ | ✅ | ✅ |
| `flashcard.adaptive_gen` | ❌ | ❌ | ✅ |
| `quiz.official_simulation` | ❌ | ❌ | ✅ |
| `analytics.detailed_report` | ❌ | ✅ | ✅ |
| `career_rpg.full_access` | ❌ | ❌ | ✅ |
| `scenario.unlimited` | ❌ | ✅ | ✅ |

### Bước 3: Áp dụng Guard trong code (nếu tính năng mới)

```typescript
// Trong controller
@UseGuards(KeycloakAuthGuard, EntitlementGuard)
@RequiresEntitlement('analytics.detailed_report')
@Get('weekly-report/detailed')
async getDetailedReport() { ... }
```

---

## 6. Template cấu hình Quota

### Tạo Quota Policy:

| Field | Giá trị |
|-------|---------|
| **key** | `{module}_{action}_per_{window}` |
| **windowCode** | `day` / `week` / `month` |
| **warnThresholdPercent** | 80 (cảnh báo khi dùng 80%) |
| **description** | Mô tả |

### Bảng Quota đề xuất hoàn chỉnh:

| Quota Key | Window | Free | Pro | Premium | Mô tả |
|-----------|--------|------|-----|---------|--------|
| `flashcard_reviews_per_day` | day | 30 | 300 | ∞ (999999) | Ôn flashcard/ngày |
| `quiz.bjt.start` | day | 3 | 20 | ∞ | Quiz starts/ngày |
| `flashcard_gen_per_day` | day | 3 | 30 | 100 | AI tạo card/ngày |
| `image_search_daily` | day | 3 | 20 | 50 | Tìm kiếm hình/ngày |
| `deck_clones_per_month` | month | 3 | 20 | ∞ | Clone deck/tháng |
| `deck_public_shares` | month | 2 | 10 | ∞ | Chia sẻ deck/tháng |
| `scenario_plays_per_day` | day | 3 | 15 | ∞ | Business scenario/ngày |
| `nhk_articles_per_day` | day | 5 | 30 | ∞ | Đọc tin NHK/ngày |
| `battle_matches_per_day` | day | 5 | 20 | ∞ | Battle/ngày |
| `export_reports_per_month` | month | 1 | 10 | ∞ | Xuất report/tháng |

### Link Plan-Quota qua Admin UI:

1. Quotas tab → **"Link Plan"**
2. Chọn: Policy = `flashcard_reviews_per_day`, Plan = `free`, Limit = `30`
3. Lặp lại cho mỗi plan

---

## 7. Bật/Tắt tính năng runtime

### Feature Flags hiện có:

| Flag Key | Mô tả | Tắt = ? |
|----------|--------|---------|
| `monetization.enforcement` | Bật enforce quota/entitlement | Tắt = mọi user dùng free mode |
| `billing.stripe.enabled` | Cho phép checkout/thanh toán | Tắt = không ai mua được |
| `quiz.official_simulation.enabled` | Mock exam có hoạt động | Tắt = 503 khi truy cập |

### Thêm Feature Flag mới:

```sql
INSERT INTO ops.feature_flag (key, description, enabled, scope)
VALUES (
  'career_rpg.enabled',
  'Enable/disable Career RPG feature module',
  true,
  'global'
);
```

### Emergency Kill Switch:

```sql
-- Tắt khẩn cấp (override cả enabled=true)
UPDATE ops.feature_flag SET kill_switch = true WHERE key = 'billing.stripe.enabled';

-- Bật lại sau khi fix
UPDATE ops.feature_flag SET kill_switch = false WHERE key = 'billing.stripe.enabled';
```

---

## 8. Ma trận đề xuất Free vs Premium

### Nguyên tắc phân chia:

| Loại | Free | Premium | Lý do |
|------|------|---------|-------|
| **Content browsing** | ✅ Full | ✅ Full | Hook → engagement |
| **Daily content** | ✅ Full | ✅ Full | Retention |
| **Gamification cơ bản** | ✅ Full | ✅ Full | Habit loop |
| **Practice (giới hạn)** | ✅ Quota | ✅ Unlimited | Tạo nhu cầu upgrade |
| **AI-powered** | ❌/Giới hạn | ✅ Full | Chi phí inference |
| **Simulation/Mock exam** | ❌ | ✅ | Giá trị cao nhất |
| **Ads** | Có ads | Giảm/Không ads | Revenue + upsell |
| **Advanced analytics** | ❌ | ✅ | Value-add |
| **Offline/Export** | ❌ | ✅ | Infrastructure cost |

### Tóm tắt bằng hình ảnh:

```
╔══════════════════════════════════════════════════════════╗
║                    FREE TIER                             ║
║  ✅ Browse dictionary, kanji, grammar                   ║
║  ✅ Daily radar, NHK (5/day)                            ║
║  ✅ Flashcard review (30/day)                           ║
║  ✅ Quiz practice (3/day)                               ║
║  ✅ Battle (5/day)                                      ║
║  ✅ Pet, login bonus, heatmap, gacha                    ║
║  ✅ Reading assist (basic)                              ║
║  ⚠️ Có quảng cáo                                       ║
╠══════════════════════════════════════════════════════════╣
║                    PRO TIER                              ║
║  ✅ Tất cả Free + Unlimited reviews/quizzes             ║
║  ✅ AI card suggestion (30/day)                         ║
║  ✅ Giảm quảng cáo                                     ║
║  ✅ NHK unlimited                                      ║
║  ✅ Detailed weekly report                              ║
║  ✅ Business scenarios unlimited                        ║
╠══════════════════════════════════════════════════════════╣
║                  PREMIUM TIER                            ║
║  ✅ Tất cả Pro + Official BJT Mock Exam                 ║
║  ✅ AI adaptive card generation                         ║
║  ✅ Không quảng cáo                                     ║
║  ✅ Career RPG full                                     ║
║  ✅ Advanced analytics + export                         ║
║  ✅ Priority support                                    ║
╚══════════════════════════════════════════════════════════╝
```

---

## 9. Checklist khi thay đổi gói

### Trước khi thay đổi:

- [ ] Xác nhận đã backup DB (nếu production)
- [ ] Review impact: bao nhiêu user bị ảnh hưởng?
- [ ] Thông báo user trước (nếu giảm quota existing users)
- [ ] Test trên staging/draft plan trước

### Khi thay đổi:

- [ ] Điền **Reason** đầy đủ (mọi thay đổi đều có audit)
- [ ] Nếu tạo entitlement mới → cần dev thêm `@RequiresEntitlement` guard
- [ ] Nếu tạo quota mới → cần dev thêm `QuotaService.consume()` call
- [ ] Nếu tạo feature flag → cần dev thêm `requireEnabled()` check

### Sau khi thay đổi:

- [ ] Verify trên Admin Overview — KPIs đúng?
- [ ] Test endpoint bị gate → user free phải nhận 403
- [ ] Test endpoint → user premium phải pass
- [ ] Check audit log — action được ghi?
- [ ] Monitor error rate 30 phút đầu

---

## Phụ lục: API Endpoints cho Admin

| Method | Endpoint | Chức năng |
|--------|----------|-----------|
| GET | `/admin/monetization/overview` | KPIs + charts |
| GET | `/admin/monetization/plans` | Danh sách plans |
| POST | `/admin/monetization/plans` | Tạo plan |
| PATCH | `/admin/monetization/plans/:id` | Sửa plan |
| GET | `/admin/monetization/entitlements` | Danh sách entitlements |
| POST | `/admin/monetization/entitlements` | Tạo entitlement |
| POST | `/admin/monetization/plans/:planId/entitlements` | Gắn entitlement vào plan |
| DELETE | `/admin/monetization/plans/:planId/entitlements/:entId` | Gỡ entitlement khỏi plan |
| GET | `/admin/monetization/quotas` | Danh sách quota policies |
| POST | `/admin/monetization/quotas/policies` | Tạo quota policy |
| PATCH | `/admin/monetization/quotas/policies/:id` | Sửa quota policy |
| POST | `/admin/monetization/quotas/plan-links` | Gắn quota vào plan với limit |
| GET | `/admin/monetization/quota-overrides` | Danh sách override |
| POST | `/admin/monetization/quota-overrides` | Tạo override cho user |
| DELETE | `/admin/monetization/quota-overrides/:id` | Xóa override |
| GET | `/admin/monetization/subscriptions` | Xem subscriptions |
| GET | `/admin/monetization/audit` | Audit trail |

---

## Phụ lục: Ví dụ cURL

### Tạo Plan mới:
```bash
curl -X POST http://localhost:4000/admin/monetization/plans \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "pro",
    "nameKey": "plan.pro.name",
    "status": "draft",
    "config": {"pricing": {"monthly": 149000, "currency": "VND"}},
    "reason": "Launch Pro tier for Q3 2026"
  }'
```

### Tạo Entitlement:
```bash
curl -X POST http://localhost:4000/admin/monetization/entitlements \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "analytics.detailed_report",
    "category": "analytics",
    "description": "Access detailed weekly/monthly analytics with trends",
    "reason": "Add premium analytics feature for Pro+"
  }'
```

### Gắn Entitlement vào Plan:
```bash
curl -X POST http://localhost:4000/admin/monetization/plans/{planId}/entitlements \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "entitlementId": "{entitlement-uuid}",
    "reason": "Pro users get detailed analytics"
  }'
```

### Tạo Quota Policy + Link:
```bash
# 1. Tạo policy
curl -X POST http://localhost:4000/admin/monetization/quotas/policies \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "scenario_plays_per_day",
    "windowCode": "day",
    "warnThresholdPercent": 80,
    "description": "Business scenario plays per UTC day",
    "reason": "Gate business scenario feature"
  }'

# 2. Link to plan with limit
curl -X POST http://localhost:4000/admin/monetization/quotas/plan-links \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "planId": "{free-plan-uuid}",
    "quotaPolicyId": "{policy-uuid}",
    "limitValue": 3,
    "reason": "Free users get 3 scenario plays/day"
  }'
```

### Override cho user VIP:
```bash
curl -X POST http://localhost:4000/admin/monetization/quota-overrides \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "{user-uuid}",
    "quotaKey": "flashcard_reviews_per_day",
    "limitValue": 999999,
    "expiresAt": "2026-12-31T23:59:59Z",
    "reason": "Beta tester VIP access until end 2026"
  }'
```

---

## Phụ lục: Workflow tạo tính năng tính phí mới (End-to-End)

```
┌─────────────────────────────────────────────────────────┐
│ 1. ADMIN tạo Entitlement hoặc Quota Policy (Admin UI)   │
│    → key: "new_feature.access"                          │
│    → category: phân loại phù hợp                        │
└────────────────────────┬────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────┐
│ 2. ADMIN link vào Plans (chỉ Pro/Premium)               │
│    → Free: không có entitlement này                     │
│    → Pro: có                                            │
│    → Premium: có                                        │
└────────────────────────┬────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────┐
│ 3. DEV thêm Guard vào route (nếu chưa có)              │
│    @RequiresEntitlement('new_feature.access')           │
│    hoặc QuotaService.consume('quota_key')               │
└────────────────────────┬────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────┐
│ 4. TEST                                                  │
│    → Free user gọi API → 403 ENTITLEMENT_DENIED        │
│    → Pro user gọi API → 200 OK                         │
└────────────────────────┬────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────┐
│ 5. ACTIVATE                                              │
│    → Plan status: draft → active                        │
│    → Feature flag: enabled = true                       │
│    → Monitor & adjust                                   │
└─────────────────────────────────────────────────────────┘
```

---

*Cập nhật lần cuối: 2026-05-21*
