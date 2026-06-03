# Hướng dẫn cài đặt & chạy app Mobile (Flutter)

Guide thực hành để cài môi trường, cấu hình và chạy app **NihonGo BJT mobile**
(`apps/mobile/`) trên emulator/thiết bị thật. App là **client** của backend
NestJS sẵn có (REST + Keycloak OIDC), nên backend phải chạy trước.

> Kiến trúc & quy ước chi tiết: xem [README.md](README.md) và các doc `01`–`08`.
> File này chỉ tập trung vào **cài đặt và chạy**.

---

## 1. Yêu cầu môi trường

| Công cụ          | Phiên bản                       | Ghi chú                                                              |
| ---------------- | ------------------------------- | ------------------------------------------------------------------- |
| **Flutter SDK**  | kênh stable, Dart `>= 3.12.0`   | `pubspec.yaml` yêu cầu `sdk: ^3.12.0`. Kiểm tra: `flutter --version` |
| **Android**      | Android Studio + SDK + emulator | Cho build Android. `applicationId = com.nihongobjt.nihongo_bjt`     |
| **iOS** (tùy)    | Xcode + CocoaPods (macOS)       | Chỉ build được iOS trên macOS. Nên dùng CocoaPods `>= 1.16.2`       |
| **Backend BJT**  | đang chạy                       | API `:4000`, Keycloak `:8080` — xem mục 3                           |

Sau khi cài, chạy `flutter doctor` và sửa hết các mục báo lỗi (✗) trước khi tiếp tục.

```bash
flutter doctor -v
```

---

## 2. Cài dependencies & sinh code

Tất cả lệnh chạy **trong thư mục `apps/mobile/`**.

```bash
cd apps/mobile

# 1) Lấy package
flutter pub get

# 2) Sinh code (Drift DAO + json_serializable DTO). *.g.dart được commit nên
#    chỉ cần chạy lại khi sửa model/table.
dart run build_runner build

# 3) Sinh localization (gen-l10n) từ lib/l10n/*.arb
flutter gen-l10n
```

> `build_runner` và `gen-l10n` là **bắt buộc** nếu bạn vừa clone hoặc vừa sửa
> file generated. Bỏ qua sẽ gây lỗi biên dịch thiếu `*.g.dart` / `AppLocalizations`.

---

## 3. Chuẩn bị backend (bắt buộc)

App cần backend chạy. Theo infra notes của dự án:

| Service       | Local (từ Windows host)              | Lệnh khởi động (thư mục gốc repo) |
| ------------- | ------------------------------------ | --------------------------------- |
| API (NestJS)  | `http://localhost:4000`              | `pnpm dev:api`                    |
| Keycloak      | `http://localhost:8080`              | `docker compose -f docker/keycloak/docker-compose.yml up -d` |
| Realtime      | Socket.IO cùng host API              | đi kèm `pnpm dev:api`             |

> Docker (PostgreSQL/MinIO/Meilisearch/Keycloak/Redis) chạy trong **WSL**, không
> phải Windows host. Các container thường đã chạy sẵn; chỉ cần start API bằng
> `pnpm dev:api` ở thư mục gốc repo.

Keycloak realm: `nihongo-bjt`, public client mobile: `nihongo-mobile`
(PKCE, không secret trên thiết bị), redirect: `com.nihongobjt.app://oauth2redirect`.

---

## 4. Cấu hình môi trường (`--dart-define`)

App **không hard-code** URL. Mọi giá trị môi trường được inject lúc build qua
`--dart-define`. Nguồn: `lib/core/config/app_environment.dart`.

| Biến                   | Mặc định (dev)                                  | Ý nghĩa                                              |
| ---------------------- | ----------------------------------------------- | --------------------------------------------------- |
| `API_BASE_URL`         | `http://localhost:4000`                         | Base URL API (không dấu `/` cuối)                   |
| `KEYCLOAK_ISSUER`      | `http://localhost:8080/realms/nihongo-bjt`      | OIDC issuer (AppAuth tự discover `.well-known`)     |
| `OAUTH_CLIENT_ID`      | `nihongo-mobile`                                | Public client id (PKCE)                             |
| `OAUTH_REDIRECT_URI`   | `com.nihongobjt.app://oauth2redirect`           | Phải khớp manifest Android + URL type iOS           |
| `FLASHCARD_DATA_SOURCE`| `mock`                                          | `mock` = dữ liệu giả ổn định cho dev; `api` = API thật |

### ⚠️ Android emulator: reverse cổng localhost về máy host

Keycloak local advertise issuer `http://localhost:8080`. Dùng `adb reverse` để
issuer và discovery metadata khớp nhau, đồng thời forward API:

