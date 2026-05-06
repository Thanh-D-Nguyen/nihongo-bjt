# Hướng dẫn sử dụng Admin — NihonGo BJT

Tài liệu ngắn cho người vận hành Admin Console (local dev → staging → production).
Nội dung tập trung vào: chạy local, xác thực (Keycloak hoặc legacy dev header), các endpoint quan trọng và lưu ý RBAC/audit.

---

## Mục đích
Cung cấp hướng dẫn nhanh để:
- Khởi động Admin app cho phát triển local.
- Hiểu luồng xác thực (Keycloak) và cách chạy trong chế độ dev không Keycloak.
- Danh sách endpoint/route quan trọng để vận hành và kiểm thử.

## Yêu cầu trước
- Node.js 20+ (LTS khuyến nghị)
- `pnpm` 10+
- Docker + Docker Compose (nếu dùng dịch vụ local: Postgres, Redis, Meilisearch, MinIO)

## Tóm tắt lệnh nhanh
Từ thư mục gốc repo:

```bash
# cài deps
pnpm install
pnpm prisma:generate

# (tùy chọn) chạy infra local
docker compose up -d postgres redis meilisearch minio

# áp dụng migration (nếu cần)
pnpm exec prisma migrate deploy --schema packages/database/prisma/schema.prisma

# (tùy chọn) seed dữ liệu admin (tạo admin actor giúp dev không cần Keycloak)
pnpm --filter @nihongo-bjt/api admin:seed
# hoặc chạy the foundation seed
pnpm --filter @nihongo-bjt/api seed:foundation

# Chạy backend (API)
pnpm --filter @nihongo-bjt/api dev

# Chạy Admin app (Next.js)
pnpm --filter @nihongo-bjt/admin dev

# Hoặc chạy tất cả services cùng lúc (Turbo)
pnpm dev
```

Admin mặc định lắng nghe trên `http://localhost:3001/vi` (locale `vi` là mặc định được tiền cấu hình).

---

## Chế độ xác thực (Auth)

Admin console hỗ trợ 2 chế độ vận hành:

1. Keycloak (production-like):
   - Thiết lập biến môi trường `NEXT_PUBLIC_ADMIN_KEYCLOAK_ISSUER_URL` (hoặc `NEXT_PUBLIC_ADMIN_KEYCLOAK_URL` + `NEXT_PUBLIC_ADMIN_KEYCLOAK_REALM`) và client ID/secret phù hợp.
   - Flow: browser → `/api/auth/keycloak/authorize` → Keycloak → server-side token exchange → httpOnly cookies → UI gọi `/api/auth/keycloak/session` để lấy access token ngắn hạn → `adminApiFetch` gắn `Authorization: Bearer …` tới API.
   - Nếu Keycloak được bật và người dùng không có realm role/hoặc chưa link `admin_actor` → `GET /api/admin/session` trả 403 và UI redirect tới `/access-denied`.
   - Tham khảo: `docs/ops/keycloak-app-integration.md`.

2. Legacy/dev (Keycloak tắt):
   - Khi `NEXT_PUBLIC_ADMIN_KEYCLOAK_ISSUER_URL` chưa được cấu hình, UI và API dùng cơ chế dev header.
   - `adminApiFetch` sẽ gửi header `x-admin-actor-id` (từ biến `NEXT_PUBLIC_LOCAL_ADMIN_ACTOR_ID`) để giả lập actor trong môi trường non-production. **Chỉ dùng cho local development.**
   - Đảm bảo đã seed một `authz.admin_actor` phù hợp với giá trị `NEXT_PUBLIC_LOCAL_ADMIN_ACTOR_ID`.

Biến môi trường tham chiếu (ví dụ trong `.env.example`):
- `NEXT_PUBLIC_API_URL` (mặc định `http://localhost:4000`)
- `NEXT_PUBLIC_LOCAL_ADMIN_ACTOR_ID` (mặc định dev ID có sẵn trong example)
- `NEXT_PUBLIC_ADMIN_KEYCLOAK_ISSUER_URL`, `NEXT_PUBLIC_ADMIN_KEYCLOAK_CLIENT_ID`, `NEXT_PUBLIC_ADMIN_KEYCLOAK_REALM` (khi dùng Keycloak)

