# Hướng dẫn vận hành Admin Console — NihonGo BJT (Operator Guide)

Mục đích: tài liệu vận hành chi tiết cho Admin Console, dành cho các kỹ sư vận hành, QA, và developer chịu trách nhiệm admin production loop.

--

## Tóm tắt nhanh
- Vùng hoạt động: `apps/admin` (Next.js) + `apps/api` (NestJS). Admin chạy mặc định trên `http://localhost:3001/vi`.
- Chạy toàn bộ môi trường dev: `pnpm dev` (`turbo run dev`: web + admin + API song song).
- Nếu máy nặng hoặc chỉ cần learner: `pnpm dev:learner` (web + API), hoặc `pnpm dev:web` / `pnpm dev:api` / `pnpm dev:admin`.
- Nếu cần tái hiện lỗi dev (exit code 1), hãy chạy từng service riêng để cô lập:
  - `pnpm --filter @nihongo-bjt/api dev`
  - `pnpm --filter @nihongo-bjt/admin dev`

--

## Yêu cầu trước
- Node.js 20+ (LTS). Kiểm tra: `node -v`.
- pnpm 10+: `pnpm -v`.
- Docker + Docker Compose (nếu dùng dịch vụ local: Postgres, Redis, Meilisearch, MinIO).

## Biến môi trường quan trọng
(Những biến này thường nằm trong `.env` từ `.env.example`)
- `DATABASE_URL` — PostgreSQL (Prisma). Ví dụ: `postgresql://postgres:postgres@127.0.0.1:15432/nihongo_bjt?schema=content`.
- `NEXT_PUBLIC_API_URL` — `http://localhost:4000` (API base).
- `NEXT_PUBLIC_LOCAL_ADMIN_ACTOR_ID` — UUID dev admin actor.
- `NEXT_PUBLIC_ADMIN_KEYCLOAK_ISSUER_URL`, `NEXT_PUBLIC_ADMIN_KEYCLOAK_REALM`, `NEXT_PUBLIC_ADMIN_KEYCLOAK_CLIENT_ID` — Keycloak (admin browser OIDC).
- `MEILI_MASTER_KEY`, `REDIS_URL`, `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY` — dịch vụ hỗ trợ.

Luôn copy `.env.example` → `.env` rồi chỉnh các biến cần thiết.

--

## Cài đặt & khởi tạo môi trường local
1. Cài PNPM (nếu chưa):
```bash
corepack enable
corepack prepare pnpm@10.26.2 --activate
```
2. Clone repo & cài phụ thuộc:
```bash
git clone <repo>
cd nihongo-bjt
pnpm install
pnpm prisma:generate
```
3. Khởi động infra (tùy chọn, dùng Docker Compose):
```bash
docker compose up -d postgres redis meilisearch minio
```
4. Áp migrations (nếu cần):
```bash
pnpm exec prisma migrate deploy --schema packages/database/prisma/schema.prisma
```
5. (Tùy chọn) Seed dữ liệu dev (khuyến nghị trước test Admin):
```bash
pnpm --filter @nihongo-bjt/api admin:seed
pnpm --filter @nihongo-bjt/api seed:foundation
```

--

## Chạy ứng dụng
- Chạy tất cả services (monorepo):
```bash
pnpm dev
```
- Chạy riêng API (cô lập lỗi):
```bash
pnpm --filter @nihongo-bjt/api dev
```
- Chạy riêng Admin app (Next.js):
```bash
pnpm --filter @nihongo-bjt/admin dev
```
Ports mặc định: learner web `:3000`, admin `:3001`, api `:4000`.

--

## Cách tái hiện lỗi `pnpm dev` (exit code 1) và thu logs
Mục tiêu: cô lập service gây lỗi và thu đủ logs để phân tích.

1. Chạy từng service riêng:
```bash
pnpm --filter @nihongo-bjt/api dev 2>&1 | tee logs/api.dev.log
pnpm --filter @nihongo-bjt/admin dev 2>&1 | tee logs/admin.dev.log
```
2. Nếu bạn muốn chạy cả monorepo và ghi log toàn bộ:
```bash
pnpm dev 2>&1 | tee logs/monorepo.dev.$(date +%Y%m%d%H%M%S).log
```
3. Kiểm tra các lỗi phổ biến trong log:
- `PrismaClient` missing / `@prisma/client` lỗi → chạy `pnpm prisma:generate`.
- `PORT` conflict (Next.js) → kiểm tra cổng đang bị chiếm: `lsof -i :3001 -P -n` rồi kill tiến trình nếu cần.
- Thiếu biến môi trường (OAUTH_STATE_SECRET, DATABASE_URL, NEXT_PUBLIC_API_URL) → so sánh `.env` vs `.env.example`.
- Next.js/TypeScript compile errors → chạy `pnpm --filter @nihongo-bjt/admin typecheck`.
- NestJS runtime errors (DB, env) → kiểm tra logs `api.dev.log` và `DATABASE_URL` connectivity (`psql` hoặc `pg_isready`).

4. Nếu cần ghi lại bước tái hiện cho team:
- Lưu logs (attach file) và copy đoạn stack trace + command dùng để reproducer.
- Ghi các bước môi trường (OS, node/pnpm versions, `.env` sample with placeholders).