```bash
adb reverse tcp:4000 tcp:4000
adb reverse tcp:8080 tcp:8080
```

| Nền tảng                 | API base                  | Keycloak issuer                                  |
| ------------------------ | ------------------------- | ------------------------------------------------ |
| Android **emulator**     | `http://localhost:4000` qua `adb reverse` | `http://localhost:8080/realms/nihongo-bjt` qua `adb reverse` |
| iOS **simulator**        | `http://localhost:4000`   | `http://localhost:8080/realms/nihongo-bjt`       |
| **Thiết bị thật** (cùng Wi‑Fi) | `http://<IP-LAN-máy>:4000` | Cần cấu hình hostname HTTPS dev/proxy phù hợp     |

Password login có fallback riêng cho Android emulator: nếu token endpoint
`localhost` không kết nối được, app thử lại cùng endpoint qua host alias
`10.0.2.2`. Fallback này chỉ áp dụng cho form username/password; các flow
browser/AppAuth như Google/register hosted vẫn nên dùng `adb reverse` hoặc
`--dart-define=KEYCLOAK_ISSUER=...` đúng môi trường.

> Lấy IP LAN máy host: Windows `ipconfig` (IPv4), macOS/Linux `ifconfig`/`ip a`.
> Thiết bị thật và máy host phải cùng mạng; mở firewall cho port 4000 nếu cần.

---

## 5. Chạy app

### 5.1 — Chạy nhanh (dev, dùng default localhost / mock flashcards)

```bash
flutter devices          # liệt kê emulator/thiết bị đang kết nối
flutter run              # nếu chỉ 1 thiết bị; hoặc -d <deviceId>
```

### 5.2 — Chạy với cấu hình rõ ràng (khuyến nghị)

**Android emulator** (sau khi chạy `adb reverse` ở trên), flashcard dùng API thật:

```bash
flutter run \
  --dart-define=API_BASE_URL=http://localhost:4000 \
  --dart-define=KEYCLOAK_ISSUER=http://localhost:8080/realms/nihongo-bjt \
  --dart-define=FLASHCARD_DATA_SOURCE=api
```

> Windows PowerShell — nối lệnh bằng backtick `` ` `` thay vì `\`:
>
> ```powershell
> flutter run `
>   --dart-define=API_BASE_URL=http://localhost:4000 `
>   --dart-define=KEYCLOAK_ISSUER=http://localhost:8080/realms/nihongo-bjt `
>   --dart-define=FLASHCARD_DATA_SOURCE=api
> ```

**iOS simulator** (localhost dùng được trực tiếp):

```bash
flutter run \
  --dart-define=API_BASE_URL=http://localhost:4000 \
  --dart-define=KEYCLOAK_ISSUER=http://localhost:8080/realms/nihongo-bjt \
  --dart-define=FLASHCARD_DATA_SOURCE=api