---

## Endpoint & hành vi API quan trọng (Admin)
- `GET /api/admin/session` — validate Admin portal session (Keycloak JWT + linked admin_actor).
- `GET /api/admin/me` — trả thông tin admin principal + **permission codes** (dùng để render shell và kiểm tra UI-based feature gating).
- `GET /api/admin/module-contracts` — danh sách readiness của module (dựng menu shell parity).
- IAM endpoints: `GET /api/admin/iam/roles`, `GET /api/admin/iam/permissions`, `POST /api/admin/iam/admins/:id/roles` (assign role, audited) …

Lưu ý bảo mật/audit:
- User 360 (deep profile) API yêu cầu header truy cập: `x-admin-access-reason` (>=8 ký tự) và `x-admin-access-reason-category` (một trong: `compliance|support|abuse|billing|other`). API trả 403 nếu header không hợp lệ.
- Mọi write hoặc thay đổi IAM/role đều được audit bởi hệ thống `admin-audit` (xem `apps/api/src/admin/admin-audit.*`).
- Backend thực thi RBAC — UI chỉ giúp trải nghiệm; không dựa vào UI để bảo mật.

---

## Routes chính trong Admin shell (tóm tắt)
Menu được định nghĩa trong `apps/admin/lib/admin-nav-data.ts`.
Một số route tiêu biểu:
- Overview: `/`, `/system/health`, `/system/queue-health`, `/system/release`
- Content: `/content`, `/dictionary`, `/kanji`, `/grammar`, `/i18n`, `/announcements`
- Learning: `/daily-hub`, `/decks`, `/flashcards/*`, `/reading-assist`
- Assessment: `/bjt`, `/assessment/quiz-templates`, `/assessment/question-bank`, `/assessment/mock-exams`
- Battle (có feature-flag): `/battle/configs`, `/battle/bots`, `/battle/matches`, `/battle/abuse`
- Users & Support: `/users`, `/users/360`, `/support/notes`, `/privacy/requests`
- Operations: `/ops/feature-flags`, `/ops/kill-switches`, `/ops/dead-letters`, `/import/manifests`
- Monetization: `/monetization/plans`, `/monetization/quotas`, `/ads`

(Đọc `apps/admin/lib/admin-nav-data.ts` để xem toàn bộ danh sách và quyền cần thiết.)

---

## Debug & Troubleshooting nhanh
- Nếu admin redirect tới `/access-denied`: kiểm tra Keycloak realm role, hoặc (dev mode) kiểm tra `NEXT_PUBLIC_LOCAL_ADMIN_ACTOR_ID` và existence của `authz.admin_actor` trong DB.
- Nếu UI kẹt trên "checking session": kiểm tra `/api/admin/session` response, cookie httpOnly (`adminKcCookies`) và `OAUTH` redirect callback.
- Để test API thủ công mà không có Keycloak: thêm header `x-admin-actor-id: <UUID>` và (khi đọc User 360) `x-admin-access-reason` + `x-admin-access-reason-category`.
- Lỗi CORS/minio uploads: kiểm tra cấu hình MinIO CORS nếu upload từ admin web xảy ra.

---

## Tài liệu tham chiếu
- Shell nav data: `apps/admin/lib/admin-nav-data.ts`
- Auth flow & Keycloak notes: `docs/ops/keycloak-app-integration.md`
- Admin server controller (endpoints & RBAC): `apps/api/src/admin/admin.controller.ts`
- Admin client helper: `apps/admin/lib/admin-api.ts` (logic `adminApiFetch` dùng Bearer hoặc `x-admin-actor-id`)

---

## Liên hệ / tiếp theo
Nếu cần: tôi có thể:
- Sinh 1 trang HTML tĩnh từ hướng dẫn này (đã tạo trong `docs/admin-guide/html/index.html`).
- Ghi checklist QA cho Admin (browser phase-review) hoặc kịch bản E2E admin.


---
_Last updated: tự động bởi quy trình rà quét mã nguồn (script)._