--

## Kiểm tra nhanh endpoints Admin (manual)
- Validate portal session (Keycloak path):
```bash
curl -v http://localhost:4000/api/admin/session -H "Authorization: Bearer <token>"
# hoặc (dev legacy):
curl -v http://localhost:4000/api/admin/session -H "x-admin-actor-id: 00000000-0000-4000-8000-000000000001"
```
- Lấy principal `me` (hiển thị permission codes):
```bash
curl http://localhost:4000/api/admin/me -H "x-admin-actor-id: 00000000-0000-4000-8000-000000000001"
```
- Gọi User360 (yêu cầu header truy cập):
```bash
curl http://localhost:4000/api/admin/users/<userId> \
  -H "x-admin-actor-id: 00000000-0000-4000-8000-000000000001" \
  -H "x-admin-access-reason: 'support ticket #123'" \
  -H "x-admin-access-reason-category: support"
```
Lưu ý: `x-admin-access-reason` phải >=8 ký tự; `category` phải là một trong: `compliance|support|abuse|billing|other`.

--

## Admin production loop — checklist vận hành (Admin 100 / Admin completion)
Mục tiêu: xác minh `admin-module-inventory` → thực thi `must_ship_mvp` slices → browser phase-review → chuẩn bị evidence cho Release Director.

1. Làm mới inventory nguồn sự thật:
   - Mở `company/admin-module-inventory.md` và so sánh với file route thật trong `apps/admin/app/[locale]`.
   - Kiểm tra xem các route scaffold còn dùng `renderAdminScaffoldForId` chưa: 
   ```bash
grep -R -n "renderAdminScaffoldForId" apps/admin/app/[locale] | sed -n '1,200p'
   ```
   - Đếm scaffold routes:
   ```bash
grep -R -l renderAdminScaffoldForId apps/admin/app/[locale] | wc -l
   ```
2. Chạy kiểm thử và typecheck:
```bash
pnpm --filter @nihongo-bjt/api typecheck
pnpm --filter @nihongo-bjt/admin typecheck
pnpm -w exec turbo run typecheck
pnpm vitest --run # hoặc chỉ các tests liên quan
```
3. Chạy script audit (nếu repo có) hoặc thủ công reconcile `ADMIN_NAV_DATA` trong `apps/admin/lib/admin-nav-data.ts`.
4. Chạy browser phase-review (thu ảnh chụp UI để evidence):
   - Ví dụ command:
```bash
PHASE_ID=PHASE-10 \
BROWSER_REVIEW_APP=admin \
BROWSER_REVIEW_ROUTES=/vi,/vi/users/360,/vi/ops/feature-flags,/vi/analytics \
BROWSER_REVIEW_TIMEOUT_MS=120000 \
BROWSER_REVIEW_SERVER_TIMEOUT_MS=90000 \
pnpm browser:phase-review
```
   - `BROWSER_REVIEW_ROUTES` list dạng CSV các route path (after locale). Script sẽ chụp ảnh desktop/mobile theo cấu hình.
5. Ghi evidence vào `company/PHASE_TASK_REPORT.md` / `company/PHASE_REVIEW_PACKET.md`.
6. Gởi packet cho `bjt-release-director` để review must_ship deltas.

--

## Browser Phase-Review (Playwright) — hướng dẫn chạy
- Cài Playwright browser: `pnpm test:e2e:install` hoặc `pnpm exec playwright install chromium`.
- `pnpm test:e2e` sẽ tự động khởi động learner web (port 3000) nếu cần; để chạy review cho Admin (nếu Admin đang chạy trên 3001), dùng `pnpm test:e2e:local`.
- Để chạy browser-phase-review helper script (repo có sẵn): dùng biến môi trường như ví dụ ở trên và `pnpm browser:phase-review`.

--

## Checklist kiểm tra sau khi Admin chạy thành công
- [ ] `GET http://localhost:4000/api/health/live` → 200
- [ ] Admin shell vào được `http://localhost:3001/vi` và render nav
- [ ] `GET /api/admin/me` trả permissions cho admin test
- [ ] Browser phase-review chụp screenshot các route must_ship
- [ ] Tests & typecheck: pass

--

## Lưu ý vận hành & bảo mật
- Tuy UI che các hành động theo quyền, mọi check RBAC phải được áp dụng trên backend (`apps/api`), đừng bỏ qua.
- Không khởi động Admin production với `NEXT_PUBLIC_KEYCLOAK_ISSUER_URL` unset (trừ khi rõ ràng dùng legacy dev header): production luôn dùng Keycloak.
- Audit: mọi write/assign role đều được ghi bởi `admin-audit` (xem `apps/api/src/admin/admin-audit.*`).

--

## Khi cần trợ giúp
- Gửi `dev.log` và chỉ rõ command đã chạy, output lỗi chính, node/pnpm versions, `.env` (không chia secrets thực).
- Nếu muốn, tôi có thể:
  - Giúp chạy `pnpm dev` và thu logs (cần quyền chạy terminal tại máy bạn).
  - Chuẩn bị checklist E2E / browser-phase-review hoặc tạo ticket remediation.

--

_Last updated: tự động sinh từ mã nguồn (scan) — xem `docs/admin-guide` để các tập tin HTML/MD._
