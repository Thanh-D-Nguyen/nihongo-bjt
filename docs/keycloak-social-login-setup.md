# Keycloak Social Login (IdP) — Hướng dẫn cấu hình

> Cấu hình Google, Facebook, Apple, LINE trong Keycloak để Social Login hoạt động.
> Keycloak hoàn toàn ẩn — user không bao giờ thấy giao diện Keycloak.

---

## Tổng quan kiến trúc

```
User clicks "Đăng nhập bằng Google"
  → App (/api/auth/keycloak/authorize?idp=google)
    → Keycloak (kc_idp_hint=google, auto-redirect, KHÔNG hiện UI)
      → Google OAuth consent screen
        → Google callback → Keycloak
          → App callback (/auth/callback)
            → Set cookies, redirect về app
```

**Tại sao Keycloak không hiện?**
- `kc_idp_hint=google` bảo Keycloak redirect thẳng sang Google, bỏ qua form đăng nhập
- Logout dùng backchannel (server-side token revocation), không redirect qua Keycloak
- URL Keycloak chỉ flash < 1 giây trong address bar khi redirect (không hiện UI)
- Dùng domain riêng `auth.nihongo-bjt.com` thay vì URL Keycloak trực tiếp

---

## Yêu cầu trước khi bắt đầu

- [ ] Keycloak đang chạy (port 8080 local, hoặc auth.nihongo-bjt.com)
- [ ] Realm `nihongo-bjt` đã tạo
- [ ] Client `nihongo-web` đã cấu hình (confidential, PKCE)
- [ ] Admin access vào Keycloak console

---

## 1. Google Identity Provider

### 1.1 Tạo OAuth App trên Google Cloud Console

1. Vào https://console.cloud.google.com/apis/credentials
2. Tạo project hoặc chọn project hiện có
3. **Create Credentials → OAuth 2.0 Client ID**
4. Application type: **Web application**
5. Name: `NihonGo BJT`
6. Authorized redirect URIs:
   ```
   # Local dev
   http://localhost:8080/realms/nihongo-bjt/broker/google/endpoint
   
   # Production
   https://auth.nihongo-bjt.com/realms/nihongo-bjt/broker/google/endpoint
   ```
7. Copy **Client ID** và **Client Secret**

### 1.2 Cấu hình trong Keycloak

1. Keycloak Admin → Realm `nihongo-bjt` → **Identity Providers** → **Add provider** → **Google**
2. Điền:

| Field | Value |
|-------|-------|
| Alias | `google` |
| Display Name | `Google` |
| Enabled | ON |
| Client ID | `<từ Google Cloud Console>` |
| Client Secret | `<từ Google Cloud Console>` |
| Default Scopes | `openid email profile` |
| Trust Email | **ON** ⚠️ (quan trọng — bỏ qua email verification) |
| First Login Flow | `first broker login` |
| Sync Mode | `import` |
| Store Tokens | OFF |

3. **Advanced** tab:
   - Prompt: (để trống — Google tự quyết)
   - Accept prompt=none: ON

### 1.3 First Broker Login Flow

Vào **Authentication** → **first broker login** → kiểm tra:

- **Review Profile** → `REQUIRED` (lần đầu) hoặc `DISABLED` (auto-create)
- Nên set **DISABLED** cho smooth UX — user không phải review profile

---

## 2. Facebook Identity Provider

### 2.1 Tạo App trên Meta Developer

1. Vào https://developers.facebook.com/apps/
2. **Create App** → Type: **Consumer** → Platform: **Web**
3. Vào **App Settings** → **Basic**:
   - App Domains: `nihongo-bjt.com`, `auth.nihongo-bjt.com`, `localhost`
4. Vào **Products** → **Facebook Login** → **Settings**:
   - Valid OAuth Redirect URIs:
     ```
     http://localhost:8080/realms/nihongo-bjt/broker/facebook/endpoint
     https://auth.nihongo-bjt.com/realms/nihongo-bjt/broker/facebook/endpoint
     ```
5. Copy **App ID** và **App Secret**

### 2.2 Cấu hình trong Keycloak

1. **Identity Providers** → **Add provider** → **Facebook**
2. Điền:

| Field | Value |
|-------|-------|
| Alias | `facebook` |
| Display Name | `Facebook` |
| Client ID | `<App ID>` |
| Client Secret | `<App Secret>` |
| Default Scopes | `email public_profile` |
| Trust Email | **ON** |
| First Login Flow | `first broker login` |

---

## 3. Apple Identity Provider

### 3.1 Tạo trên Apple Developer

1. Vào https://developer.apple.com/account/
2. **Certificates, Identifiers & Profiles**
3. **Identifiers** → tạo **App ID** (nếu chưa có):
   - Bundle ID: `com.nihongo-bjt.web`
   - Capabilities: tick **Sign In with Apple**
