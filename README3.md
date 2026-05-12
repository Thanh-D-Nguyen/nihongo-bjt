# Local Dev Setup — WSL Docker (máy này)

> Setup riêng cho máy phát triển hiện tại:
> - **Redis**: đã có sẵn trên WSL, `localhost:6379`
> - **Keycloak**: đã chạy sẵn trên port `9080`
> - **PostgreSQL, Meilisearch, MinIO**: chạy qua Docker trong WSL

---

## 1. Kiến trúc tổng quan

```
┌─────────────────────────────────────────────────────────────┐
│ Windows (Node.js apps)                                       │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │
│  │ API      │  │ Web      │  │ Admin    │                  │
│  │ :4000    │  │ :3000    │  │ :3001    │                  │
│  └──────────┘  └──────────┘  └──────────┘                  │
│       │              │              │                         │
├───────┼──────────────┼──────────────┼─────────────────────── │
│ WSL (Docker + Services)                                      │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │PostgreSQL│  │Meilisearch│  │  MinIO   │  │  Redis   │   │
│  │ :15432   │  │ :7700    │  │:9000/9001│  │ :6379    │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│                                                              │
│  ┌──────────┐                                               │
│  │ Keycloak │                                               │
│  │ :9080    │                                               │
│  └──────────┘                                               │
└─────────────────────────────────────────────────────────────┘
```

**Cổng chính:**

| Service      | Port       | Ghi chú                     |
|-------------|------------|------------------------------|
| API (Nest)  | 4000       | Windows, pnpm dev:api        |
| Web (Next)  | 3000       | Windows, pnpm dev:web        |
| Admin (Next)| 3001       | Windows, pnpm dev:admin      |
| PostgreSQL  | 15432      | Docker WSL, pg 15-alpine     |
| Redis       | 6379       | Có sẵn trong WSL             |
| Meilisearch | 7700       | Docker WSL                   |
| MinIO API   | 9000       | Docker WSL                   |
| MinIO Console| 9001      | Docker WSL                   |
| Keycloak    | 9080       | Có sẵn trong WSL             |

---

## 2. Chạy Docker services trong WSL

Mở terminal WSL và tạo file `docker-compose.local.yml`:

```bash
# Trong WSL, tạo thư mục nếu chưa có
mkdir -p ~/nihongo-bjt-docker && cd ~/nihongo-bjt-docker
```

Tạo file `docker-compose.local.yml` với nội dung:

```yaml
# ~/nihongo-bjt-docker/docker-compose.local.yml
# Chỉ những service cần Docker (Redis + Keycloak đã có sẵn)

services:
  postgres:
    image: postgres:15-alpine
    container_name: nihongo-bjt-postgres
    environment:
      POSTGRES_DB: nihongo_bjt
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "15432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d nihongo_bjt"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  meilisearch:
    image: getmeili/meilisearch:v1.13
    container_name: nihongo-bjt-meilisearch
    environment:
      MEILI_ENV: development
      MEILI_MASTER_KEY: local_dev_meili_master_key
    ports:
      - "7700:7700"
    volumes:
      - meilidata:/meili_data
    restart: unless-stopped

  minio:
    image: minio/minio:RELEASE.2025-04-22T22-12-26Z
    container_name: nihongo-bjt-minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - miniodata:/data
    restart: unless-stopped

volumes:
  pgdata:
  meilidata:
  miniodata:
```

**Chạy:**

```bash
cd ~/nihongo-bjt-docker
docker compose -f docker-compose.local.yml up -d
```

**Kiểm tra:**

```bash
docker ps
# Phải thấy 3 container: nihongo-bjt-postgres, nihongo-bjt-meilisearch, nihongo-bjt-minio
```

> **Lưu ý**: Image `postgres:15-alpine` đã có sẵn trong Docker. Nếu muốn dùng bản mới hơn (17), chạy `docker pull postgres:17-alpine` trước rồi đổi image trong file compose.

---

## 3. Kiểm tra kết nối từ Windows

```powershell
# PostgreSQL
psql -h localhost -p 15432 -U postgres -d nihongo_bjt -c "SELECT 1"

# Redis (dùng redis-cli hoặc telnet)
redis-cli -h localhost -p 6379 ping
# → PONG

# Meilisearch
curl http://localhost:7700/health
# → {"status":"available"}

# MinIO
curl http://localhost:9000/minio/health/live
# → OK (hoặc truy cập console: http://localhost:9001)

# Keycloak
curl http://localhost:9080/realms/nihongo-bjt/.well-known/openid-configuration
# (nếu realm đã import)
```

