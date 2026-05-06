# Keycloak (local Docker)

## Start

```bash
cd docker/keycloak
docker compose up -d
```

Open the admin console at [http://localhost:8080](http://localhost:8080) — bootstrap user **`admin` / `admin`**.

Sau `docker compose up -d`, đợi vài giây rồi kiểm tra job **`keycloak-configure-http`** (chạy một lần sau khi Keycloak healthy):

```bash
docker compose logs keycloak-configure-http
```

Khi thấy dòng `sslRequired=NONE applied`, Admin Console dùng HTTP ổn định. Nếu bạn mở `/admin` quá sớm có thể vẫn thấy **HTTPS required** một lần — F5 sau khi job xong.

### Lỗi "HTTPS required" trên Admin Console

Nguyên nhân thường gặp:

1. **Realm `master`** (login vào giao diện quản trị Keycloak) mặc định `sslRequired=external`. Truy cập bằng **IP LAN** (`http://192.168.x.x:8080`) hoặc hostname khác `localhost` được coi là *external* → bắt HTTPS.
2. Json import chỉ áp cho **`nihongo-bjt`**, **không** sửa `master`.

Cách xử lý có sẵn trong Compose: service **`keycloak-configure-http`** gọi `kcadm.sh` và đặt **`sslRequired=NONE`** cho `master` và `nihongo-bjt`.

**Chạy tay** (nếu job lỗi), từ máy host trong thư mục `docker/keycloak`:

```bash
docker compose exec keycloak /bin/bash -c '
  /opt/keycloak/bin/kcadm.sh config credentials \
    --server http://127.0.0.1:8080 --realm master \
    --user admin --password admin
  /opt/keycloak/bin/kcadm.sh update realms/master -s sslRequired=NONE
  /opt/keycloak/bin/kcadm.sh get realms/nihongo-bjt >/dev/null 2>&1 && \
    /opt/keycloak/bin/kcadm.sh update realms/nihongo-bjt -s sslRequired=NONE
'
```

(Đổi mật khẩu bootstrap nếu bạn đã đổi `KC_BOOTSTRAP_ADMIN_PASSWORD`.)

### Learner: `POST /api/auth/keycloak/password-login` → **403** `auth_method_not_allowed`

Keycloak trả `unauthorized_client` / `unsupported_grant_type` khi client OIDC **không** bật *Direct access grants* (Resource Owner Password). Script `configure-realms-http` ép lại `directAccessGrantsEnabled=true` cho `nihongo-web` và `nihongo-admin`.

Sau khi cập nhật repo, chạy lại job cấu hình (Keycloak đang chạy):

```bash
cd docker/keycloak
docker compose up -d keycloak
docker compose run --rm keycloak-configure-http
# Nếu vẫn 403: restart Keycloak để xả cache realm/client (một số bản Keycloak giữ cấu hình cũ trong cache)
docker compose restart keycloak
```

Trong `next dev`, response JSON có thêm `debug.errorDescription` từ Keycloak; server Next cũng `console.warn` một dòng `[password-login] Keycloak grant failed` kèm `error` / `error_description`.

## Realm import

- Realm **`nihongo-bjt`** is imported from `realm-export.json` on first startup (mounted as `nihongo-bjt-realm.json`, which matches Keycloak 26 directory import naming).
- Data persists in the `keycloak_data` volume. To re-import from scratch:

  ```bash
  docker compose down -v
  docker compose up -d
  ```

## Dev clients: `nihongo-web` and `nihongo-admin`

- Learner client: `nihongo-web`, redirect/web origin `http://localhost:3000`, secret from your local env.
- Admin client: `nihongo-admin`, redirect/web origin `http://localhost:3001`, dev secret `nihongo-admin-dev-secret`.
- Both are confidential OpenID Connect clients with standard flow, password grant for local dev, PKCE S256, and an audience mapper for their own client id.

## Test user

| Field    | Value        |
|----------|--------------|
| Username | `testuser`   |
| Email    | `test@test.com` |
| Password | `123456`     |
| Realm role | `user`   |

## App environment

Copy the example env files into your apps (or merge into existing `.env`):

- `env.web.local.example` → `apps/web/.env.local`
- `env.admin.local.example` → `apps/admin/.env.local`
- `env.api.example` → merge into the API process env (e.g. repo `.env` or `apps/api` loader)

Set `WEB_KEYCLOAK_*` for learner and `ADMIN_KEYCLOAK_*` for admin. The API should accept both audiences:
`KEYCLOAK_EXPECTED_AUDIENCE=nihongo-web,nihongo-admin`.

`NEXT_PUBLIC_*` variables can use either **`NEXT_PUBLIC_KEYCLOAK_ISSUER_URL`** or **`NEXT_PUBLIC_KEYCLOAK_URL` + `NEXT_PUBLIC_KEYCLOAK_REALM`** (see examples).

## Local HTTP (no TLS)

Docker Keycloak chạy **HTTP** trên cổng **8080**. Realm dev trong `realm-export.json` dùng **`sslRequired: none`** để không bắt HTTPS cho mọi request (tránh lỗi khi Next.js chạy `http://localhost:3000` / `3001`).

Compose thêm **`--hostname=http://localhost:8080`** để issuer và redirect từ Keycloak luôn là `http://`, không bị nâng cấp sang `https://localhost:8080`.

### Realm đã import từ trước (volume cũ)?

Import JSON **chỉ chạy lần đầu**. Nếu volume `keycloak_data` đã tồn tại, đổi `realm-export.json` **không** tự áp vào realm đang chạy. Chọn một cách:

1. **Reset volume** (mất data Keycloak local): `docker compose down -v && docker compose up -d`
2. **Hoặc** vào Keycloak Admin → Realm **nihongo-bjt** → *Realm settings* → *Login* → **Require SSL** = **None** → Save

### Biến môi trường app

- Dùng **`http://localhost:8080`** trong `NEXT_PUBLIC_ADMIN_KEYCLOAK_URL`, `ADMIN_KEYCLOAK_ISSUER_URL`, `KEYCLOAK_ISSUER_URL`, v.v. — **không** đặt `https://` trừ khi bạn thật sự bật TLS trước Keycloak.
- `ADMIN_PUBLIC_URL` / callback phải khớp redirect đã cấu hình (mặc định `http://localhost:3001`).