4. **Identifiers** → tạo **Service ID**:
   - Description: `NihonGo BJT Web Login`
   - Identifier: `com.nihongo-bjt.web.login`
   - Tick **Sign In with Apple** → Configure:
     - Primary App ID: chọn App ID ở trên
     - Domains: `nihongo-bjt.com`, `auth.nihongo-bjt.com`, `localhost`
     - Return URLs:
       ```
       http://localhost:8080/realms/nihongo-bjt/broker/apple/endpoint
       https://auth.nihongo-bjt.com/realms/nihongo-bjt/broker/apple/endpoint
       ```
5. **Keys** → tạo Key:
   - Name: `NihonGo BJT Sign In`
   - Tick **Sign In with Apple** → Configure → chọn Primary App ID
   - Download `.p8` file → **lưu cẩn thận, chỉ download 1 lần**
   - Ghi nhận **Key ID**
6. Ghi nhận **Team ID** (góc trên phải Apple Developer page)

### 3.2 Tạo Client Secret cho Apple

Apple dùng JWT làm client secret (rotate mỗi 6 tháng):

```bash
# Tạo JWT client secret
# Cần: Team ID, Service ID, Key ID, .p8 key file

# Dùng script hoặc tool:
# https://github.com/nicklockwood/keycloak-apple-social-identity-provider

# Hoặc Keycloak tự generate nếu dùng provider "Apple" built-in
```

### 3.3 Cấu hình trong Keycloak

1. **Identity Providers** → **Add provider** → **Apple**
   (Nếu Keycloak 26 không có Apple built-in, dùng **OpenID Connect v1.0** custom)

| Field | Value |
|-------|-------|
| Alias | `apple` |
| Display Name | `Apple` |
| Client ID | `com.nihongo-bjt.web.login` (Service ID) |
| Client Secret | JWT từ bước 3.2 |
| Trust Email | **ON** |
| Authorization URL | `https://appleid.apple.com/auth/authorize` |
| Token URL | `https://appleid.apple.com/auth/token` |
| Default Scopes | `name email` |

> ⚠️ Apple yêu cầu domain verification. Đặt file verification tại:
> `https://nihongo-bjt.com/.well-known/apple-developer-domain-association.txt`

---

## 4. LINE Identity Provider

### 4.1 Tạo Channel trên LINE Developers

1. Vào https://developers.line.biz/console/
2. **Create a new provider** (hoặc chọn existing)
3. **Create a LINE Login channel**:
   - Channel name: `NihonGo BJT`
   - Channel description: `Japanese BJT learning app`
   - App types: tick **Web app**
   - Email address: admin email
4. Sau khi tạo, vào tab **LINE Login**:
   - Callback URL:
     ```
     http://localhost:8080/realms/nihongo-bjt/broker/line/endpoint
     https://auth.nihongo-bjt.com/realms/nihongo-bjt/broker/line/endpoint
     ```
5. Tab **Basic settings**:
   - Copy **Channel ID** và **Channel secret**
6. Publish channel (chuyển từ Developing → Published)

### 4.2 Cấu hình trong Keycloak

LINE không có provider built-in trong Keycloak. Dùng **OpenID Connect v1.0**:

1. **Identity Providers** → **Add provider** → **OpenID Connect v1.0**
2. Điền:

| Field | Value |
|-------|-------|
| Alias | `line` |
| Display Name | `LINE` |
| Client ID | `<Channel ID>` |
| Client Secret | `<Channel secret>` |
| Client Authentication | `Client secret sent as post` |
| Discovery endpoint | (để trống — LINE không có full OIDC discovery) |
| Authorization URL | `https://access.line.me/oauth2/v2.1/authorize` |
| Token URL | `https://api.line.me/oauth2/v2.1/token` |
| User Info URL | `https://api.line.me/v2/profile` |
| JWKS URL | `https://api.line.me/oauth2/v2.1/certs` |
| Issuer | `https://access.line.me` |
| Default Scopes | `profile openid email` |
| Validate Signatures | ON |
| Trust Email | **ON** |
| First Login Flow | `first broker login` |

### Mapper cho LINE (lấy display name + avatar)

Vào Identity Provider `line` → **Mappers** → **Add mapper**:

| Mapper Name | Mapper Type | Claim | User Attribute |
|-------------|------------|-------|----------------|
| `line-displayname` | Attribute Importer | `name` | `displayName` |
| `line-picture` | Attribute Importer | `pictureUrl` | `picture` |

---

## 5. Cấu hình chung trong Keycloak

### 5.1 Realm Settings → Login

| Setting | Value | Lý do |
|---------|-------|-------|
| User registration | ON | Cho phép tạo tài khoản mới |
| Email as username | OFF | Dùng username riêng |
| Login with email | ON | Cho phép login bằng email |
| Verify email | ON (production) | Xác thực email |
| SSL required | all (production) | Bắt buộc HTTPS |