---

## 4. Cấu hình .env (root project)

Tạo file `.env` ở root project (Windows):

```bash
# Copy từ .env.example
cp .env.example .env
```

Sửa `.env` với giá trị cho máy này:

```env
NODE_ENV="development"

# === Database ===
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:15432/nihongo_bjt?schema=content"

# === App ports ===
API_PORT="4000"
API_PUBLIC_URL="http://localhost:4000"
WEB_PUBLIC_URL="http://localhost:3000"
ADMIN_PUBLIC_URL="http://localhost:3001"
CORS_ORIGINS="http://localhost:3000,http://localhost:3001"
NEXT_PUBLIC_API_URL="http://localhost:4000"
NEXT_PUBLIC_LOCAL_ADMIN_ACTOR_ID="00000000-0000-4000-8000-000000000001"

# === Redis (có sẵn trên WSL) ===
REDIS_URL="redis://localhost:6379"

# === Meilisearch ===
MEILI_HOST="http://localhost:7700"
MEILI_MASTER_KEY="local_dev_meili_master_key"

# === MinIO ===
MINIO_ENDPOINT="localhost"
MINIO_PORT="9000"
MINIO_ACCESS_KEY="minioadmin"
MINIO_SECRET_KEY="minioadmin"
MINIO_BUCKET="nihongo-bjt-media"
MINIO_USE_SSL="false"

# === Keycloak (port 9080 trên máy này) ===
KEYCLOAK_ISSUER_URL="http://localhost:9080/realms/nihongo-bjt"
KEYCLOAK_JWKS_URL="http://localhost:9080/realms/nihongo-bjt/protocol/openid-connect/certs"
KEYCLOAK_CLIENT_ID="nihongo-web"
KEYCLOAK_EXPECTED_AUDIENCE="nihongo-web,nihongo-admin"
KEYCLOAK_PUBLIC_URL="http://localhost:9080"

WEB_KEYCLOAK_ISSUER_URL="http://localhost:9080/realms/nihongo-bjt"
WEB_KEYCLOAK_CLIENT_ID="nihongo-web"
WEB_KEYCLOAK_CLIENT_SECRET="nihongo-web-dev-secret"

ADMIN_KEYCLOAK_ISSUER_URL="http://localhost:9080/realms/nihongo-bjt"
ADMIN_KEYCLOAK_CLIENT_ID="nihongo-admin"
ADMIN_KEYCLOAK_CLIENT_SECRET="nihongo-admin-dev-secret"

NEXT_PUBLIC_KEYCLOAK_URL="http://localhost:9080"
NEXT_PUBLIC_KEYCLOAK_REALM="nihongo-bjt"
NEXT_PUBLIC_WEB_KEYCLOAK_URL="http://localhost:9080"
NEXT_PUBLIC_WEB_KEYCLOAK_REALM="nihongo-bjt"
NEXT_PUBLIC_WEB_KEYCLOAK_CLIENT_ID="nihongo-web"
NEXT_PUBLIC_ADMIN_KEYCLOAK_URL="http://localhost:9080"
NEXT_PUBLIC_ADMIN_KEYCLOAK_REALM="nihongo-bjt"
NEXT_PUBLIC_ADMIN_KEYCLOAK_CLIENT_ID="nihongo-admin"
```

---

## 5. Cấu hình apps/web/.env.local

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_WEB_KEYCLOAK_URL=http://localhost:9080
NEXT_PUBLIC_WEB_KEYCLOAK_REALM=nihongo-bjt
NEXT_PUBLIC_WEB_KEYCLOAK_CLIENT_ID=nihongo-web

WEB_KEYCLOAK_ISSUER_URL=http://localhost:9080/realms/nihongo-bjt
WEB_KEYCLOAK_CLIENT_ID=nihongo-web
WEB_KEYCLOAK_CLIENT_SECRET=nihongo-web-dev-secret
WEB_PUBLIC_URL=http://localhost:3000

KEYCLOAK_ADMIN_USERNAME=admin
KEYCLOAK_ADMIN_PASSWORD=admin
```

---

## 6. Cấu hình apps/admin/.env.local

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_ADMIN_KEYCLOAK_URL=http://localhost:9080
NEXT_PUBLIC_ADMIN_KEYCLOAK_REALM=nihongo-bjt
NEXT_PUBLIC_ADMIN_KEYCLOAK_CLIENT_ID=nihongo-admin

ADMIN_KEYCLOAK_ISSUER_URL=http://localhost:9080/realms/nihongo-bjt
ADMIN_KEYCLOAK_CLIENT_ID=nihongo-admin
ADMIN_KEYCLOAK_CLIENT_SECRET=nihongo-admin-dev-secret
ADMIN_PUBLIC_URL=http://localhost:3001
```

