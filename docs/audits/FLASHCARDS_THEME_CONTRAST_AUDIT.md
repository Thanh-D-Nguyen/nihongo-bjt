# Flashcards theme contrast audit — 2026-07-19

## Phạm vi và phương pháp

- Production được kiểm tra tại `https://app.34-87-55-1.sslip.io/vi/flashcards`. Khi không có session, route chuyển đúng sang `/vi/login?returnTo=%2Fvi%2Fflashcards`; vì vậy không thể thao tác card thật trên production trong môi trường audit.
- Ma trận chức năng được chụp local bằng chính `DeckStudySession` và `FlashcardStyleGrid`, không phải mock CSS riêng: 7 theme, front/back, 375×812, 768×1024, 1440×900, light/dark, long Japanese/Vietnamese, selected/hover/focus, loading/empty/error và reduced motion.
- Ảnh before là reconstruction deterministic từ background cũ và các class thực tế trước sửa (`text-white`, `text-emerald-300/80`, `border-white/10`).
- Ratio theo WCAG relative luminance. Với gradient, validator không suy diễn từ ảnh/gradient; mỗi theme bắt buộc khai báo `contentSurface` kiểm chứng được và `overlay` cho gradient.

## Kiến trúc trước sửa

| Hạng mục                  | Source of truth / implementation                                                               |
| ------------------------- | ---------------------------------------------------------------------------------------------- |
| Trang Flashcards          | `apps/web/app/[locale]/flashcards/page.tsx` → `FlashcardsPageClient`                           |
| Card review               | `review-session.tsx`                                                                           |
| Card học theo deck        | `deck-study-session.tsx`                                                                       |
| Theme picker              | `flashcard-style-picker.tsx`                                                                   |
| Danh sách theme           | PostgreSQL `FlashcardStyle`, seed `database/scripts/seeds/core/seed-flashcard-styles.ts`       |
| Lưu lựa chọn              | `UserProfile.flashcardStyleSlug`, API `/api/flashcards/styles/active`; không dùng localStorage |
| Dark mode                 | `class`/`data-theme` và preference profile; script blocking trong app shell tránh FOUC         |
| Reading assist dùng chung | `AnnotatedJapaneseText`/reading-assist layer; card hiện hỗ trợ reading reveal và ruby CSS      |
| Test trước audit          | Có Playwright/axe chung, chưa có test riêng cho theme Flashcards/contrast                      |

## Nguyên nhân gốc

1. DB config chỉ có các key trình bày rời rạc như `cardBg`, `textColor`, `accentColor`; không có contract semantic đầy đủ cho primary, muted, controls, border, focus và surface của gradient.
2. Container nhận `color` theo theme nhưng nội dung con trong `ReviewSession` ghi đè bằng `text-white`, `text-emerald-*`, `border-white/*`; `DeckStudySession` lại dùng `text-ink`, `text-muted`, `bg-white`. Preview và card thật vì thế không cùng source of truth.
3. Front/back có cấu trúc và hard-coded colors khác nhau, nên cùng một theme có thể đọc được ở một mặt nhưng không ở mặt còn lại.
4. Grid card mobile dùng `place-items-center` nhưng content child không có width constraint; intrinsic width 319px tràn khỏi content surface 249px và bị face `overflow-hidden` cắt mất chữ Nhật.
5. Toàn card từng mang semantics click trong khi chứa control con, tạo nested-interactive risk; selected state picker phụ thuộc nhiều vào ring/màu và loading/error/focus handling còn yếu.

## Matrix contrast

`Old primary` là `#ffffff` trên vùng nền xấu nhất của theme. `Old secondary` là màu thực sau alpha của `#6ee7b7` ở 80%. `New primary/muted` được đo trên `contentSurface`; cả front và back dùng cùng semantic pair.

