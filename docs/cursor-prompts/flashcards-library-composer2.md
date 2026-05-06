# Cursor Composer 2 Prompt — Flashcards Library Upgrade

Bạn đang làm trong repo `nihongo-bjt`. Hãy hoàn thiện trang learner `/vi/flashcards` theo hướng “Quizlet Your library trở lên”, nhưng giữ production baseline của AGENTS.md.

## Context hiện tại

- Trang chính: `apps/web/app/[locale]/flashcards/page.tsx`
- Library shell mới: `apps/web/app/[locale]/flashcards/_components/flashcards-page-client.tsx`
- Review SRS thật: `apps/web/app/[locale]/flashcards/_components/flashcards-client.tsx`
- Deck list/create thật: `apps/web/app/[locale]/flashcards/_components/deck-browser.tsx`
- API thật:
  - `GET /api/flashcards/reviews/due`
  - `POST /api/flashcards/reviews/:id`
  - `GET /api/flashcards/decks`
  - `POST /api/flashcards/decks`
  - `GET /api/learner/monetization/summary`
- i18n keys đã thêm trong `apps/web/messages/vi.json` và `apps/web/messages/ja.json` dưới namespace `flashcards`.

## Goal

Biến `/flashcards` thành thư viện học tập production-grade, không phải demo page:

- Có trải nghiệm giống thư viện học tập: search, sidebar navigation, recent/owned/public sets, review queue.
- Mobile-first, desktop dense như product app, không landing page.
- Dữ liệu phải lấy từ API thật; không dùng fake persistent state.
- User-facing text phải qua i18n.
- Không làm frontend-only paywall.
- Không làm chart giả.

## Work items

1. Hoàn thiện `FlashcardsPageClient`
   - Sidebar responsive: Review, My sets, Public sets, Recent, Create.
   - Search filter phải filter deck list thật phía client sau khi tải từ API, hoặc thêm API query nếu backend đã hỗ trợ.
   - Desktop layout 2 cột; mobile có top segmented nav và search sticky vừa phải.
   - Hero compact, không chiếm quá nhiều chiều cao.

2. Refactor `DeckBrowser`
   - Tách component reusable `DeckCard`, `DeckGrid`, `CreateDeckPanel`.
   - Thêm view mode: grid/list.
   - Card hiển thị: title, description, visibility, status, card count, updated/created nếu API có.
   - Empty states rõ ràng cho private/public/search no result.
   - Create deck nên mở trong inline panel hoặc modal nhẹ, không đẩy layout quá mạnh.

3. Refactor `FlashcardsClient`
   - Review panel nằm gọn trong library, không lặp lại title quá lớn.
   - CTA rõ: refresh, reveal, again/hard/good.
   - Trạng thái offline sync/quota/error đặt trong status strip.
   - Card học phải có kích thước ổn định, không nhảy layout khi reveal.

4. Backend nếu cần
   - Nếu deck API thiếu `updatedAt`, `createdAt`, `_count.cards`, thêm select thật trong `FlashcardsRepository.decks`.
   - Nếu cần search server-side, thêm query validation vào shared schema rồi implement repository filter.
   - Có test cho repository/service nếu thay API.

5. Quality bar
   - Không thêm dependency icon nếu không cần; nếu project đã có icon library thì dùng library đó.
   - Không dùng text hard-code ngoài fallback kỹ thuật. Thêm keys vi/ja.
   - Giữ accessibility: tab roles, labels, focus states.
   - Text không tràn trên mobile.
   - Không dùng card trong card quá sâu.

## Suggested design direction

“Study command center”: một thư viện yên tĩnh, rõ thứ bậc, phục vụ học lặp lại hằng ngày. Màu nền sáng, surface trắng, điểm nhấn xanh lá/ink; layout như app productivity chứ không marketing. Signature differentiator: left rail + search + learning status strip giúp người học thấy ngay hôm nay cần làm gì.

## Verification

Chạy tối thiểu:

```bash
pnpm --filter @nihongo-bjt/web typecheck
```

Nếu sửa API:

```bash
pnpm --filter @nihongo-bjt/api typecheck
pnpm test <relevant-test-files>
```

Sau đó dùng browser check:

- Login bằng user test hiện có.
- Mở `http://localhost:3000/vi/flashcards`.
- Kiểm tra desktop 1440px và mobile 390px.
- Kiểm tra tab Review/Decks, create deck, empty state, error/loading không vỡ layout.