---

## 7. Khởi tạo database + chạy app

```powershell
# Từ root project trên Windows

# 1. Cài dependencies (lần đầu)
pnpm install

# 2. Generate Prisma client
pnpm prisma:generate

# 3. Chạy migrations (tạo/cập nhật tables)
pnpm prisma:migrate

# 4. Seed dữ liệu nền (foundation data)
pnpm seed:foundation

# 5. Index Meilisearch
pnpm search:index

# 6. Seed daily content (tùy chọn)
pnpm daily:seed

# 7. Chạy dev (API + Web)
pnpm dev
# Hoặc chạy riêng:
#   pnpm dev:api     → http://localhost:4000
#   pnpm dev:web     → http://localhost:3000
#   pnpm dev:admin   → http://localhost:3001
```

### 7A. Sau khi pull commit mới có thay đổi database

Commit mới có thêm schema/table cho BJT lessons và NHK article persistence. Khi restart sau khi pull commit mới, chạy theo thứ tự này từ root project:

```powershell
# 1. Bật các services trước
# WSL:
cd ~/nihongo-bjt-docker
docker compose -f docker-compose.local.yml up -d

# 2. Quay lại root project trên Windows/macOS
pnpm install
pnpm prisma:validate

# 3. Apply migration đã có trong repo
pnpm exec prisma migrate deploy --schema packages/database/prisma/schema.prisma

# 4. Generate lại Prisma client
pnpm prisma:generate

# 5. Seed/backfill dữ liệu mới của commit này
node scripts/seed-bjt-lessons.mjs
node scripts/seed-career-rpg.mjs
node scripts/seed-daily-content.mjs
node scripts/seed-daily-content-vi.mjs

# 6. Rebuild projection search
pnpm search:index

# 7. Chạy app
pnpm dev:api
pnpm dev:web
pnpm dev:admin
```

Kiểm tra nhanh sau khi chạy:

```powershell
curl http://localhost:4000/api/health/live
curl http://localhost:4000/api/health/ready
curl "http://localhost:4000/api/levels/J5/lessons"
curl "http://localhost:4000/api/daily/home?locale=vi"
curl -I http://localhost:3000/vi
```

Ghi chú migration:

- Dùng `migrate deploy` cho luồng restart/pull commit vì lệnh này apply migration có sẵn và không cần shadow database.
- Nếu đang phát triển schema mới thì dùng `pnpm prisma:migrate -- --name ten_migration`, nhưng trên DB local hiện tại lệnh `migrate dev` có thể bị chặn bởi shadow database do migration cũ `20260429101000_add_leech_fields` tham chiếu `legal.consent_record` trước migration tạo bảng legal consent.
- Không dùng `prisma db push` cho luồng bình thường, trừ khi bạn chủ động chấp nhận DB local tạm lệch migration history.

---

## 8. Keycloak realm import (nếu chưa có realm nihongo-bjt)

Nếu Keycloak trên port 9080 chưa có realm `nihongo-bjt`, import realm:

```bash
# Trong WSL, copy realm-export.json từ project vào container keycloak
# Hoặc dùng kcadm để import

# Cách 1: Qua Keycloak Admin UI
# Truy cập http://localhost:9080/admin → Realm dropdown → Create realm → Import JSON
# File: docker/keycloak/realm-export.json (trong project)

# Cách 2: Dùng kcadm.sh (nếu keycloak chạy qua docker)
# docker exec -it <keycloak-container> /opt/keycloak/bin/kcadm.sh config credentials \
#   --server http://127.0.0.1:8080 --realm master --user admin --password admin
# docker exec -it <keycloak-container> /opt/keycloak/bin/kcadm.sh create realms \
#   -f /tmp/realm-export.json
```

Sau khi import, cần đảm bảo:
- Realm `nihongo-bjt` có `sslRequired: NONE` (dev mode)
- Client `nihongo-web`: secret = `nihongo-web-dev-secret`, Direct Access Grants = ON
- Client `nihongo-admin`: secret = `nihongo-admin-dev-secret`, Direct Access Grants = ON

---