| Theme            | Background / checked surface | Old primary | Old secondary | New primary | New muted | Front/back  | 375/768/1440 | Kết quả và sửa                                 |
| ---------------- | ---------------------------- | ----------: | ------------: | ----------: | --------: | ----------- | ------------ | ---------------------------------------------- |
| minimal-ink      | `#fff` / `#fff`              |     1.00 ❌ |       1.41 ❌ |    17.74 ✅ |   7.56 ✅ | Pass / Pass | Pass         | Dark ink semantic text/control                 |
| warm-paper       | `#faf6f1` / same             |     1.08 ❌ |       1.33 ❌ |    11.61 ✅ |   6.72 ✅ | Pass / Pass | Pass         | Brown foreground/muted + stable surface        |
| dark-focus       | `#1e1e2e` / same             |    16.40 ✅ |       7.35 ✅ |    15.68 ✅ |  11.05 ✅ | Pass / Pass | Pass         | Complete border/control/focus tokens           |
| sakura-bloom     | gradient / `#fff5f7`         |     1.07 ❌ |       1.34 ❌ |    13.03 ✅ |   7.44 ✅ | Pass / Pass | Pass         | Plum text + deterministic surface/overlay      |
| neon-tokyo       | gradient / `#17152b`         |    12.72 ✅ |       5.87 ✅ |    16.26 ✅ |  11.95 ✅ | Pass / Pass | Pass         | Opaque dark content surface + overlay          |
| ocean-calm       | gradient / `#e0f7fa`         |     1.11 ❌ |       1.29 ❌ |    10.95 ✅ |   6.70 ✅ | Pass / Pass | Pass         | Deep teal text + deterministic surface/overlay |
| gold-calligraphy | gradient / `#1a1a1a`         |    13.77 ✅ |       6.36 ✅ |    14.12 ✅ |  10.45 ✅ | Pass / Pass | Pass         | Warm light text + complete interaction tokens  |

Các cặp bổ sung sau sửa:

| Theme            | Accent pair | Control pair | Border | Focus ring |
| ---------------- | ----------: | -----------: | -----: | ---------: |
| minimal-ink      |        6.70 |        17.74 |   4.76 |       5.17 |
| warm-paper       |        7.09 |         9.07 |   5.35 |       6.59 |
| dark-focus       |        8.88 |        15.68 |   6.40 |       8.88 |
| sakura-bloom     |        7.88 |         7.88 |   5.78 |       7.38 |
| neon-tokyo       |       10.25 |        10.25 |   6.95 |      12.04 |
| ocean-calm       |        8.23 |         8.23 |   4.87 |       7.39 |
| gold-calligraphy |       10.26 |        14.12 |   5.59 |      12.80 |

Policy: primary, muted, accent và control ≥ 4.5:1; border và focus indicator ≥ 3:1. Tất cả theme pass validator.

## Thay đổi UX và accessibility

- Theme trở thành typed semantic contract; API learner loại config invalid, admin create/update/activate từ chối theme thiếu token hoặc không đạt contrast.
- Picker dùng button thật, `aria-pressed`, dấu check + label selected (không chỉ màu), focus ring, Escape/restore focus, retry/error/loading/empty, target tối thiểu 44px và horizontal snap scroll trên mobile.
- Preview dùng cùng token/surface với card thật.
- Flip dùng một button thật tồn tại xuyên suốt animation; focus không mất, inactive face có `aria-hidden` + `inert`, control con không làm flip ngoài ý muốn.
- Typography Nhật/Vietnamese dùng `clamp()`, wrap nhiều dòng, không ellipsis; vùng content có scroll dọc có chủ đích. CSS Grid được ràng buộc width để không cắt nội dung mobile.
- `prefers-reduced-motion` bỏ transition flip. Known/unknown/quiz feedback có icon/text, không truyền đạt bằng màu đơn thuần.
- Theme preference tiếp tục dùng persistence server hiện hữu, có schema validation và fallback `minimal-ink`; không thêm localStorage hoặc migration profile không cần thiết.

## Evidence và automated checks

- Production auth redirect: `artifacts/flashcards-audit/before/production-mobile-375x812-settled.png`.
- Before reconstruction: `artifacts/flashcards-audit/before/legacy-<theme>-<viewport>.png`.
- After captures: `artifacts/flashcards-audit/after/<theme>-<viewport>-<mode>-<front|back>.png`.
- Regression baselines: `e2e/flashcards-themes.visual.spec.ts-snapshots/`.
- Playwright matrix: 82/82 passed.
- Unit/component: 9/9 passed.
- Typecheck: shared, web, API, admin passed.
- Focused ESLint: 0 errors; Prisma validate and `git diff --check` passed.

## Giới hạn xác minh

- Không có credential production nên chưa thể xác minh dữ liệu/user entitlement thật sau login hoặc ghi preference trên production.
- Chromium visual matrix đã chạy; Mobile Safari/WebKit chưa chạy vì browser cache cài sẵn của môi trường có chữ ký lỗi. Implementation dùng `backface-visibility`, transform/opacity và reduced-motion theo CSS chuẩn, nhưng vẫn cần device-lab Safari trước release nếu đây là release gate.
- Automated tests và ma trận này chỉ chứng minh phạm vi Flashcards đã kiểm tra; không phải tuyên bố toàn ứng dụng đạt WCAG.

## Quyết định còn lại cho product owner

- Không có quyết định chặn release cho bản sửa contrast. Nếu muốn theme dùng ảnh nền trong tương lai, PO/design cần chọn asset có provenance; contract hiện yêu cầu thêm `contentSurface`/`overlay` kiểm chứng được và không cho phép component tự đoán màu từ ảnh.
