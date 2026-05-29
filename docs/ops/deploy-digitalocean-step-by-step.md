# Triển khai NihonGo BJT lên DigitalOcean — Hướng dẫn từ A đến Z

> Hướng dẫn chi tiết cho người dùng thông thường triển khai toàn bộ hệ thống NihonGo BJT lên DigitalOcean.
> Không cần kinh nghiệm DevOps. Chỉ cần làm theo từng bước.

**Thời gian ước tính:** 2–3 giờ (lần đầu)
**Chi phí ước tính:** ~$40–80/tháng (MVP < 1000 users)

---

## Mục lục

1. [Tổng quan & kiến trúc](#1-tổng-quan--kiến-trúc)
2. [Đăng ký dịch vụ bên ngoài](#2-đăng-ký-dịch-vụ-bên-ngoài)
3. [Chuẩn bị DigitalOcean](#3-chuẩn-bị-digitalocean)
4. [Tạo Droplet (VPS)](#4-tạo-droplet-vps)
5. [Cài đặt hạ tầng trên server](#5-cài-đặt-hạ-tầng-trên-server)
6. [Cấu hình domain & SSL](#6-cấu-hình-domain--ssl)
7. [Cấu hình Keycloak](#7-cấu-hình-keycloak)
8. [Cấu hình Google Login](#8-cấu-hình-google-login)
9. [Deploy ứng dụng](#9-deploy-ứng-dụng)
10. [Seed dữ liệu & migration](#10-seed-dữ-liệu--migration)
11. [Reverse Proxy (Caddy)](#11-reverse-proxy-caddy)
12. [Kiểm tra sau deploy](#12-kiểm-tra-sau-deploy)
13. [Backup tự động](#13-backup-tự-động)
14. [Nâng cấp & maintain](#14-nâng-cấp--maintain)
15. [Troubleshooting](#15-troubleshooting)

---

## 1. Tổng quan & kiến trúc

```
Internet
  │
  ▼
┌──────────────────────────────────────────────────────┐
│  DigitalOcean Droplet (Ubuntu 24.04, 4vCPU/8GB)     │
│                                                      │
│  ┌──────────┐                                        │
│  │  Caddy   │ ← reverse proxy + auto SSL             │
│  │  :443    │                                        │
│  └────┬─────┘                                        │
│       │                                              │
│  ┌────┼───────────────────────────────┐              │
│  │    │         Docker Network         │              │
│  │    ▼              ▼           ▼     │              │
│  │  Web:3000    API:4000    Admin:3001 │              │
│  │                  │                  │              │
│  │    ▼         ▼         ▼       ▼    │              │
│  │ Keycloak  Postgres   Redis  Meili   │              │
│  │  :8080     :5432     :6379  :7700   │              │
│  └─────────────────────────────────────┘              │
│                                                      │
│  MinIO/S3 :9000 (internal, hoặc DO Spaces)           │
└──────────────────────────────────────────────────────┘
```

**Domain cần:**
- `nihongo-bjt.com` — Learner app
- `api.nihongo-bjt.com` — Backend API
- `admin.nihongo-bjt.com` — Admin dashboard
- `auth.nihongo-bjt.com` — Keycloak (ẩn khỏi user)

> Thay `nihongo-bjt.com` bằng domain thực của bạn.

---

## 2. Đăng ký dịch vụ bên ngoài

Trước khi bắt đầu, đăng ký các dịch vụ sau:

### 2.1 DigitalOcean

| | |
|---|---|
| **URL** | https://cloud.digitalocean.com/registrations/new |
| **Cần** | Email + thẻ thanh toán |
| **Free credit** | Thường có $200 credit 60 ngày cho account mới |
| **Dùng cho** | VPS (Droplet), DNS, Spaces (object storage) |

### 2.2 Domain Name

| | |
|---|---|
| **Mua ở đâu** | Namecheap, Cloudflare, Google Domains, hoặc DO Domains |
| **Chi phí** | ~$10–15/năm cho .com |
| **Khuyến nghị** | Mua trên Cloudflare (giá gốc, DNS nhanh) |
| **Cần** | 1 domain chính (VD: `nihongo-bjt.com`) |

### 2.3 Google Cloud Console (cho Google Login)

| | |
|---|---|
| **URL** | https://console.cloud.google.com/ |
| **Cần** | Google account |
| **Chi phí** | **Miễn phí** (OAuth không tốn tiền) |
| **Dùng cho** | "Đăng nhập bằng Google" |
| **Bước đăng ký** | Xem [Mục 8](#8-cấu-hình-google-login) |

### 2.4 Facebook Developer (tùy chọn — cho Facebook Login)

| | |
|---|---|
| **URL** | https://developers.facebook.com/ |
| **Cần** | Facebook account + xác minh doanh nghiệp |
| **Chi phí** | **Miễn phí** |
| **Lưu ý** | Cần app review nếu muốn user ngoài team sử dụng |

### 2.5 Cloudflare (khuyến nghị — CDN + bảo vệ DDoS)

| | |
|---|---|
| **URL** | https://dash.cloudflare.com/sign-up |
| **Cần** | Email |
| **Chi phí** | **Miễn phí** (Free plan đủ dùng) |
| **Dùng cho** | DNS, CDN cache, DDoS protection, analytics |

### 2.6 SMTP Email (cho gửi email xác thực)

| Lựa chọn | URL | Chi phí |
|-----------|-----|---------|
| **Resend** (khuyến nghị) | https://resend.com | Free 100 emails/ngày |
| Mailgun | https://www.mailgun.com | Free 100 emails/ngày |
| SendGrid | https://sendgrid.com | Free 100 emails/ngày |
| Amazon SES | https://aws.amazon.com/ses/ | $0.10/1000 emails |

---

## 3. Chuẩn bị DigitalOcean

### 3.1 Tạo SSH Key (trên máy local)

```bash
# Windows (PowerShell) hoặc Mac/Linux terminal
ssh-keygen -t ed25519 -C "your-email@example.com"

# Nhấn Enter 3 lần (dùng đường dẫn mặc định, không cần passphrase cho đơn giản)
# File tạo ra:
#   ~/.ssh/id_ed25519      (private key — KHÔNG CHIA SẺ)
#   ~/.ssh/id_ed25519.pub  (public key — upload lên DO)
```

### 3.2 Upload SSH Key lên DigitalOcean

1. Vào https://cloud.digitalocean.com/account/security
2. Click **Add SSH Key**
3. Paste nội dung file `~/.ssh/id_ed25519.pub`
4. Name: `My Laptop` (gì cũng được)
5. Click **Add SSH Key**

### 3.3 Tạo Project

1. Vào https://cloud.digitalocean.com/projects
2. **New Project** → Name: `NihonGo BJT` → Purpose: `Web Application`

---

## 4. Tạo Droplet (VPS)

### 4.1 Tạo Droplet

1. https://cloud.digitalocean.com/droplets/new
2. **Region:** Singapore (`sgp1`) — gần Việt Nam/Nhật nhất
3. **Image:** Ubuntu 24.04 LTS
4. **Size:** Regular → **$48/mo** (4 vCPU, 8 GB RAM, 160 GB SSD)
   - Hoặc **$24/mo** (2 vCPU, 4 GB RAM, 80 GB SSD) nếu ít user
5. **Authentication:** SSH Key (chọn key vừa upload)
6. **Hostname:** `nihongo-bjt-prod`
7. **Project:** NihonGo BJT
8. Click **Create Droplet**

### 4.2 Ghi lại IP

Sau khi tạo xong (~30 giây), ghi lại **IPv4 Address** (VD: `167.71.xxx.xxx`).

### 4.3 SSH vào server

```bash
ssh root@167.71.xxx.xxx
```

> Lần đầu hỏi "Are you sure..." → gõ `yes`

---

## 5. Cài đặt hạ tầng trên server

Chạy toàn bộ các lệnh dưới đây trên server (qua SSH).

### 5.1 Update & cài tool cơ bản

```bash
apt update && apt upgrade -y
apt install -y curl git unzip ufw fail2ban
```

### 5.2 Cài Docker

```bash
# Cài Docker bằng official script
curl -fsSL https://get.docker.com | sh

# Verify
docker --version
docker compose version
```

### 5.3 Cài Node.js 22 + pnpm

```bash
# Node.js 22 via NodeSource
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs

# pnpm
npm install -g pnpm@latest

# Verify
node --version   # v22.x.x
pnpm --version   # 10.x.x
```

### 5.4 Cài Caddy (reverse proxy)

```bash
apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt update
apt install caddy
```

### 5.5 Firewall

```bash
ufw allow OpenSSH
ufw allow 80
ufw allow 443
ufw --force enable
ufw status
```

### 5.6 Tạo user deploy (bảo mật — không chạy app bằng root)

```bash
adduser --disabled-password --gecos "" deploy
usermod -aG docker deploy
su - deploy
```

### 5.7 Clone project

```bash
# Chạy dưới user deploy
cd /home/deploy
git clone https://github.com/YOUR_USERNAME/nihongo-bjt.git
cd nihongo-bjt
pnpm install
```

### 5.8 Khởi chạy infrastructure (Docker)

Tạo file `docker-compose.prod.yml`:

```bash
cat > /home/deploy/nihongo-bjt/docker-compose.prod.yml << 'EOF'
services:
  postgres:
    image: postgres:17
    container_name: nihongo-bjt-postgres
    restart: always
    environment:
      POSTGRES_DB: nihongo_bjt
      POSTGRES_USER: nihongo_app
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres-data:/var/lib/postgresql/data
    ports:
      - "127.0.0.1:5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U nihongo_app -d nihongo_bjt"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:8-alpine
    container_name: nihongo-bjt-redis
    restart: always
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis-data:/data
    ports:
      - "127.0.0.1:6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  meilisearch:
    image: getmeili/meilisearch:v1.13
    container_name: nihongo-bjt-meilisearch
    restart: always
    environment:
      MEILI_ENV: production
      MEILI_MASTER_KEY: ${MEILI_MASTER_KEY}
      MEILI_NO_ANALYTICS: "true"
    volumes:
      - meili-data:/meili_data
    ports:
      - "127.0.0.1:7700:7700"

  minio:
    image: minio/minio:RELEASE.2025-04-22T22-12-26Z
    container_name: nihongo-bjt-minio
    restart: always
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD}
    volumes:
      - minio-data:/data
    ports:
      - "127.0.0.1:9000:9000"
      - "127.0.0.1:9001:9001"

  keycloak:
    image: quay.io/keycloak/keycloak:26.2.4
    container_name: nihongo-bjt-keycloak
    restart: always
    command: start
    environment:
      KC_DB: postgres
      KC_DB_URL: jdbc:postgresql://postgres:5432/nihongo_bjt
      KC_DB_USERNAME: nihongo_app
      KC_DB_PASSWORD: ${POSTGRES_PASSWORD}
      KC_DB_SCHEMA: keycloak
      KC_HOSTNAME: auth.${DOMAIN}
      KC_PROXY_HEADERS: xforwarded
      KC_HTTP_ENABLED: "true"
      KC_HEALTH_ENABLED: "true"
      KEYCLOAK_ADMIN: admin
      KEYCLOAK_ADMIN_PASSWORD: ${KEYCLOAK_ADMIN_PASSWORD}
    ports:
      - "127.0.0.1:8080:8080"
    depends_on:
      postgres:
        condition: service_healthy

volumes:
  postgres-data:
  redis-data:
  meili-data:
  minio-data:
EOF
```

### 5.9 Tạo file secrets

```bash
cat > /home/deploy/nihongo-bjt/.env.production.docker << 'EOF'
# === GEN PASSWORDS (thay giá trị bên dưới) ===
POSTGRES_PASSWORD=CHANGE_ME_strong_password_1
REDIS_PASSWORD=CHANGE_ME_strong_password_2
MEILI_MASTER_KEY=CHANGE_ME_strong_password_3
MINIO_ROOT_USER=nihongo-admin
MINIO_ROOT_PASSWORD=CHANGE_ME_strong_password_4
KEYCLOAK_ADMIN_PASSWORD=CHANGE_ME_strong_password_5
DOMAIN=nihongo-bjt.com
EOF
```

**Tạo password mạnh:**
```bash
# Chạy 5 lần để có 5 password khác nhau
openssl rand -base64 32
```

Copy các password vào file `.env.production.docker` ở trên.

### 5.10 Start infrastructure

```bash
cd /home/deploy/nihongo-bjt
docker compose -f docker-compose.prod.yml --env-file .env.production.docker up -d

# Kiểm tra
docker compose -f docker-compose.prod.yml ps
```

Tất cả containers phải ở trạng thái `healthy` hoặc `running`.

---

## 6. Cấu hình domain & SSL

### 6.1 Trỏ DNS

Vào nơi quản lý DNS (Cloudflare/Namecheap/DO) và tạo các **A record**:

| Type | Name | Value | Proxy |
|------|------|-------|-------|
| A | `@` | `167.71.xxx.xxx` | ON (Cloudflare) hoặc DNS only |
| A | `api` | `167.71.xxx.xxx` | ON |
| A | `admin` | `167.71.xxx.xxx` | ON |
| A | `auth` | `167.71.xxx.xxx` | ON |

> Thay `167.71.xxx.xxx` bằng IP Droplet thực.

### 6.2 Nếu dùng Cloudflare

1. Vào https://dash.cloudflare.com
2. Add site → nhập domain → chọn Free plan
3. Đổi nameserver ở registrar sang Cloudflare nameservers
4. Đợi ~5 phút để propagate
5. **SSL/TLS** → Set mode: **Full (strict)**
6. **Edge Certificates** → Always Use HTTPS: **ON**

### 6.3 Nếu KHÔNG dùng Cloudflare

Caddy sẽ tự động lấy SSL certificate từ Let's Encrypt. Không cần cấu hình thêm.

---

## 7. Cấu hình Keycloak

### 7.1 Truy cập Keycloak Admin

```
https://auth.nihongo-bjt.com    (sau khi Caddy chạy)
# Hoặc tạm thời:
ssh -L 8080:127.0.0.1:8080 root@167.71.xxx.xxx
# Rồi mở: http://localhost:8080
```

Login: `admin` / `<KEYCLOAK_ADMIN_PASSWORD từ .env.production.docker>`

### 7.2 Tạo Realm

1. Click dropdown "master" (góc trái) → **Create Realm**
2. **Realm name:** `nihongo-bjt`
3. **Enabled:** ON
4. Click **Create**

### 7.3 Tạo Client cho Learner Web App

1. **Clients** → **Create client**
2. **Client type:** OpenID Connect
3. **Client ID:** `nihongo-web`
4. Next →
5. **Client authentication:** ON (confidential)
6. **Authorization:** OFF
7. Next →
8. **Root URL:** `https://nihongo-bjt.com`
9. **Valid redirect URIs:**
   ```
   https://nihongo-bjt.com/*
   http://localhost:3000/*
   ```
10. **Valid post logout redirect URIs:**
    ```
    https://nihongo-bjt.com/*
    http://localhost:3000/*
    ```
11. **Web origins:**
    ```
    https://nihongo-bjt.com
    http://localhost:3000
    ```
12. Click **Save**
13. Vào tab **Credentials** → copy **Client secret** → ghi lại

### 7.4 Tạo Client cho Admin App

Lặp lại bước 7.3 với:
- **Client ID:** `nihongo-admin`
- **Root URL:** `https://admin.nihongo-bjt.com`
- **Valid redirect URIs:** `https://admin.nihongo-bjt.com/*`
- **Web origins:** `https://admin.nihongo-bjt.com`

### 7.5 Tạo Realm Role `admin`

1. **Realm roles** → **Create role**
2. **Role name:** `admin`
3. Click **Save**

### 7.6 Tạo User Admin đầu tiên

1. **Users** → **Create user**
2. Email: `your-email@example.com`
3. **Email verified:** ON
4. **Username:** `admin`
5. Click **Create**
6. Tab **Credentials** → **Set password** → nhập password → **Temporary: OFF**
7. Tab **Role mapping** → **Assign role** → tick `admin` → **Assign**

---

## 8. Cấu hình Google Login

### 8.1 Tạo Google OAuth Credentials

1. Vào https://console.cloud.google.com/
2. Tạo project mới (hoặc chọn project hiện có):
   - Click dropdown project → **New Project**
   - Name: `NihonGo BJT`
   - Click **Create**
3. **APIs & Services** → **OAuth consent screen**
   - User Type: **External**
   - App name: `NihonGo BJT`
   - User support email: email của bạn
   - Logo: (upload nếu có)
   - App domain:
     - Application home page: `https://nihongo-bjt.com`
     - Privacy policy: `https://nihongo-bjt.com/privacy`
     - Terms of service: `https://nihongo-bjt.com/terms`
   - Authorized domains: `nihongo-bjt.com`
   - Developer contact: email của bạn
   - Click **Save and Continue**
4. **Scopes** → **Add or remove scopes** → chọn:
   - `openid`
   - `email`
   - `profile`
   - Click **Update** → **Save and Continue**
5. **Test users** → **Add users** → thêm email test → **Save and Continue**
6. **Summary** → **Back to Dashboard**

### 8.2 Tạo OAuth Client ID

1. **APIs & Services** → **Credentials**
2. **Create Credentials** → **OAuth 2.0 Client ID**
3. Application type: **Web application**
4. Name: `NihonGo BJT Production`
5. **Authorized JavaScript origins:**
   ```
   https://nihongo-bjt.com
   https://auth.nihongo-bjt.com
   ```
6. **Authorized redirect URIs:**
   ```
   https://auth.nihongo-bjt.com/realms/nihongo-bjt/broker/google/endpoint
   ```
7. Click **Create**
8. **Ghi lại Client ID và Client Secret** (hiện lên popup)

### 8.3 Cấu hình trong Keycloak

1. Keycloak Admin → Realm `nihongo-bjt`
2. **Identity Providers** → **Add provider** → **Google**
3. Điền:

| Field | Value |
|-------|-------|
| Alias | `google` |
| Display Name | `Google` |
| Enabled | ON |
| Client ID | `<Client ID từ Google>` |
| Client Secret | `<Client Secret từ Google>` |
| Default Scopes | `openid email profile` |
| Trust Email | ON |
| First Login Flow | `first broker login` |
| Sync Mode | `import` |

4. Click **Save**

### 8.4 Tắt Review Profile (smooth UX)

1. **Authentication** → chọn flow **first broker login**
2. Tìm step **Review Profile** → đổi sang **DISABLED**
3. Click **Save**

### 8.5 Publish App (quan trọng!)

> ⚠️ Khi còn "Testing" mode, chỉ test users mới login được.

Khi sẵn sàng public:
1. Google Cloud Console → **OAuth consent screen**
2. **Publishing status** → **Publish App**
3. Google sẽ hiện cảnh báo verification → click **Confirm**

> Nếu < 100 users, không cần Google verification. Nếu > 100, cần submit verification form (~1–2 tuần).

---

## 9. Deploy ứng dụng

### 9.1 Tạo file `.env.production`

```bash
cat > /home/deploy/nihongo-bjt/.env.production << 'EOF'
NODE_ENV=production

# === Database ===
DATABASE_URL="postgresql://nihongo_app:YOUR_POSTGRES_PASSWORD@127.0.0.1:5432/nihongo_bjt?schema=content"

# === App URLs ===
API_PORT=4000
API_PUBLIC_URL="https://api.nihongo-bjt.com"
WEB_PUBLIC_URL="https://nihongo-bjt.com"
ADMIN_PUBLIC_URL="https://admin.nihongo-bjt.com"
CORS_ORIGINS="https://nihongo-bjt.com,https://admin.nihongo-bjt.com"
NEXT_PUBLIC_API_URL="https://api.nihongo-bjt.com"

# === Redis ===
REDIS_URL="redis://:YOUR_REDIS_PASSWORD@127.0.0.1:6379"

# === Meilisearch ===
MEILI_HOST="http://127.0.0.1:7700"
MEILI_MASTER_KEY="YOUR_MEILI_MASTER_KEY"

# === MinIO / S3 ===
MINIO_ENDPOINT="127.0.0.1"
MINIO_PORT=9000
MINIO_ACCESS_KEY="nihongo-admin"
MINIO_SECRET_KEY="YOUR_MINIO_PASSWORD"
MINIO_BUCKET="nihongo-bjt-media"
MINIO_USE_SSL="false"

# === Keycloak ===
KEYCLOAK_ISSUER_URL="https://auth.nihongo-bjt.com/realms/nihongo-bjt"
WEB_KEYCLOAK_ISSUER_URL="https://auth.nihongo-bjt.com/realms/nihongo-bjt"
WEB_KEYCLOAK_CLIENT_ID="nihongo-web"
WEB_KEYCLOAK_CLIENT_SECRET="YOUR_WEB_CLIENT_SECRET"
ADMIN_KEYCLOAK_ISSUER_URL="https://auth.nihongo-bjt.com/realms/nihongo-bjt"
ADMIN_KEYCLOAK_CLIENT_ID="nihongo-admin"
ADMIN_KEYCLOAK_CLIENT_SECRET="YOUR_ADMIN_CLIENT_SECRET"
KEYCLOAK_PUBLIC_URL="https://auth.nihongo-bjt.com"

# Browser-side Keycloak
NEXT_PUBLIC_KEYCLOAK_URL="https://auth.nihongo-bjt.com"
NEXT_PUBLIC_KEYCLOAK_REALM="nihongo-bjt"
NEXT_PUBLIC_WEB_KEYCLOAK_ISSUER_URL="https://auth.nihongo-bjt.com/realms/nihongo-bjt"
NEXT_PUBLIC_WEB_KEYCLOAK_URL="https://auth.nihongo-bjt.com"
NEXT_PUBLIC_WEB_KEYCLOAK_REALM="nihongo-bjt"
NEXT_PUBLIC_WEB_KEYCLOAK_CLIENT_ID="nihongo-web"
NEXT_PUBLIC_ADMIN_KEYCLOAK_ISSUER_URL="https://auth.nihongo-bjt.com/realms/nihongo-bjt"
NEXT_PUBLIC_ADMIN_KEYCLOAK_URL="https://auth.nihongo-bjt.com"
NEXT_PUBLIC_ADMIN_KEYCLOAK_REALM="nihongo-bjt"
NEXT_PUBLIC_ADMIN_KEYCLOAK_CLIENT_ID="nihongo-admin"

# === Google OAuth (direct — nếu dùng flow /api/auth/google/*) ===
OAUTH_STATE_SECRET="YOUR_RANDOM_32_CHAR_STRING"
GOOGLE_OAUTH_CLIENT_ID="YOUR_GOOGLE_CLIENT_ID"
GOOGLE_OAUTH_CLIENT_SECRET="YOUR_GOOGLE_CLIENT_SECRET"
GOOGLE_OAUTH_REDIRECT_URI="https://api.nihongo-bjt.com/api/auth/google/callback"

# === Web Push (optional) ===
# VAPID_PUBLIC_KEY=""
# VAPID_PRIVATE_KEY=""
# NEXT_PUBLIC_VAPID_PUBLIC_KEY=""

# === OpenAI (optional — image generation) ===
# OPENAI_API_KEY=""
EOF
```

> ⚠️ Thay tất cả `YOUR_*` bằng giá trị thực.

### 9.2 Build

```bash
cd /home/deploy/nihongo-bjt

# Load env
set -a; source .env.production; set +a

# Build toàn bộ
pnpm build
```

> Build mất ~3–5 phút lần đầu.

### 9.3 Chạy với PM2 (process manager)

```bash
# Cài PM2
npm install -g pm2

# Tạo file ecosystem
cat > /home/deploy/nihongo-bjt/ecosystem.config.cjs << 'EOF'
module.exports = {
  apps: [
    {
      name: "api",
      cwd: "./apps/api",
      script: "dist/main.js",
      instances: 2,
      exec_mode: "cluster",
      env_file: "../../.env.production",
      env: {
        NODE_ENV: "production",
        PORT: 4000,
      },
    },
    {
      name: "web",
      cwd: "./apps/web",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      instances: 1,
      env_file: "../../.env.production",
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "admin",
      cwd: "./apps/admin",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3001",
      instances: 1,
      env_file: "../../.env.production",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
EOF

# Start
pm2 start ecosystem.config.cjs

# Auto-restart on server reboot
pm2 save
pm2 startup
# (chạy lệnh mà PM2 gợi ý — copy paste)
```

### 9.4 Verify apps running

```bash
pm2 status
# Phải thấy: api (online, 2 instances), web (online), admin (online)

# Test internal
curl http://127.0.0.1:4000/api/health
curl http://127.0.0.1:3000
curl http://127.0.0.1:3001
```

---

## 10. Seed dữ liệu & migration

### 10.1 Prisma migration

```bash
cd /home/deploy/nihongo-bjt
set -a; source .env.production; set +a

npx prisma migrate deploy
```

### 10.2 Seed dữ liệu BJT

```bash
# Seed cơ bản (JLPT levels, kanji, vocab)
pnpm db:seed

# Seed BJT questions (production-quality)
npx tsx database/scripts/seeds/bjt/seed-bjt-production.ts
```

### 10.3 Index Meilisearch

```bash
npx tsx scripts/sync-meilisearch.ts
```

### 10.4 Tạo MinIO bucket

```bash
docker exec nihongo-bjt-minio mc alias set local http://localhost:9000 nihongo-admin YOUR_MINIO_PASSWORD
docker exec nihongo-bjt-minio mc mb local/nihongo-bjt-media
docker exec nihongo-bjt-minio mc anonymous set download local/nihongo-bjt-media
```

---

## 11. Reverse Proxy (Caddy)

### 11.1 Cấu hình Caddy

```bash
cat > /etc/caddy/Caddyfile << 'EOF'
# NihonGo BJT — Production Caddyfile

# Learner Web App
nihongo-bjt.com {
    reverse_proxy 127.0.0.1:3000
    encode gzip zstd

    header {
        X-Frame-Options "SAMEORIGIN"
        X-Content-Type-Options "nosniff"
        Referrer-Policy "strict-origin-when-cross-origin"
        Permissions-Policy "camera=(), microphone=(), geolocation=()"
    }
}

# API
api.nihongo-bjt.com {
    reverse_proxy 127.0.0.1:4000

    # WebSocket support for Socket.IO
    @websocket {
        header Connection *Upgrade*
        header Upgrade websocket
    }
    reverse_proxy @websocket 127.0.0.1:4000

    header {
        X-Content-Type-Options "nosniff"
    }
}

# Admin
admin.nihongo-bjt.com {
    reverse_proxy 127.0.0.1:3001

    header {
        X-Frame-Options "DENY"
        X-Content-Type-Options "nosniff"
    }
}

# Keycloak Auth
auth.nihongo-bjt.com {
    reverse_proxy 127.0.0.1:8080

    header {
        X-Frame-Options "SAMEORIGIN"
    }
}
EOF
```

### 11.2 Restart Caddy

```bash
systemctl restart caddy
systemctl status caddy
```

> Caddy tự động lấy SSL certificate từ Let's Encrypt (mất ~30 giây lần đầu).

### 11.3 Verify

```bash
curl -I https://nihongo-bjt.com
curl -I https://api.nihongo-bjt.com/api/health
curl -I https://admin.nihongo-bjt.com
curl -I https://auth.nihongo-bjt.com
```

Tất cả phải trả về `HTTP/2 200` hoặc redirect.

---

## 12. Kiểm tra sau deploy

### Checklist cuối cùng

```bash
# 1. Health check
curl https://api.nihongo-bjt.com/api/health
# Expected: {"status":"ok","services":{"database":"up","redis":"up","meilisearch":"up"}}

# 2. Learner app loads
curl -s https://nihongo-bjt.com | head -5
# Expected: HTML content

# 3. Admin app loads (sẽ redirect sang login)
curl -sI https://admin.nihongo-bjt.com
# Expected: 302 redirect to auth

# 4. Keycloak well-known
curl https://auth.nihongo-bjt.com/realms/nihongo-bjt/.well-known/openid-configuration | head -3
# Expected: JSON with issuer, authorization_endpoint, etc.
```

### Kiểm tra thủ công

- [ ] Mở `https://nihongo-bjt.com` → trang chủ hiển thị
- [ ] Click "Đăng nhập" → redirect sang Google login
- [ ] Login thành công → redirect về app, hiện tên user
- [ ] Vào `/quiz` → hiện danh sách đề thi
- [ ] Bắt đầu 1 bài thi → hoạt động bình thường
- [ ] Mở `https://admin.nihongo-bjt.com` → login bằng user admin
- [ ] Admin dashboard hiển thị data

---

## 13. Backup tự động

### 13.1 Script backup

```bash
cat > /home/deploy/backup.sh << 'EOF'
#!/bin/bash
set -e

BACKUP_DIR="/home/deploy/backups"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=14

mkdir -p "$BACKUP_DIR"

# PostgreSQL
docker exec nihongo-bjt-postgres pg_dump -U nihongo_app -d nihongo_bjt --format=custom \
  > "$BACKUP_DIR/db_${DATE}.dump"

# Meilisearch snapshot
curl -s -X POST "http://127.0.0.1:7700/snapshots" \
  -H "Authorization: Bearer ${MEILI_MASTER_KEY}" || true

# Compress
gzip "$BACKUP_DIR/db_${DATE}.dump"

# Cleanup old backups
find "$BACKUP_DIR" -name "*.gz" -mtime +${RETENTION_DAYS} -delete

echo "[$(date)] Backup completed: db_${DATE}.dump.gz"
EOF

chmod +x /home/deploy/backup.sh
```

### 13.2 Cron job (chạy 2:00 AM hàng ngày)

```bash
crontab -e
# Thêm dòng:
0 2 * * * /home/deploy/backup.sh >> /home/deploy/backup.log 2>&1
```

### 13.3 (Tùy chọn) Upload backup lên DO Spaces

```bash
# Cài s3cmd
apt install -y s3cmd

# Cấu hình DO Spaces
s3cmd --configure
# Region: sgp1
# Endpoint: sgp1.digitaloceanspaces.com
# Access Key / Secret: từ DO API panel

# Thêm vào backup.sh trước dòng cuối:
# s3cmd put "$BACKUP_DIR/db_${DATE}.dump.gz" s3://nihongo-bjt-backups/
```

---

## 14. Nâng cấp & maintain

### 14.1 Deploy phiên bản mới

```bash
ssh deploy@167.71.xxx.xxx
cd ~/nihongo-bjt

# Pull code mới
git pull origin main

# Install deps (nếu có thay đổi)
pnpm install

# Run migrations (nếu có)
set -a; source .env.production; set +a
npx prisma migrate deploy

# Rebuild
pnpm build

# Restart apps (zero-downtime với cluster mode)
pm2 reload all

# Verify
pm2 status
curl https://api.nihongo-bjt.com/api/health
```

### 14.2 Update Docker images

```bash
cd ~/nihongo-bjt
docker compose -f docker-compose.prod.yml --env-file .env.production.docker pull
docker compose -f docker-compose.prod.yml --env-file .env.production.docker up -d
```

### 14.3 Xem logs

```bash
# App logs
pm2 logs api --lines 100
pm2 logs web --lines 50

# Docker logs
docker logs nihongo-bjt-postgres --tail 50
docker logs nihongo-bjt-keycloak --tail 50

# Caddy logs
journalctl -u caddy --since "1 hour ago"
```

### 14.4 Monitoring cơ bản

```bash
# CPU/RAM usage
htop

# Disk usage
df -h

# Docker stats
docker stats --no-stream

# PM2 monitoring
pm2 monit
```

---

## 15. Troubleshooting

### App không start

```bash
pm2 logs api --err --lines 30
# Thường do: thiếu env var, DB connection failed, port conflict
```

### Keycloak "Invalid redirect_uri"

- Kiểm tra **Valid redirect URIs** trong Keycloak client config
- Phải match CHÍNH XÁC URL (bao gồm `https://` và trailing `/*`)

### Google Login "redirect_uri_mismatch"

- Vào Google Cloud Console → Credentials → OAuth client
- Kiểm tra **Authorized redirect URIs** có chứa:
  ```
  https://auth.nihongo-bjt.com/realms/nihongo-bjt/broker/google/endpoint
  ```
- URL phải match 100% — không trailing slash, đúng protocol

### SSL certificate failed

```bash
# Caddy auto-renew. Nếu lỗi:
systemctl restart caddy
journalctl -u caddy | grep -i "tls\|cert\|error"
# Thường do: DNS chưa propagate, firewall block port 80
```

### Database connection refused

```bash
docker ps | grep postgres
docker logs nihongo-bjt-postgres --tail 20
# Kiểm tra: container running? password đúng? user/db exist?
```

### "CORS error" trên browser

- Kiểm tra `CORS_ORIGINS` trong `.env.production` có đúng domain (có https://, không trailing slash)
- Restart API: `pm2 restart api`

### Hết disk space

```bash
df -h
# Cleanup Docker
docker system prune -a --volumes
# Cleanup old backups
find /home/deploy/backups -mtime +7 -delete
```

---

## Chi phí hàng tháng (ước tính)

### Plan Premium (~$54/mo) — DigitalOcean, ổn định, dễ dùng

| Service | Cost |
|---------|------|
| DigitalOcean Droplet (4vCPU/8GB) | $48/mo |
| Domain (.com) | ~$1/mo ($12/yr) |
| Cloudflare (Free plan) | $0 |
| Google OAuth | $0 |
| DO Spaces (backup, 50GB) | $5/mo |
| **Tổng** | **~$54/mo** |

---

### Plan Budget A (~$7/mo) — Hetzner VPS ⭐ KHUYẾN NGHỊ cho tiết kiệm

Hetzner (Đức/Phần Lan) rẻ hơn DO 5–10× cho cùng cấu hình.

| Service | Cost |
|---------|------|
| **Hetzner CX22** (2 vCPU, 4GB RAM, 40GB SSD) | €4.49/mo (~$5) |
| Domain (.com) | ~$1/mo |
| Cloudflare (Free) | $0 |
| Google OAuth | $0 |
| **Tổng** | **~$6/mo** |

**Đăng ký:** https://www.hetzner.com/cloud

**Lưu ý:**
- Server ở Đức/Phần Lan (ping từ VN ~200ms — chấp nhận được)
- Hoặc chọn **Hetzner Ashburn, US** nếu cần gần hơn
- 4GB RAM đủ chạy tất cả services (Postgres + Redis + Meili + Keycloak + App)
- Thêm 2GB swap cho an toàn

**Setup swap (chạy trên server):**
```bash
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

**Tối ưu RAM — giới hạn memory cho Docker:**
```yaml
# Thêm vào từng service trong docker-compose.prod.yml:
services:
  postgres:
    deploy:
      resources:
        limits:
          memory: 1024M
  redis:
    deploy:
      resources:
        limits:
          memory: 256M
  meilisearch:
    deploy:
      resources:
        limits:
          memory: 512M
  keycloak:
    deploy:
      resources:
        limits:
          memory: 768M
```

---

### Plan Budget B ($0–1/mo) — Oracle Cloud Always Free 🆓

Oracle Cloud có **Always Free tier** cực mạnh — không hết hạn, không cần thẻ credit.

| Service | Cost |
|---------|------|
| **Oracle ARM VM** (4 OCPU, 24GB RAM, 200GB) | **$0** (Free Forever) |
| Domain (.com) | ~$1/mo |
| Cloudflare (Free) | $0 |
| **Tổng** | **~$1/mo** |

**Cấu hình FREE:**
- 4 Ampere (ARM) cores — nhanh hơn cả DO $48/mo droplet
- 24 GB RAM — DƯ SỨC cho mọi thứ
- 200 GB boot volume
- 10 TB outbound/tháng

**Đăng ký:** https://www.oracle.com/cloud/free/

**Bước đăng ký Oracle Cloud:**
1. Vào link trên → **Start for Free**
2. Điền email, chọn **Home Region**: `ap-tokyo-1` (Nhật) hoặc `ap-singapore-1`
3. Xác thực email + số điện thoại
4. **KHÔNG CẦN thẻ credit** cho Always Free resources
5. Sau khi account active → vào **Compute** → **Create Instance**

**Tạo VM:**
1. **Compute** → **Instances** → **Create Instance**
2. Image: **Ubuntu 24.04** (Canonical)
3. Shape: **VM.Standard.A1.Flex** (ARM)
   - OCPU: **4** (max free)
   - Memory: **24 GB** (max free)
4. Boot volume: **200 GB**
5. Upload SSH public key
6. **Create**

**Lưu ý quan trọng:**
- Instance ARM → dùng Docker image `arm64` (hầu hết đã support)
- Region Tokyo/Singapore → ping tốt từ VN
- Oracle KHÔNG tự xóa VM free (đã confirmed policy 2025+)
- Nếu "Out of capacity" → thử lại sau vài giờ hoặc đổi availability domain

**Sau khi có VM**, follow tất cả bước từ [Mục 5](#5-cài-đặt-hạ-tầng-trên-server) trở đi — giống hệt.

Thêm bước mở port (Oracle firewall khác DO):
```bash
# Trên server Oracle — mở port trong iptables
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save

# Trong Oracle Console: Networking → Virtual Cloud Networks → Security List
# Thêm Ingress Rule: Source 0.0.0.0/0, TCP, Port 80,443
```

---

### Plan Budget C (~$5–10/mo) — Kết hợp Free Tiers

Chia nhỏ services ra nhiều platform free:

| Service | Provider | Cost |
|---------|----------|------|
| Frontend (Web + Admin) | **Vercel** Free | $0 |
| Backend API | **Railway** Hobby | $5/mo |
| PostgreSQL | **Supabase** Free (500MB) | $0 |
| Redis | **Upstash** Free (10K cmd/ngày) | $0 |
| Search | PostgreSQL FTS (bỏ Meilisearch) | $0 |
| Auth | **Clerk** Free (10K users) | $0 |
| Storage | **Cloudflare R2** Free (10GB) | $0 |
| Domain | | ~$1/mo |
| **Tổng** | | **~$6/mo** |

**Ưu điểm:** Auto-scaling, zero maintenance, global CDN.
**Nhược điểm:** Phải modify code (bỏ Keycloak → Clerk, bỏ Meilisearch → Postgres FTS). Phức tạp hơn.

> ⚠️ Plan C yêu cầu refactor code. Chỉ phù hợp nếu bạn sẵn sàng chỉnh sửa.

---

### So sánh tổng quan

| | Premium (DO) | Budget A (Hetzner) | Budget B (Oracle) | Budget C (Free mix) |
|---|---|---|---|---|
| **Chi phí** | ~$54/mo | ~$7/mo | ~$1/mo | ~$6/mo |
| **RAM** | 8 GB | 4 GB | 24 GB 🏆 | Varies |
| **Setup difficulty** | Dễ | Dễ | Trung bình | Khó |
| **Modify code?** | Không | Không | Không | Có |
| **Reliability** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Ping từ VN** | ~30ms (SG) | ~200ms (EU) | ~50ms (Tokyo) | ~100ms |
| **Support** | Tốt | Tốt | Kém | Tùy platform |
| **Phù hợp** | Production lớn | MVP/Startup | Side project/MVP | Devs có kinh nghiệm |

**Khuyến nghị cho $15/mo budget:**
- **Nếu muốn dễ nhất:** Hetzner CX22 (~$5) + domain ($1) = **$6/mo** ✅
- **Nếu muốn miễn phí nhất:** Oracle Free = **$1/mo** (chỉ domain) ✅
- **Nếu muốn mạnh nhất:** Oracle Free (24GB RAM > DO $48 droplet) ✅

---

## Tài liệu liên quan

- [Production Config Guide](../production-config-guide.md) — chi tiết cấu hình từng service
- [Keycloak Social Login Setup](../keycloak-social-login-setup.md) — Facebook, Apple, LINE login
- [Backup & Recovery](./backup-restore.md) — chiến lược backup nâng cao
- [Launch Checklist](./launch-checklist.md) — kiểm tra trước khi go-live
- [Data Migration](./data-migration-to-production.md) — migrate content từ dev sang prod