```

### 5.3 — Quá nhiều `--dart-define`? Dùng file JSON

Gom config vào file để gõ ngắn lại:

`apps/mobile/config/dev.android.json`

```json
{
  "API_BASE_URL": "http://localhost:4000",
  "KEYCLOAK_ISSUER": "http://localhost:8080/realms/nihongo-bjt",
  "OAUTH_CLIENT_ID": "nihongo-mobile",
  "OAUTH_REDIRECT_URI": "com.nihongobjt.app://oauth2redirect",
  "FLASHCARD_DATA_SOURCE": "api"
}
```

```bash
flutter run --dart-define-from-file=config/dev.android.json
```

> File chứa URL theo môi trường — không commit giá trị prod. Thêm `config/*.json`
> vào `.gitignore` nếu chứa thông tin nhạy cảm.

---

## 6. Build bản phát hành (staging/prod)

URL prod truyền lúc build, không nằm trong source. Issuer prod phải là **HTTPS**
(app chỉ cho phép `http://` ở môi trường dev — xem `allowInsecureAuthConnections`).

**Android (APK / App Bundle):**

```bash
flutter build apk --release \
  --dart-define=API_BASE_URL=https://api.your-prod.com \
  --dart-define=KEYCLOAK_ISSUER=https://auth.your-prod.com/realms/nihongo-bjt \
  --dart-define=FLASHCARD_DATA_SOURCE=api

# hoặc App Bundle cho Google Play
flutter build appbundle --release --dart-define-from-file=config/prod.json
```

**iOS (macOS):**

Build để kiểm tra project iOS compile được, chưa ký code và chưa tạo IPA:

```bash
flutter build ios --release --no-codesign \
  --dart-define=API_BASE_URL=http://localhost:4000 \
  --dart-define=KEYCLOAK_ISSUER=http://localhost:8080/realms/nihongo-bjt \
  --dart-define=FLASHCARD_DATA_SOURCE=api
```

Artifact sau build nằm ở:

```text
apps/mobile/build/ios/iphoneos/Runner.app
```

Build IPA để cài TestFlight/App Store cần Apple Developer Team, signing
certificate, provisioning profile và cấu hình bundle id trong Xcode:

```bash
flutter build ipa --release --dart-define-from-file=config/prod.json
```

Nếu muốn debug trên iPhone/iPad thật trong cùng Wi-Fi, không dùng `localhost`
cho API/Keycloak. Truyền host mà thiết bị truy cập được, ví dụ:

```bash
flutter run -d <ios-device-id> \
  --dart-define=API_BASE_URL=http://<IP-LAN-may-mac>:4000 \
  --dart-define=KEYCLOAK_ISSUER=http://<IP-LAN-may-mac>:8080/realms/nihongo-bjt \
  --dart-define=FLASHCARD_DATA_SOURCE=api
```

Ghi chú môi trường hiện tại:

- `flutter_secure_storage` chưa hỗ trợ Swift Package Manager cho iOS, nên build
  hiện vẫn cần CocoaPods.
- Nếu `flutter doctor -v` cảnh báo CocoaPods cũ, nâng bằng Homebrew hoặc RubyGems
  theo cách bạn quản lý máy. Ví dụ Homebrew: `brew upgrade cocoapods`.

---

## 7. Kiểm tra sau khi chạy

1. **App mở được** màn hình đầu, không crash.
2. **Đăng nhập Keycloak**: nhấn sign-in → mở Custom Tab / Safari → đăng nhập →
   quay lại app (redirect `com.nihongobjt.app://oauth2redirect`). Token lưu trong
   secure storage (Keychain / EncryptedSharedPreferences).
3. **Gọi API**: màn hình có data (vd flashcards với `FLASHCARD_DATA_SOURCE=api`)
   → backend phản hồi, không lỗi mạng.
4. **Hiển thị media**: ảnh/audio câu hỏi tải được (URL phải là host truy cập được
   từ thiết bị, không phải `localhost` — xem
   [docs/ops/sync-bjt-question-images.md](../ops/sync-bjt-question-images.md)).

---

## 8. Lệnh dev hữu ích

```bash
flutter analyze                 # lint (very_good_analysis) — phải sạch
flutter test                    # unit/widget test
dart format .                   # format
flutter clean && flutter pub get  # reset khi build lỗi lạ

# Regenerate code sau khi sửa model/table/DTO:
dart run build_runner build
flutter gen-l10n
```

---

## 9. Lỗi thường gặp

| Triệu chứng                                   | Nguyên nhân                              | Cách xử lý                                                                 |
| --------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------- |
| `Connection refused` / API timeout (Android)  | dùng `localhost` trên emulator           | Đổi sang `http://10.0.2.2:4000`                                          |
| Đăng nhập xong không quay lại app             | redirect scheme sai                      | Khớp `OAUTH_REDIRECT_URI` với `appAuthRedirectScheme=com.nihongobjt.app` |
| Lỗi thiếu `*.g.dart` / `AppLocalizations`     | chưa chạy codegen                        | `dart run build_runner build` + `flutter gen-l10n`                       |
| iOS build báo signing/provisioning            | build IPA/device cần Apple signing       | Dùng `flutter build ios --release --no-codesign` để kiểm tra compile, hoặc cấu hình Team/Profile trong Xcode |
| iOS build báo Pods không đồng bộ              | `Podfile.lock` và Pods lệch nhau         | Chạy `cd apps/mobile/ios && pod install`, hoặc `flutter clean && flutter pub get` rồi build lại |
| Cleartext HTTP bị chặn (Android release)      | Android chặn `http://` mặc định          | Dev dùng HTTP ổn; **prod phải HTTPS** cho cả API và Keycloak             |
| Ảnh không hiện trên thiết bị thật             | URL media là `localhost`                 | Sync media + đổi host prod (guide ở mục 7)                               |
| `flutter doctor` báo Android licenses         | chưa accept SDK license                  | `flutter doctor --android-licenses`                                       |

---

## 10. Tham chiếu

- Kiến trúc tổng quan: [README.md](README.md)
- Auth Keycloak chi tiết: [05-auth-keycloak.md](05-auth-keycloak.md)
- Offline/sync storage: [06-offline-sync-storage.md](06-offline-sync-storage.md)
- Testing & CI/CD: [08-testing-ci-cd.md](08-testing-ci-cd.md)
- Sync media prod (ảnh hiện đúng trên app): [docs/ops/sync-bjt-question-images.md](../ops/sync-bjt-question-images.md)
- Config nguồn: `apps/mobile/lib/core/config/app_environment.dart`