## 9. Tạo MinIO bucket (lần đầu)

Truy cập MinIO Console: http://localhost:9001
- Login: `minioadmin` / `minioadmin`
- Tạo bucket: `nihongo-bjt-media`
- Set policy: `public` (cho dev)

Hoặc dùng `mc` CLI trong WSL:

```bash
# Cài mc (nếu chưa có)
curl -O https://dl.min.io/client/mc/release/linux-amd64/mc
chmod +x mc && sudo mv mc /usr/local/bin/

# Config
mc alias set local http://localhost:9000 minioadmin minioadmin

# Tạo bucket
mc mb local/nihongo-bjt-media

# Set public (dev only)
mc anonymous set download local/nihongo-bjt-media
```

---

## 10. Lệnh hằng ngày

```powershell
# --- Bật services (WSL terminal) ---
cd ~/nihongo-bjt-docker && docker compose -f docker-compose.local.yml up -d

# --- Chạy dev (Windows terminal, từ project root) ---
pnpm dev

# --- Tắt services (WSL terminal) ---
cd ~/nihongo-bjt-docker && docker compose -f docker-compose.local.yml down

# --- Xem logs ---
docker logs nihongo-bjt-postgres --tail 20
docker logs nihongo-bjt-meilisearch --tail 20
docker logs nihongo-bjt-minio --tail 20
```

---

## 11. Troubleshooting

| Vấn đề | Giải pháp |
|--------|-----------|
| `ECONNREFUSED :15432` | Kiểm tra docker ps, postgres container phải running |
| `ECONNREFUSED :6379` | Kiểm tra redis: `redis-cli ping` trong WSL |
| `ECONNREFUSED :7700` | Meilisearch chưa start: `docker logs nihongo-bjt-meilisearch` |
| `ECONNREFUSED :9080` | Keycloak chưa chạy, start lại service |
| Prisma migrate lỗi | Đảm bảo DATABASE_URL đúng, postgres healthy |
| `prisma migrate dev` lỗi shadow database `legal.consent_record` | Với restart sau pull commit, dùng `pnpm exec prisma migrate deploy --schema packages/database/prisma/schema.prisma`. Chỉ sửa migration history khi đang phát triển schema mới |
| Keycloak `HTTPS required` | Set `sslRequired=NONE` cho realm master + nihongo-bjt |
| MinIO `bucket not found` | Tạo bucket theo bước 9 |
| Port conflict | Kiểm tra process: `lsof -nP -iTCP:3001 -sTCP:LISTEN`. Nếu process cũ không cần nữa thì tắt nó trước khi chạy `pnpm dev:admin`; nếu đổi port thì cập nhật cả `.env`/`.env.local` tương ứng |
| WSL không thấy từ Windows | Kiểm tra: `wsl hostname -I` → dùng IP đó hoặc localhost |

---

## 12. Khác biệt với cấu hình chuẩn (README.md)

| Mục | README.md (chuẩn) | Máy này |
|-----|-------------------|---------|
| Redis | Docker container, port 6379 | Có sẵn trong WSL, port 6379 |
| Keycloak | Docker, port 8080 | Có sẵn, port **9080** |
| PostgreSQL | Docker, postgres:17 | Docker WSL, postgres:**15-alpine** (đã có image) |
| Meilisearch | Docker, v1.13 | Docker WSL, v1.13 (pull mới) |
| MinIO | Docker | Docker WSL |
| Node apps | Windows trực tiếp | Windows trực tiếp (giống) |
| docker-compose | Root `docker-compose.yml` | `~/nihongo-bjt-docker/docker-compose.local.yml` riêng |

---

## Quick Start (TL;DR)

```bash
# 1. WSL: Start docker services
cd ~/nihongo-bjt-docker && docker compose -f docker-compose.local.yml up -d

# 2. Windows: Setup (lần đầu)
pnpm install
pnpm prisma:validate
pnpm exec prisma migrate deploy --schema packages/database/prisma/schema.prisma
pnpm prisma:generate
pnpm seed:foundation
node scripts/seed-bjt-lessons.mjs
node scripts/seed-career-rpg.mjs
node scripts/seed-daily-content.mjs
node scripts/seed-daily-content-vi.mjs
pnpm search:index

# 3. Windows: Dev hằng ngày
pnpm dev
# → API: http://localhost:4000
# → Web: http://localhost:3000
# → Admin: http://localhost:3001
```


Username	Password	Role
testuser	123456	user (learner)
localadmin	admin	admin
