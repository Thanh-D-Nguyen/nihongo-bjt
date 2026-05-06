# NihonGo BJT — Production Configuration Guide

> Tài liệu cấu hình production đầy đủ cho toàn bộ hệ thống NihonGo BJT.
> Cập nhật: 2026-05-02

---

## Mục lục

1. [Tổng quan kiến trúc](#1-tổng-quan-kiến-trúc)
2. [Yêu cầu hạ tầng](#2-yêu-cầu-hạ-tầng)
3. [Danh sách dịch vụ & port](#3-danh-sách-dịch-vụ--port)
4. [Cấu hình từng dịch vụ](#4-cấu-hình-từng-dịch-vụ)
   - 4.1 [PostgreSQL](#41-postgresql)
   - 4.2 [Redis](#42-redis)
   - 4.3 [Meilisearch](#43-meilisearch)
   - 4.4 [MinIO / S3](#44-minio--s3)
   - 4.5 [Keycloak](#45-keycloak)
   - 4.6 [API (NestJS)](#46-api-nestjs)
   - 4.7 [Web (Next.js — Learner)](#47-web-nextjs--learner)
   - 4.8 [Admin (Next.js — Admin)](#48-admin-nextjs--admin)
5. [Environment Variables — Toàn bộ](#5-environment-variables--toàn-bộ)
6. [Secrets Management](#6-secrets-management)
7. [SSL/TLS & Domain](#7-ssltls--domain)
8. [Reverse Proxy / Load Balancer](#8-reverse-proxy--load-balancer)
9. [Docker Compose Production](#9-docker-compose-production)
10. [Health Checks & Monitoring](#10-health-checks--monitoring)
11. [Backup & Recovery](#11-backup--recovery)
12. [Security Hardening Checklist](#12-security-hardening-checklist)
13. [Production Deployment Checklist](#13-production-deployment-checklist)

---

## 1. Tổng quan kiến trúc

```
                    ┌──────────────┐
                    │   Cloudflare  │  (CDN + WAF + SSL)
                    │   / Nginx     │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
        ┌─────▼─────┐ ┌───▼────┐ ┌────▼─────┐
        │  Web App   │ │  Admin │ │   API    │
        │  (Next.js) │ │(Next.js│ │ (NestJS) │
        │  Port 3000 │ │  3001) │ │ Port 4000│
        └─────┬──────┘ └───┬────┘ └──┬──┬────┘
              │             │         │  │
              └─────────────┼─────────┘  │
                            │            │
     ┌──────────────────────┼────────────┼──────────────┐
     │                      │            │              │
┌────▼─────┐ ┌──────▼──────┐ ┌──▼───────┐ ┌──▼──────────┐
│ Keycloak │ │  PostgreSQL  │ │  Redis   │ │ Meilisearch │
│ Port 8080│ │  Port 5432   │ │ Port 6379│ │  Port 7700  │
└──────────┘ └──────────────┘ └──────────┘ └─────────────┘
                                                │
                                          ┌─────▼──────┐
                                          │ MinIO / S3  │
                                          │ Port 9000   │
                                          └─────────────┘
```

**Stack:**
- **Database:** PostgreSQL 17 + Prisma ORM
- **Cache/Queue:** Redis 8 (BullMQ jobs, session cache)
- **Search:** Meilisearch v1.13 (full-text, projection)
- **Storage:** MinIO (S3-compatible) hoặc AWS S3
- **Auth:** Keycloak 26 (OIDC, RBAC, social login)
- **API:** NestJS (REST + Socket.IO)
- **Frontend:** Next.js 16 (Learner + Admin apps)

---

## 2. Yêu cầu hạ tầng

### Tối thiểu (MVP, < 1000 users)

| Resource | Spec |
|----------|------|
| VPS / VM | 4 vCPU, 8 GB RAM, 100 GB SSD |
| Database | PostgreSQL 17 (cùng máy hoặc managed) |
| Redis | Redis 8 (cùng máy) |
| OS | Ubuntu 24.04 LTS hoặc Debian 12 |
| Docker | Docker Engine 27+ với Docker Compose v2 |

### Khuyến nghị (Production, 1000–50,000 users)

| Resource | Spec |
|----------|------|
| API Server | 2× (4 vCPU, 8 GB RAM) — load balanced |
| Web/Admin | 2× (2 vCPU, 4 GB RAM) hoặc Vercel/serverless |
| Database | Managed PostgreSQL (AWS RDS / GCP Cloud SQL / DO Managed DB) — 4 vCPU, 16 GB RAM, 200 GB SSD |
| Redis | Managed Redis (AWS ElastiCache / Upstash) — 2 GB RAM |
| Meilisearch | 1× (2 vCPU, 4 GB RAM, 50 GB SSD) |
| MinIO/S3 | AWS S3 hoặc self-hosted MinIO cluster |
| Keycloak | 1× (2 vCPU, 4 GB RAM) với PostgreSQL backend |
| CDN | Cloudflare / AWS CloudFront |

---

## 3. Danh sách dịch vụ & port

| Service | Internal Port | External Port (qua Proxy) | Protocol |
|---------|--------------|---------------------------|----------|
| **API (NestJS)** | 4000 | 443 (api.nihongo-bjt.com) | HTTPS |
| **Web (Next.js Learner)** | 3000 | 443 (nihongo-bjt.com) | HTTPS |
| **Admin (Next.js Admin)** | 3001 | 443 (admin.nihongo-bjt.com) | HTTPS |
| **Keycloak** | 8080 | 443 (auth.nihongo-bjt.com) | HTTPS |
| **PostgreSQL** | 5432 | — (internal only) | TCP |
| **Redis** | 6379 | — (internal only) | TCP |
| **Meilisearch** | 7700 | — (internal only) | HTTP |
| **MinIO API** | 9000 | — (internal hoặc CDN) | HTTP/S |
| **MinIO Console** | 9001 | — (admin VPN only) | HTTPS |
| **Socket.IO** | 4000 | 443 (api.nihongo-bjt.com) | WSS |

> ⚠️ PostgreSQL, Redis, Meilisearch, MinIO **KHÔNG** expose ra internet. Chỉ accessible qua internal network hoặc VPN.

---

## 4. Cấu hình từng dịch vụ

### 4.1 PostgreSQL

**Version:** 17

**Production config (`postgresql.conf`):**
```ini
# Connection
max_connections = 200
listen_addresses = '0.0.0.0'       # Chỉ bind nếu trong private network

# Memory — tune theo RAM (ví dụ 16 GB server)
shared_buffers = 4GB
effective_cache_size = 12GB
work_mem = 64MB
maintenance_work_mem = 512MB

# WAL & Replication
wal_level = replica
max_wal_senders = 5
wal_keep_size = 1GB

# Logging
log_min_duration_statement = 500   # Log queries > 500ms
log_statement = 'ddl'
log_connections = on
log_disconnections = on
log_line_prefix = '%m [%p] %q%u@%d '

# Security
ssl = on
ssl_cert_file = '/etc/ssl/certs/server.crt'
ssl_key_file = '/etc/ssl/private/server.key'
password_encryption = scram-sha-256
```

**Production `pg_hba.conf`:**
```
# TYPE  DATABASE        USER            ADDRESS                 METHOD
local   all             postgres                                peer
host    nihongo_bjt     nihongo_app     10.0.0.0/8              scram-sha-256
host    nihongo_bjt     nihongo_app     172.16.0.0/12           scram-sha-256
hostssl nihongo_bjt     nihongo_app     0.0.0.0/0               scram-sha-256
# Deny all other connections
host    all             all             0.0.0.0/0               reject
```

**Schema cần có:**
- `public` — default
- `learning` — BJT content, battle, quiz, flashcard
- `authz` — RBAC, admin actors, audit log
- `growth` — sharing, referrals, streaks

**DATABASE_URL format:**
```
postgresql://nihongo_app:<STRONG_PASSWORD>@<DB_HOST>:5432/nihongo_bjt?schema=public&sslmode=require
```

**Prisma migration (chạy khi deploy):**
```bash
npx prisma migrate deploy
```

---

### 4.2 Redis

**Version:** 8 (Alpine)

**Production config (`redis.conf`):**
```ini
# Network
bind 10.0.0.0/8 172.16.0.0/12      # Private network only
port 6379
protected-mode yes

# Auth
requirepass <STRONG_REDIS_PASSWORD>

# Memory
maxmemory 2gb
maxmemory-policy allkeys-lru

# Persistence
save 900 1
save 300 10
save 60 10000
appendonly yes
appendfsync everysec

# Security
rename-command FLUSHALL ""
rename-command FLUSHDB ""
rename-command CONFIG ""
rename-command DEBUG ""

# TLS (nếu Redis expose qua network)
# tls-port 6380
# tls-cert-file /etc/ssl/redis/redis.crt
# tls-key-file /etc/ssl/redis/redis.key
# tls-ca-cert-file /etc/ssl/redis/ca.crt
```

**REDIS_URL format:**
```
redis://:<STRONG_REDIS_PASSWORD>@<REDIS_HOST>:6379/0
```

**Dùng cho:**
- BullMQ job queue (background jobs)
- Socket.IO adapter (nếu multi-instance API)
- Rate limiting cache

---

### 4.3 Meilisearch

**Version:** v1.13

**Production config:**
```bash
# Chạy Meilisearch production
meilisearch \
  --env production \
  --master-key "<MEILI_MASTER_KEY_MIN_16_CHARS>" \
  --http-addr 0.0.0.0:7700 \
  --db-path /data/meilisearch \
  --max-indexing-memory 1GiB \
  --max-indexing-threads 2 \
  --log-level WARN
```

**Docker env:**
```yaml
environment:
  MEILI_ENV: production
  MEILI_MASTER_KEY: <GENERATE_RANDOM_64_CHAR_KEY>
  MEILI_NO_ANALYTICS: "true"
```

> ⚠️ `MEILI_ENV=production` bắt buộc — nếu không set, Meilisearch không yêu cầu API key.

**Indexes cần sync:**
- `bjt_questions` — câu hỏi BJT
- `lexemes` — từ vựng/grammar
- `flashcards` — bộ thẻ flashcard

---

### 4.4 MinIO / S3

**Tùy chọn A: AWS S3 (khuyến nghị production)**

Dùng S3 trực tiếp, config MinIO env vars tương ứng:

```env
MINIO_ENDPOINT=s3.ap-northeast-1.amazonaws.com
MINIO_PORT=443
MINIO_ACCESS_KEY=<AWS_ACCESS_KEY_ID>
MINIO_SECRET_KEY=<AWS_SECRET_ACCESS_KEY>
MINIO_BUCKET=nihongo-bjt-media
MINIO_USE_SSL=true
```

**S3 Bucket policy:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadMedia",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::nihongo-bjt-media/public/*"
    }
  ]
}
```

**IAM Policy cho app:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::nihongo-bjt-media",
        "arn:aws:s3:::nihongo-bjt-media/*"
      ]
    }
  ]
}
```

**Tùy chọn B: Self-hosted MinIO**

```yaml
services:
  minio:
    image: minio/minio:RELEASE.2025-04-22T22-12-26Z
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: <MINIO_ADMIN_USER>
      MINIO_ROOT_PASSWORD: <MINIO_ADMIN_PASSWORD_MIN_12_CHARS>
    volumes:
      - /data/minio:/data
    # KHÔNG expose port 9000/9001 ra internet
    # Chỉ internal network
```

---

### 4.5 Keycloak

**Version:** 26.2.4

**Production deployment:**
```yaml
services:
  keycloak:
    image: quay.io/keycloak/keycloak:26.2.4
    command:
      - start
      - --hostname=auth.nihongo-bjt.com
      - --https-certificate-file=/opt/keycloak/certs/tls.crt
      - --https-certificate-key-file=/opt/keycloak/certs/tls.key
      - --db=postgres
      - --db-url=jdbc:postgresql://<DB_HOST>:5432/keycloak
      - --db-username=keycloak_app
      - --db-password=<KC_DB_PASSWORD>
      - --http-enabled=false
      - --proxy-headers=xforwarded
    environment:
      KC_BOOTSTRAP_ADMIN_USERNAME: <KC_ADMIN_USER>
      KC_BOOTSTRAP_ADMIN_PASSWORD: <KC_ADMIN_STRONG_PASSWORD>
      KC_FEATURES: "token-exchange,admin-fine-grained-authz"
      KC_LOG_LEVEL: warn
      KC_METRICS_ENABLED: "true"
      KC_HEALTH_ENABLED: "true"
    volumes:
      - /etc/letsencrypt/live/auth.nihongo-bjt.com:/opt/keycloak/certs:ro
```

**Realm: `nihongo-bjt`**

Cần cấu hình:

| Item | Value |
|------|-------|
| **Realm name** | `nihongo-bjt` |
| **Login theme** | `nihongo` (custom) hoặc `keycloak.v2` |
| **Registration** | Enabled (with email verification) |
| **Email verification** | Required |
| **Login with email** | Allowed |
| **Edit username** | Disabled |
| **Remember me** | Enabled |
| **SSL required** | `all` (production) |

**Clients cần tạo:**

#### Client: `nihongo-web` (Learner app)
| Setting | Value |
|---------|-------|
| Client Protocol | openid-connect |
| Access Type | confidential |
| Direct Access Grants | Enabled |
| Valid Redirect URIs | `https://nihongo-bjt.com/*` |
| Web Origins | `https://nihongo-bjt.com` |
| Client Secret | `<GENERATE>` → dùng cho `WEB_KEYCLOAK_CLIENT_SECRET` |

#### Client: `nihongo-admin` (Admin app)
| Setting | Value |
|---------|-------|
| Client Protocol | openid-connect |
| Access Type | confidential |
| Valid Redirect URIs | `https://admin.nihongo-bjt.com/*` |
| Web Origins | `https://admin.nihongo-bjt.com` |
| Client Secret | `<GENERATE>` → dùng cho `ADMIN_KEYCLOAK_CLIENT_SECRET` |

#### Client: `nihongo-api` (API service account — optional)
| Setting | Value |
|---------|-------|
| Client Protocol | openid-connect |
| Access Type | confidential |
| Service Account | Enabled |
| Roles | `manage-users`, `query-users`, `view-users` (realm-management) |
| Client Secret | `<GENERATE>` → dùng cho `KEYCLOAK_USER_ADMIN_CLIENT_SECRET` |

**Identity Providers (Social Login):**

| Provider | Alias | Config |
|----------|-------|--------|
| Google | `google` | Client ID + Secret từ Google Cloud Console |
| Facebook | `facebook` | App ID + Secret từ Meta Developer |
| Apple | `apple` | Service ID + Key từ Apple Developer |
| LINE | `line` | Channel ID + Secret từ LINE Developers |

**Realm Roles:**
| Role | Purpose |
|------|---------|
| `admin` | Full admin access |
| `moderator` | Content moderation |
| `user` | Default learner role |

---

### 4.6 API (NestJS)

**Build:**
```bash
cd apps/api
pnpm build
```

**Run:**
```bash
NODE_ENV=production node dist/main.js
```

**PM2 ecosystem (khuyến nghị):**
```javascript
// ecosystem.config.cjs
module.exports = {
  apps: [{
    name: 'nihongo-api',
    script: './apps/api/dist/main.js',
    instances: 'max',          // Cluster mode
    exec_mode: 'cluster',
    max_memory_restart: '1G',
    env_production: {
      NODE_ENV: 'production',
      API_PORT: 4000
    }
  }]
};
```

> ⚠️ Nếu chạy cluster mode, cần Redis adapter cho Socket.IO:
> ```typescript
> // Socket.IO Redis adapter (đã có hỗ trợ qua REDIS_URL)
> ```

**Full env vars cho API:** Xem [Section 5](#5-environment-variables--toàn-bộ).

---

### 4.7 Web (Next.js — Learner)

**Build:**
```bash
cd apps/web
pnpm build
```

**Run:**
```bash
NODE_ENV=production PORT=3000 pnpm start
```

**Hoặc deploy lên Vercel:**
- Framework: Next.js
- Root directory: `apps/web`
- Build command: `pnpm build`
- Install command: `pnpm install`
- Environment variables: set trên Vercel dashboard

---

### 4.8 Admin (Next.js — Admin)

**Build:**
```bash
cd apps/admin
pnpm build
```

**Run:**
```bash
NODE_ENV=production PORT=3001 pnpm start
```

**⚠️ Admin app chỉ accessible cho internal team:**
- IP whitelist qua Cloudflare Access / VPN
- Hoặc basic auth ở reverse proxy layer

---

## 5. Environment Variables — Toàn bộ

### 5.1 API Service (`apps/api/.env`)

```env
# ═══════════════════════════════════════════════════
# NihonGo BJT — API Production Environment
# ═══════════════════════════════════════════════════

# ─── Core ─────────────────────────────────────────
NODE_ENV=production
API_PORT=4000
API_PUBLIC_URL=https://api.nihongo-bjt.com
WEB_PUBLIC_URL=https://nihongo-bjt.com
ADMIN_PUBLIC_URL=https://admin.nihongo-bjt.com
CORS_ORIGINS=https://nihongo-bjt.com,https://admin.nihongo-bjt.com

# ─── Database ────────────────────────────────────
DATABASE_URL=postgresql://nihongo_app:<DB_PASSWORD>@<DB_HOST>:5432/nihongo_bjt?schema=public&sslmode=require

# ─── Redis ────────────────────────────────────────
REDIS_URL=redis://:<REDIS_PASSWORD>@<REDIS_HOST>:6379/0

# ─── Meilisearch ─────────────────────────────────
MEILI_HOST=http://<MEILI_HOST>:7700
MEILI_MASTER_KEY=<MEILI_MASTER_KEY_64_CHARS>

# ─── Object Storage (S3/MinIO) ───────────────────
MINIO_ENDPOINT=s3.ap-northeast-1.amazonaws.com
MINIO_PORT=443
MINIO_ACCESS_KEY=<AWS_ACCESS_KEY_ID>
MINIO_SECRET_KEY=<AWS_SECRET_ACCESS_KEY>
MINIO_BUCKET=nihongo-bjt-media
MINIO_USE_SSL=true

# ─── Keycloak (JWT validation) ───────────────────
KEYCLOAK_ISSUER_URL=https://auth.nihongo-bjt.com/realms/nihongo-bjt
KEYCLOAK_CLIENT_ID=nihongo-web
KEYCLOAK_EXPECTED_AUDIENCE=nihongo-web,nihongo-admin

# ─── Keycloak Admin REST (user management) ───────
# Option A: Service account client (khuyến nghị production)
KEYCLOAK_USER_ADMIN_CLIENT_ID=nihongo-api
KEYCLOAK_USER_ADMIN_CLIENT_SECRET=<API_SERVICE_ACCOUNT_SECRET>
KEYCLOAK_USER_ADMIN_TARGET_REALM=nihongo-bjt

# Option B: Admin username/password (KHÔNG khuyến nghị production)
# KEYCLOAK_ADMIN_USERNAME=admin
# KEYCLOAK_ADMIN_PASSWORD=<ADMIN_PASSWORD>

# ─── Keycloak RBAC ───────────────────────────────
KEYCLOAK_ADMIN_REALM_ROLES=admin
KEYCLOAK_ADMIN_INTERNAL_ROLE_ALIASES=admin:admin.super,superadmin:admin.super,moderator:content.manage

# ─── Swagger / OpenAPI ───────────────────────────
SWAGGER_ENABLED=false
# Set true nếu muốn expose API docs (protect bằng gateway auth)

# ─── Version ─────────────────────────────────────
APP_VERSION=1.0.0

# ─── Test Bypass ─────────────────────────────────
# KHÔNG bao giờ set trong production
# ADMIN_TEST_BYPASS=0
```

### 5.2 Web Service (`apps/web/.env`)

```env
# ═══════════════════════════════════════════════════
# NihonGo BJT — Web (Learner) Production Environment
# ═══════════════════════════════════════════════════

# ─── URLs ─────────────────────────────────────────
WEB_PUBLIC_URL=https://nihongo-bjt.com
NEXT_PUBLIC_API_URL=https://api.nihongo-bjt.com

# ─── Database (cho Prisma — nếu web cần direct DB) ───
DATABASE_URL=postgresql://nihongo_app:<DB_PASSWORD>@<DB_HOST>:5432/nihongo_bjt?schema=public&sslmode=require

# ─── Keycloak OIDC (Public — browser) ────────────
NEXT_PUBLIC_WEB_KEYCLOAK_URL=https://auth.nihongo-bjt.com
NEXT_PUBLIC_WEB_KEYCLOAK_REALM=nihongo-bjt
NEXT_PUBLIC_WEB_KEYCLOAK_CLIENT_ID=nihongo-web
# Hoặc dùng issuer URL trực tiếp:
# NEXT_PUBLIC_WEB_KEYCLOAK_ISSUER_URL=https://auth.nihongo-bjt.com/realms/nihongo-bjt

# ─── Keycloak OIDC (Server-side — Next.js Route Handlers) ───
WEB_KEYCLOAK_ISSUER_URL=https://auth.nihongo-bjt.com/realms/nihongo-bjt
WEB_KEYCLOAK_CLIENT_ID=nihongo-web
WEB_KEYCLOAK_CLIENT_SECRET=<WEB_CLIENT_SECRET>

# ─── Keycloak Admin REST (registration, password reset) ───
# Dùng service account (khuyến nghị):
KEYCLOAK_USER_ADMIN_CLIENT_ID=nihongo-api
KEYCLOAK_USER_ADMIN_CLIENT_SECRET=<API_SERVICE_ACCOUNT_SECRET>
# Hoặc admin credentials (KHÔNG khuyến nghị):
# KEYCLOAK_ADMIN_USERNAME=<admin>
# KEYCLOAK_ADMIN_PASSWORD=<password>

# ─── OAuth State Secret ──────────────────────────
OAUTH_STATE_SECRET=<RANDOM_64_CHAR_HEX_STRING>

# ─── Social Login (IdP Hints) ────────────────────
# Để trống hoặc xóa dòng để ẩn nút social login tương ứng
NEXT_PUBLIC_AUTH_GOOGLE_IDP_HINT=google
NEXT_PUBLIC_AUTH_FACEBOOK_IDP_HINT=facebook
NEXT_PUBLIC_AUTH_APPLE_IDP_HINT=apple
NEXT_PUBLIC_AUTH_LINE_IDP_HINT=line

# ─── Feature Flags ───────────────────────────────
NEXT_PUBLIC_AUTH_REGISTRATION_ENABLED=true
```

### 5.3 Admin Service (`apps/admin/.env`)

```env
# ═══════════════════════════════════════════════════
# NihonGo BJT — Admin Production Environment
# ═══════════════════════════════════════════════════

# ─── URLs ─────────────────────────────────────────
ADMIN_PUBLIC_URL=https://admin.nihongo-bjt.com
NEXT_PUBLIC_API_URL=https://api.nihongo-bjt.com

# ─── Database ────────────────────────────────────
DATABASE_URL=postgresql://nihongo_app:<DB_PASSWORD>@<DB_HOST>:5432/nihongo_bjt?schema=public&sslmode=require

# ─── Keycloak OIDC (Public — browser) ────────────
NEXT_PUBLIC_ADMIN_KEYCLOAK_URL=https://auth.nihongo-bjt.com
NEXT_PUBLIC_ADMIN_KEYCLOAK_REALM=nihongo-bjt
NEXT_PUBLIC_ADMIN_KEYCLOAK_CLIENT_ID=nihongo-admin

# ─── Keycloak OIDC (Server-side) ─────────────────
ADMIN_KEYCLOAK_ISSUER_URL=https://auth.nihongo-bjt.com/realms/nihongo-bjt
ADMIN_KEYCLOAK_CLIENT_ID=nihongo-admin
ADMIN_KEYCLOAK_CLIENT_SECRET=<ADMIN_CLIENT_SECRET>

# ─── Feature Flags ───────────────────────────────
# NEXT_PUBLIC_ADMIN_FEATURE_FLAGS={}

# ─── Version ─────────────────────────────────────
NEXT_PUBLIC_APP_ENV=production

# ─── Test Bypass — PHẢI TẮT trong production ─────
# NEXT_PUBLIC_ADMIN_TEST_BYPASS=  (không set hoặc xóa)
```

### 5.4 Bảng tổng hợp — Mọi biến cần set

| Variable | API | Web | Admin | Required | Sensitive |
|----------|:---:|:---:|:-----:|:--------:|:---------:|
| `NODE_ENV` | ✅ | ✅ | ✅ | ✅ | ❌ |
| `DATABASE_URL` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `REDIS_URL` | ✅ | ❌ | ❌ | ✅ | ✅ |
| `API_PORT` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `API_PUBLIC_URL` | ✅ | ❌ | ❌ | ✅ | ❌ |
| `WEB_PUBLIC_URL` | ✅ | ✅ | ❌ | ✅ | ❌ |
| `ADMIN_PUBLIC_URL` | ✅ | ❌ | ✅ | ✅ | ❌ |
| `NEXT_PUBLIC_API_URL` | ❌ | ✅ | ✅ | ✅ | ❌ |
| `CORS_ORIGINS` | ✅ | ❌ | ❌ | ✅ | ❌ |
| `MEILI_HOST` | ✅ | ❌ | ❌ | ✅ | ❌ |
| `MEILI_MASTER_KEY` | ✅ | ❌ | ❌ | ✅ | ✅ |
| `MINIO_ENDPOINT` | ✅ | ❌ | ❌ | ✅ | ❌ |
| `MINIO_PORT` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `MINIO_ACCESS_KEY` | ✅ | ❌ | ❌ | ✅ | ✅ |
| `MINIO_SECRET_KEY` | ✅ | ❌ | ❌ | ✅ | ✅ |
| `MINIO_BUCKET` | ✅ | ❌ | ❌ | ✅ | ❌ |
| `MINIO_USE_SSL` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `KEYCLOAK_ISSUER_URL` | ✅ | ❌ | ❌ | ✅ | ❌ |
| `KEYCLOAK_CLIENT_ID` | ✅ | ❌ | ❌ | ✅ | ❌ |
| `KEYCLOAK_EXPECTED_AUDIENCE` | ✅ | ❌ | ❌ | ✅ | ❌ |
| `WEB_KEYCLOAK_ISSUER_URL` | ❌ | ✅ | ❌ | ✅ | ❌ |
| `WEB_KEYCLOAK_CLIENT_ID` | ❌ | ✅ | ❌ | ✅ | ❌ |
| `WEB_KEYCLOAK_CLIENT_SECRET` | ❌ | ✅ | ❌ | ✅ | ✅ |
| `ADMIN_KEYCLOAK_ISSUER_URL` | ❌ | ❌ | ✅ | ✅ | ❌ |
| `ADMIN_KEYCLOAK_CLIENT_ID` | ❌ | ❌ | ✅ | ✅ | ❌ |
| `ADMIN_KEYCLOAK_CLIENT_SECRET` | ❌ | ❌ | ✅ | ✅ | ✅ |
| `KEYCLOAK_USER_ADMIN_CLIENT_ID` | ✅ | ✅ | ❌ | ⚡ | ❌ |
| `KEYCLOAK_USER_ADMIN_CLIENT_SECRET` | ✅ | ✅ | ❌ | ⚡ | ✅ |
| `KEYCLOAK_ADMIN_REALM_ROLES` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `OAUTH_STATE_SECRET` | ❌ | ✅ | ❌ | ✅ | ✅ |
| `NEXT_PUBLIC_WEB_KEYCLOAK_URL` | ❌ | ✅ | ❌ | ✅ | ❌ |
| `NEXT_PUBLIC_WEB_KEYCLOAK_REALM` | ❌ | ✅ | ❌ | ✅ | ❌ |
| `NEXT_PUBLIC_WEB_KEYCLOAK_CLIENT_ID` | ❌ | ✅ | ❌ | ✅ | ❌ |
| `NEXT_PUBLIC_ADMIN_KEYCLOAK_URL` | ❌ | ❌ | ✅ | ✅ | ❌ |
| `NEXT_PUBLIC_ADMIN_KEYCLOAK_REALM` | ❌ | ❌ | ✅ | ✅ | ❌ |
| `NEXT_PUBLIC_ADMIN_KEYCLOAK_CLIENT_ID` | ❌ | ❌ | ✅ | ✅ | ❌ |
| `NEXT_PUBLIC_AUTH_GOOGLE_IDP_HINT` | ❌ | ✅ | ❌ | ❌ | ❌ |
| `NEXT_PUBLIC_AUTH_FACEBOOK_IDP_HINT` | ❌ | ✅ | ❌ | ❌ | ❌ |
| `NEXT_PUBLIC_AUTH_APPLE_IDP_HINT` | ❌ | ✅ | ❌ | ❌ | ❌ |
| `NEXT_PUBLIC_AUTH_LINE_IDP_HINT` | ❌ | ✅ | ❌ | ❌ | ❌ |
| `NEXT_PUBLIC_AUTH_REGISTRATION_ENABLED` | ❌ | ✅ | ❌ | ❌ | ❌ |
| `SWAGGER_ENABLED` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `APP_VERSION` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `NEXT_PUBLIC_APP_ENV` | ❌ | ❌ | ✅ | ❌ | ❌ |

> ⚡ = Required nếu dùng self-service registration / forgot-password

---

## 6. Secrets Management

### 6.1 Danh sách secrets cần generate

```bash
# 1. Database password
openssl rand -base64 32
# → DATABASE_URL password component

# 2. Redis password
openssl rand -base64 32
# → REDIS_URL password component

# 3. Meilisearch master key
openssl rand -hex 32
# → MEILI_MASTER_KEY

# 4. MinIO/S3 credentials
# Dùng AWS IAM hoặc MinIO admin console

# 5. Keycloak admin password
openssl rand -base64 24
# → KC_BOOTSTRAP_ADMIN_PASSWORD

# 6. OAuth state secret (min 32 chars)
openssl rand -hex 32
# → OAUTH_STATE_SECRET

# 7. Keycloak client secrets
# Generate trong Keycloak Admin Console > Clients > Credentials
```

### 6.2 Nơi lưu secrets

| Environment | Solution |
|-------------|----------|
| **Local dev** | `.env` files (gitignored) |
| **CI/CD** | GitHub Actions Secrets / GitLab CI Variables |
| **VPS** | Docker secrets + env_file (chmod 600) |
| **Cloud** | AWS Secrets Manager / GCP Secret Manager / Vault |
| **Vercel** | Vercel Environment Variables (encrypted) |
| **Kubernetes** | K8s Secrets (encrypted at rest) |

### 6.3 Quy tắc bảo mật secrets

- ❌ KHÔNG commit `.env` vào git
- ❌ KHÔNG log secrets ra stdout/stderr
- ❌ KHÔNG để secrets trong Docker image
- ✅ Rotate secrets mỗi 90 ngày
- ✅ Dùng least-privilege IAM/service accounts
- ✅ Encrypt secrets at rest
- ✅ Audit secret access

---

## 7. SSL/TLS & Domain

### 7.1 Domain setup

| Subdomain | Service | DNS Record |
|-----------|---------|------------|
| `nihongo-bjt.com` | Web (Learner) | A / CNAME → Load Balancer |
| `api.nihongo-bjt.com` | API | A / CNAME → Load Balancer |
| `admin.nihongo-bjt.com` | Admin | A / CNAME → Load Balancer |
| `auth.nihongo-bjt.com` | Keycloak | A / CNAME → Keycloak server |
| `media.nihongo-bjt.com` | CDN (S3/MinIO) | CNAME → CloudFront/Cloudflare |

### 7.2 SSL Certificates

**Option A: Cloudflare (khuyến nghị)**
- Full (strict) SSL mode
- Auto-renewing edge certificates
- Origin certificates cho backend

**Option B: Let's Encrypt + Certbot**
```bash
certbot certonly --dns-cloudflare \
  -d nihongo-bjt.com \
  -d "*.nihongo-bjt.com" \
  --dns-cloudflare-credentials /etc/letsencrypt/cloudflare.ini
```

**Option C: AWS ACM**
- Free managed certificates cho ALB/CloudFront

### 7.3 TLS Configuration

```nginx
# Minimum TLS 1.2, prefer 1.3
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
ssl_prefer_server_ciphers off;
ssl_session_timeout 1d;
ssl_session_cache shared:SSL:10m;
ssl_session_tickets off;

# HSTS
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
```

---

## 8. Reverse Proxy / Load Balancer

### Nginx Configuration

```nginx
# ─── API (NestJS + Socket.IO) ─────────────────────
upstream api_backend {
    server 127.0.0.1:4000;
    # Thêm server nếu multi-instance:
    # server 127.0.0.1:4001;
    keepalive 32;
}

server {
    listen 443 ssl http2;
    server_name api.nihongo-bjt.com;

    ssl_certificate /etc/letsencrypt/live/nihongo-bjt.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/nihongo-bjt.com/privkey.pem;

    # Security headers
    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options DENY always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=30r/s;

    location / {
        limit_req zone=api_limit burst=50 nodelay;
        proxy_pass http://api_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Body limits
        client_max_body_size 50m;
    }

    # Socket.IO — WebSocket upgrade
    location /socket.io/ {
        proxy_pass http://api_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}

# ─── Web (Learner) ────────────────────────────────
upstream web_backend {
    server 127.0.0.1:3000;
    keepalive 16;
}

server {
    listen 443 ssl http2;
    server_name nihongo-bjt.com www.nihongo-bjt.com;

    ssl_certificate /etc/letsencrypt/live/nihongo-bjt.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/nihongo-bjt.com/privkey.pem;

    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options SAMEORIGIN always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://media.nihongo-bjt.com; connect-src 'self' https://api.nihongo-bjt.com wss://api.nihongo-bjt.com https://auth.nihongo-bjt.com;" always;

    location / {
        proxy_pass http://web_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Static assets caching
    location /_next/static/ {
        proxy_pass http://web_backend;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}

# ─── Admin (restrict access) ──────────────────────
upstream admin_backend {
    server 127.0.0.1:3001;
    keepalive 8;
}

server {
    listen 443 ssl http2;
    server_name admin.nihongo-bjt.com;

    ssl_certificate /etc/letsencrypt/live/nihongo-bjt.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/nihongo-bjt.com/privkey.pem;

    # IP Whitelist — chỉ cho team access
    # allow 1.2.3.4;     # Office IP
    # allow 5.6.7.8;     # VPN IP
    # deny all;
    # Hoặc dùng Cloudflare Access / Tailscale

    location / {
        proxy_pass http://admin_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# ─── Keycloak ─────────────────────────────────────
server {
    listen 443 ssl http2;
    server_name auth.nihongo-bjt.com;

    ssl_certificate /etc/letsencrypt/live/nihongo-bjt.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/nihongo-bjt.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffer_size 128k;
        proxy_buffers 4 256k;
    }

    # Block admin console in production (hoặc restrict IP)
    location /admin/ {
        # allow 1.2.3.4;    # Admin IP only
        # deny all;
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# ─── HTTP → HTTPS redirect ────────────────────────
server {
    listen 80;
    server_name nihongo-bjt.com www.nihongo-bjt.com api.nihongo-bjt.com admin.nihongo-bjt.com auth.nihongo-bjt.com;
    return 301 https://$host$request_uri;
}
```

---

## 9. Docker Compose Production

```yaml
# docker-compose.production.yml
version: "3.9"

services:
  # ─── Database ──────────────────────────────────
  postgres:
    image: postgres:17-alpine
    container_name: nihongo-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: nihongo_bjt
      POSTGRES_USER: nihongo_app
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
    ports:
      - "127.0.0.1:5432:5432"   # Internal only
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./docker/postgres/postgresql.conf:/etc/postgresql/postgresql.conf:ro
    command: postgres -c config_file=/etc/postgresql/postgresql.conf
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U nihongo_app -d nihongo_bjt"]
      interval: 10s
      timeout: 5s
      retries: 5
    secrets:
      - db_password
    deploy:
      resources:
        limits:
          memory: 4G

  # ─── Keycloak DB (separate) ────────────────────
  keycloak-db:
    image: postgres:17-alpine
    container_name: nihongo-keycloak-db
    restart: unless-stopped
    environment:
      POSTGRES_DB: keycloak
      POSTGRES_USER: keycloak_app
      POSTGRES_PASSWORD_FILE: /run/secrets/kc_db_password
    volumes:
      - keycloak-db-data:/var/lib/postgresql/data
    ports:
      - "127.0.0.1:5433:5432"
    secrets:
      - kc_db_password

  # ─── Redis ─────────────────────────────────────
  redis:
    image: redis:8-alpine
    container_name: nihongo-redis
    restart: unless-stopped
    command: >
      redis-server
      --requirepass "${REDIS_PASSWORD}"
      --maxmemory 2gb
      --maxmemory-policy allkeys-lru
      --appendonly yes
    ports:
      - "127.0.0.1:6379:6379"
    volumes:
      - redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    deploy:
      resources:
        limits:
          memory: 2G

  # ─── Meilisearch ───────────────────────────────
  meilisearch:
    image: getmeili/meilisearch:v1.13
    container_name: nihongo-meilisearch
    restart: unless-stopped
    environment:
      MEILI_ENV: production
      MEILI_MASTER_KEY_FILE: /run/secrets/meili_master_key
      MEILI_NO_ANALYTICS: "true"
    ports:
      - "127.0.0.1:7700:7700"
    volumes:
      - meili-data:/meili_data
    secrets:
      - meili_master_key
    deploy:
      resources:
        limits:
          memory: 4G

  # ─── MinIO ─────────────────────────────────────
  minio:
    image: minio/minio:RELEASE.2025-04-22T22-12-26Z
    container_name: nihongo-minio
    restart: unless-stopped
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER_FILE: /run/secrets/minio_access_key
      MINIO_ROOT_PASSWORD_FILE: /run/secrets/minio_secret_key
    ports:
      - "127.0.0.1:9000:9000"
      - "127.0.0.1:9001:9001"   # Console — VPN only
    volumes:
      - minio-data:/data
    secrets:
      - minio_access_key
      - minio_secret_key

  # ─── Keycloak ──────────────────────────────────
  keycloak:
    image: quay.io/keycloak/keycloak:26.2.4
    container_name: nihongo-keycloak
    restart: unless-stopped
    command:
      - start
      - --hostname=auth.nihongo-bjt.com
      - --db=postgres
      - --db-url=jdbc:postgresql://keycloak-db:5432/keycloak
      - --db-username=keycloak_app
      - --db-password-file=/run/secrets/kc_db_password
      - --http-enabled=true
      - --http-port=8080
      - --proxy-headers=xforwarded
    environment:
      KC_BOOTSTRAP_ADMIN_USERNAME: admin
      KC_BOOTSTRAP_ADMIN_PASSWORD_FILE: /run/secrets/kc_admin_password
      KC_FEATURES: "token-exchange"
      KC_LOG_LEVEL: warn
      KC_HEALTH_ENABLED: "true"
      KC_METRICS_ENABLED: "true"
    ports:
      - "127.0.0.1:8080:8080"
    depends_on:
      keycloak-db:
        condition: service_started
    secrets:
      - kc_db_password
      - kc_admin_password

  # ─── API (NestJS) ─────────────────────────────
  api:
    build:
      context: .
      dockerfile: docker/api/Dockerfile
    container_name: nihongo-api
    restart: unless-stopped
    env_file: ./envs/api.env
    ports:
      - "127.0.0.1:4000:4000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      meilisearch:
        condition: service_started
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:4000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s
    deploy:
      resources:
        limits:
          memory: 2G

  # ─── Web (Learner) ────────────────────────────
  web:
    build:
      context: .
      dockerfile: docker/web/Dockerfile
    container_name: nihongo-web
    restart: unless-stopped
    env_file: ./envs/web.env
    ports:
      - "127.0.0.1:3000:3000"
    depends_on:
      api:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000"]
      interval: 30s
      timeout: 10s
      retries: 3

  # ─── Admin ─────────────────────────────────────
  admin:
    build:
      context: .
      dockerfile: docker/admin/Dockerfile
    container_name: nihongo-admin
    restart: unless-stopped
    env_file: ./envs/admin.env
    ports:
      - "127.0.0.1:3001:3001"
    depends_on:
      api:
        condition: service_healthy

volumes:
  postgres-data:
  keycloak-db-data:
  redis-data:
  meili-data:
  minio-data:

secrets:
  db_password:
    file: ./secrets/db_password.txt
  kc_db_password:
    file: ./secrets/kc_db_password.txt
  kc_admin_password:
    file: ./secrets/kc_admin_password.txt
  meili_master_key:
    file: ./secrets/meili_master_key.txt
  minio_access_key:
    file: ./secrets/minio_access_key.txt
  minio_secret_key:
    file: ./secrets/minio_secret_key.txt
```

---

## 10. Health Checks & Monitoring

### 10.1 Health Check Endpoints

| Service | Endpoint | Expected |
|---------|----------|----------|
| **API** | `GET /api/health` | `{"status":"ok","version":"..."}` |
| **Web** | `GET /` | HTTP 200 |
| **Admin** | `GET /` | HTTP 200 |
| **Keycloak** | `GET /health/ready` | HTTP 200 |
| **PostgreSQL** | `pg_isready` | Exit 0 |
| **Redis** | `redis-cli ping` | `PONG` |
| **Meilisearch** | `GET /health` | `{"status":"available"}` |
| **MinIO** | `GET /minio/health/live` | HTTP 200 |

### 10.2 Monitoring Stack (khuyến nghị)

```yaml
# Thêm vào docker-compose.production.yml
services:
  # Prometheus
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./docker/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
    ports:
      - "127.0.0.1:9090:9090"

  # Grafana
  grafana:
    image: grafana/grafana:latest
    ports:
      - "127.0.0.1:3100:3000"
    volumes:
      - grafana-data:/var/lib/grafana
```

**Prometheus targets:**
```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'nihongo-api'
    metrics_path: '/api/metrics'
    static_configs:
      - targets: ['api:4000']

  - job_name: 'keycloak'
    metrics_path: '/metrics'
    static_configs:
      - targets: ['keycloak:8080']

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']

  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']
```

### 10.3 Log Aggregation

**Structured JSON logging (API):**
```env
# NestJS sẽ output JSON logs khi NODE_ENV=production
NODE_ENV=production
```

**Log rotation (Docker):**
```yaml
# Trong mỗi service
logging:
  driver: json-file
  options:
    max-size: "50m"
    max-file: "5"
```

### 10.4 Alerts cần setup

| Alert | Condition | Severity |
|-------|-----------|----------|
| API Down | Health check fail 3 lần | 🔴 Critical |
| DB Connection Pool Exhausted | Active connections > 180 | 🔴 Critical |
| Redis Memory > 90% | Used memory > 1.8 GB | 🟡 Warning |
| Disk Usage > 85% | Any volume | 🟡 Warning |
| Error Rate > 5% | 5xx responses / total | 🟡 Warning |
| Response Time P95 > 2s | API latency | 🟡 Warning |
| Keycloak Down | Health check fail | 🔴 Critical |
| Certificate Expiry < 14 days | SSL cert | 🟡 Warning |
| Battle WebSocket Errors > 10/min | Socket.IO errors | 🟡 Warning |

---

## 11. Backup & Recovery

### 11.1 PostgreSQL Backup

**Daily automated backup:**
```bash
#!/bin/bash
# /opt/nihongo/scripts/backup-db.sh
set -euo pipefail

BACKUP_DIR="/opt/nihongo/backups/postgres"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="nihongo_bjt_${TIMESTAMP}.sql.gz"
RETENTION_DAYS=30

# Backup
PGPASSWORD="${DB_PASSWORD}" pg_dump \
  -h localhost -p 5432 \
  -U nihongo_app \
  -d nihongo_bjt \
  --format=custom \
  --compress=9 \
  -f "${BACKUP_DIR}/${FILENAME}"

# Upload to S3
aws s3 cp "${BACKUP_DIR}/${FILENAME}" \
  "s3://nihongo-bjt-backups/postgres/${FILENAME}"

# Cleanup old local backups
find "${BACKUP_DIR}" -name "*.sql.gz" -mtime +${RETENTION_DAYS} -delete

echo "Backup completed: ${FILENAME}"
```

**Cron:**
```cron
# Daily at 3 AM JST
0 3 * * * /opt/nihongo/scripts/backup-db.sh >> /var/log/nihongo-backup.log 2>&1
```

### 11.2 Redis Backup

```bash
# Redis tự động persist qua AOF + RDB
# Copy RDB file ra external storage
cp /data/redis/dump.rdb /opt/nihongo/backups/redis/dump_$(date +%Y%m%d).rdb
```

### 11.3 Meilisearch Backup

```bash
# Tạo dump qua API
curl -X POST "http://localhost:7700/dumps" \
  -H "Authorization: Bearer ${MEILI_MASTER_KEY}"
```

### 11.4 MinIO Backup

```bash
# Mirror bucket to backup location
mc mirror nihongo/nihongo-bjt-media backup/nihongo-bjt-media
```

### 11.5 Keycloak Backup

```bash
# Export realm
docker exec nihongo-keycloak \
  /opt/keycloak/bin/kc.sh export \
  --file /tmp/realm-export.json \
  --realm nihongo-bjt
docker cp nihongo-keycloak:/tmp/realm-export.json /opt/nihongo/backups/keycloak/
```

### 11.6 Recovery Procedure

| Scenario | Steps |
|----------|-------|
| **DB Corruption** | 1. Stop API/Web/Admin → 2. `pg_restore` from latest backup → 3. `prisma migrate deploy` → 4. Start services |
| **Redis Loss** | Auto-recovers from AOF; BullMQ jobs replay. No manual action needed. |
| **Meili Index Lost** | 1. Restore from dump or 2. Re-index from PostgreSQL source |
| **Keycloak Config Lost** | 1. Import realm JSON → 2. Re-create client secrets → 3. Update env vars |
| **Full Server Loss** | 1. Provision new server → 2. Restore Docker volumes from S3 backups → 3. Deploy → 4. Update DNS |

---

## 12. Security Hardening Checklist

### Network

- [ ] Tất cả services chạy trên private network (không expose port ra internet)
- [ ] Chỉ Nginx/Load Balancer expose port 80/443
- [ ] PostgreSQL, Redis, Meilisearch, MinIO bind 127.0.0.1 hoặc private IP
- [ ] Firewall (ufw/iptables) chỉ allow: 22 (SSH), 80, 443
- [ ] SSH: disable password auth, chỉ dùng key pair
- [ ] Admin panel restrict IP hoặc VPN-only

### Application

- [ ] `NODE_ENV=production` trên tất cả services
- [ ] `SWAGGER_ENABLED=false` (hoặc protect bằng auth)
- [ ] `ADMIN_TEST_BYPASS` KHÔNG set hoặc = 0
- [ ] `NEXT_PUBLIC_ADMIN_TEST_BYPASS` KHÔNG set
- [ ] CORS chỉ allow exact production domains
- [ ] Rate limiting trên Nginx + API level
- [ ] Request body size limit (50MB max)
- [ ] Helmet / security headers enabled

### Authentication

- [ ] Keycloak SSL Required = `all`
- [ ] Keycloak brute force detection enabled
- [ ] Password policy: min 8 chars, complexity
- [ ] Session timeout: access token 5 min, refresh token 30 min
- [ ] PKCE enabled cho public clients
- [ ] Client secrets are strong (auto-generated by Keycloak)
- [ ] Service account dùng cho Admin REST (không dùng admin/password)

### Data

- [ ] Database connections use SSL (`sslmode=require`)
- [ ] Redis requires password
- [ ] Meilisearch requires master key
- [ ] MinIO credentials rotated
- [ ] Backup encryption enabled
- [ ] PII data (email, display name) chỉ accessible qua authenticated API

### Monitoring

- [ ] Error alerting configured
- [ ] Uptime monitoring (UptimeRobot / Better Stack)
- [ ] Log aggregation active
- [ ] Security audit log for admin actions
- [ ] Failed login attempt monitoring via Keycloak events

---

## 13. Production Deployment Checklist

### Pre-deploy

- [ ] Tất cả tests pass (`pnpm test`)
- [ ] TypeScript build success (`pnpm build`)
- [ ] Prisma migrations reviewed và tested
- [ ] Environment variables configured cho tất cả services
- [ ] Secrets generated và stored securely
- [ ] SSL certificates valid
- [ ] DNS records configured
- [ ] Backup procedure tested
- [ ] Rollback plan documented

### Deploy

```bash
# 1. Pull latest code
git pull origin main

# 2. Install dependencies
pnpm install --frozen-lockfile

# 3. Run database migrations
DATABASE_URL="..." npx prisma migrate deploy

# 4. Build all apps
pnpm build

# 5. Restart services
docker compose -f docker-compose.production.yml up -d

# 6. Verify health
curl -f https://api.nihongo-bjt.com/api/health
curl -f https://nihongo-bjt.com
curl -f https://admin.nihongo-bjt.com
curl -f https://auth.nihongo-bjt.com/health/ready
```

### Post-deploy

- [ ] Health check endpoints return 200
- [ ] Login flow works (Learner + Admin)
- [ ] Battle WebSocket connects
- [ ] Search returns results
- [ ] Media upload/download works
- [ ] Monitoring shows no errors
- [ ] Performance baseline acceptable (P95 < 500ms)
- [ ] Run smoke test: `npx playwright test e2e/smoke.spec.ts`

### Rollback

```bash
# 1. Revert to previous image
docker compose -f docker-compose.production.yml down
git checkout <previous-tag>
pnpm install --frozen-lockfile
pnpm build
docker compose -f docker-compose.production.yml up -d

# 2. Nếu migration cần rollback
# (Prisma không hỗ trợ auto-rollback — cần manual SQL)
# Restore DB from backup nếu cần
```

---

## Phụ lục: Quick Reference Card

```
╔═══════════════════════════════════════════════════════════╗
║            NihonGo BJT — Production Quick Ref             ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║  Domains:                                                 ║
║    Learner  → nihongo-bjt.com          (port 3000)        ║
║    API      → api.nihongo-bjt.com      (port 4000)        ║
║    Admin    → admin.nihongo-bjt.com    (port 3001)        ║
║    Auth     → auth.nihongo-bjt.com     (port 8080)        ║
║    Media    → media.nihongo-bjt.com    (S3/CDN)           ║
║                                                           ║
║  Internal (KHÔNG expose):                                 ║
║    PostgreSQL  → 127.0.0.1:5432                           ║
║    Redis       → 127.0.0.1:6379                           ║
║    Meilisearch → 127.0.0.1:7700                           ║
║    MinIO       → 127.0.0.1:9000                           ║
║                                                           ║
║  Health Checks:                                           ║
║    API     → GET /api/health                              ║
║    KC      → GET /health/ready                            ║
║    Meili   → GET /health                                  ║
║    Redis   → redis-cli ping                               ║
║                                                           ║
║  Deploy:  git pull → pnpm install → migrate → build → up  ║
║  Backup:  Daily 3AM JST → S3 (30-day retention)           ║
║  Rotate:  Secrets every 90 days                           ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
```