### 5.2 First Broker Login Flow (quan trọng!)

Khi user login qua social lần đầu, Keycloak chạy "First Broker Login" flow.

Vào **Authentication** → **Flows** → **first broker login**:

**Khuyến nghị cho UX mượt:**
- `Review Profile` → **DISABLED** (không hỏi user review profile)
- `Create User If Unique` → **ALTERNATIVE** 
- `Confirm Link Existing Account` → **ALTERNATIVE**
- `Verify Existing Account by Re-authentication` → **ALTERNATIVE**

> ⚠️ **Bảo mật:** Nếu disable Review Profile, user sẽ được tự động tạo account.
> Nếu có 2 provider dùng cùng email, flow sẽ hỏi link account.
> Đảm bảo **Trust Email = ON** cho mỗi IdP để tránh Keycloak gửi email verification.

### 5.3 Client `nihongo-web` Settings

Kiểm tra client đã cấu hình đúng:

| Setting | Value |
|---------|-------|
| Client Protocol | openid-connect |
| Access Type | confidential |
| Standard Flow | Enabled |
| Direct Access Grants | Enabled |
| Valid Redirect URIs | `http://localhost:3000/*`, `https://nihongo-bjt.com/*` |
| Web Origins | `http://localhost:3000`, `https://nihongo-bjt.com` |
| Backchannel Logout URL | (để trống — app dùng token revocation) |

---

## 6. Environment Variables

Sau khi cấu hình xong Keycloak, set các biến trong `apps/web/.env.local`:

```env
# Social Login — set IdP alias đúng với alias trong Keycloak
NEXT_PUBLIC_AUTH_GOOGLE_IDP_HINT=google
NEXT_PUBLIC_AUTH_FACEBOOK_IDP_HINT=facebook
NEXT_PUBLIC_AUTH_APPLE_IDP_HINT=apple
NEXT_PUBLIC_AUTH_LINE_IDP_HINT=line
```

Để **tắt** provider nào, xóa hoặc comment dòng tương ứng:
```env
# NEXT_PUBLIC_AUTH_APPLE_IDP_HINT=apple    ← Apple bị tắt
```

---

## 7. Testing

### 7.1 Test flow từng provider

1. Mở `http://localhost:3000/vi/login`
2. Click nút social login (Google/Facebook/LINE/Apple)
3. Kiểm tra:
   - [ ] Redirect thẳng sang provider (KHÔNG thấy form Keycloak)
   - [ ] Sau khi auth ở provider, redirect về app
   - [ ] User được tạo trong Keycloak (kiểm tra Users)
   - [ ] Cookie `kc_access_token` và `kc_refresh_token` được set
   - [ ] Profile hiển thị đúng tên/email

### 7.2 Test logout

1. Sau khi login, click Logout
2. Kiểm tra:
   - [ ] Redirect về trang login (KHÔNG thấy Keycloak)
   - [ ] Cookie bị xóa
   - [ ] Refresh token bị revoke (check Keycloak Sessions)

### 7.3 Test account linking

1. Login bằng Google với email `user@gmail.com`
2. Logout
3. Login bằng email/password với cùng email
4. Kiểm tra:
   - [ ] Keycloak link 2 phương thức vào cùng 1 user
   - [ ] Không tạo duplicate user

---

## 8. Troubleshooting

| Vấn đề | Nguyên nhân | Fix |
|---------|-------------|-----|
| Keycloak hiện form login | `kc_idp_hint` không match alias | Kiểm tra alias trong Keycloak = giá trị env var |
| "Invalid redirect_uri" | Redirect URI chưa đăng ký | Thêm URI vào cả provider console VÀ Keycloak client |
| User phải verify email | `Trust Email` = OFF | Bật Trust Email cho IdP trong Keycloak |
| Keycloak hỏi "Review Profile" | First Broker Login flow | Disable "Review Profile" step |
| "Account already exists" | Email conflict | Cấu hình account linking trong First Broker Login |
| LINE không lấy được email | Chưa request permission | LINE cần `email` scope VÀ user phải cho phép |
| Apple không redirect về | Domain chưa verify | Thêm apple-developer-domain-association.txt |

---

## 9. Security Checklist

- [ ] Tất cả IdP đều có **Trust Email = ON**
- [ ] First Broker Login **không hiện UI Keycloak** cho user
- [ ] Client secrets được lưu an toàn (không commit vào git)
- [ ] Production dùng HTTPS cho tất cả redirect URIs
- [ ] Apple client secret được rotate mỗi 6 tháng
- [ ] LINE channel đã Published (không còn Developing)
- [ ] Facebook app đã qua App Review (nếu cần public access)
- [ ] Google app đã set OAuth consent screen (production mode)
