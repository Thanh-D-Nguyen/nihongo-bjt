import type { HelpContent } from "@nihongo-bjt/ui";

/**
 * Contextual help content registry for all admin pages.
 * Keyed by route path (without locale prefix).
 * Content based on actual page implementations.
 */
export const ADMIN_HELP_CONTENT: Record<string, HelpContent> = {
  /* ───── Overview & System ───── */
  "/": {
    title: "Tổng quan Admin",
    description:
      "Dashboard hiển thị KPI cards (người dùng, nội dung, hoạt động học), biểu đồ trend, và trạng thái hệ thống tổng hợp.",
    steps: [
      { title: "Xem KPI Cards", description: "Các thẻ số liệu chính hiển thị ở đầu trang với trend tăng/giảm." },
      { title: "Kiểm tra System Status", description: "Thanh trạng thái cho biết các service (DB, Redis, Search) có đang hoạt động." },
      { title: "Xem biểu đồ", description: "Charts hiển thị xu hướng người dùng và hoạt động theo thời gian." },
      { title: "Đi tới chi tiết", description: "Click vào từng KPI card để navigate đến trang analytics chi tiết." },
    ],
    tips: [
      "Trang này chỉ đọc — không có nút chỉnh sửa. Dữ liệu tự động refresh.",
      "Nếu thấy service status đỏ, kiểm tra ngay trang System Health.",
    ],
    relatedLinks: [
      { label: "System Health", href: "/system/health" },
      { label: "Analytics", href: "/analytics" },
    ],
  },

  "/system/health": {
    title: "Sức khỏe Hệ thống",
    description:
      "Theo dõi realtime trạng thái tất cả services: Database, Redis, Meilisearch, BullMQ queues.",
    steps: [
      { title: "Đọc trạng thái", description: "Mỗi service hiển thị badge xanh (OK) hoặc đỏ (lỗi) cùng response time." },
      { title: "Refresh thủ công", description: "Bấm nút Refresh nếu cần cập nhật ngay (trang tự refresh mỗi 30 giây)." },
    ],
    tips: [
      "Trang chỉ đọc — không cần quyền đặc biệt.",
      "Database và Redis là critical services. Nếu down, toàn bộ ứng dụng bị ảnh hưởng.",
    ],
  },

  "/system/queue-health": {
    title: "Queue Health (BullMQ)",
    description:
      "Giám sát hàng đợi BullMQ: số job pending, in-progress, failed, completed. Có thể Pause/Resume/Drain queue.",
    steps: [
      { title: "Xem tổng quan queues", description: "Bảng hiển thị tất cả queue names và số lượng job theo trạng thái." },
      { title: "Pause/Resume queue", description: "Click nút Pause để tạm dừng queue processing, Resume để chạy lại." },
      { title: "Drain queue", description: "Nút Drain xóa tất cả waiting jobs — CẨN THẬN, không thể undo." },
    ],
    tips: [
      "Mọi thao tác (pause/resume/drain) đều được ghi audit log.",
      "Cần quyền iam.manage để thực hiện thao tác.",
      "Nếu queue bị tắc (waiting tăng liên tục), kiểm tra worker có bị crash không.",
    ],
  },

  "/system/search-sync": {
    title: "Đồng bộ Meilisearch",
    description:
      "Xem trạng thái đồng bộ giữa PostgreSQL và Meilisearch: tuổi index, số documents, lần sync cuối.",
    steps: [
      { title: "Kiểm tra index age", description: "Mỗi index hiển thị thời gian kể từ lần sync cuối. Đỏ = quá cũ." },
      { title: "Full Reindex", description: "Bấm 'Full Reindex' để rebuild toàn bộ index (mất vài phút)." },
      { title: "Partial Reindex", description: "Chọn index cụ thể → bấm Sync để đồng bộ riêng index đó." },
    ],
    tips: [
      "Cần quyền iam.manage.",
      "Full reindex ảnh hưởng search performance tạm thời. Nên chạy ngoài giờ cao điểm.",
      "Nếu learner không search được nội dung mới, kiểm tra sync age ở đây.",
    ],
  },

  "/system/release": {
    title: "Quản lý Release",
    description:
      "Theo dõi phiên bản hiện tại, lịch sử release, đánh dấu Known-Good và chuẩn bị Rollback.",
    steps: [
      { title: "Xem version hiện tại", description: "Header hiển thị version number và build info đang chạy." },
      { title: "Mark Known-Good", description: "Đánh dấu version ổn định — làm điểm rollback an toàn." },
      { title: "Prepare Rollback", description: "Chuẩn bị rollback về version Known-Good gần nhất." },
    ],
    tips: [
      "Cần quyền iam.manage.",
      "Chỉ mark Known-Good sau khi version đã chạy ổn định ít nhất 24h.",
    ],
  },

  /* ───── Content Management ───── */
  "/content": {
    title: "Content Hub",
    description:
      "Dashboard nội dung hiển thị KPI: tổng số lexeme, kanji, grammar patterns, ví dụ câu. Từ đây navigate đến từng công cụ quản lý.",
    steps: [
      { title: "Xem số liệu tổng hợp", description: "KPI cards cho biết lượng content hiện có trong hệ thống." },
      { title: "Navigate đến công cụ", description: "Click vào card hoặc dùng sidebar để vào Dictionary, Kanji, Grammar, Media." },
    ],
    tips: [
      "Trang chỉ đọc — hiển thị overview. Để tạo/sửa content, vào trang con cụ thể.",
    ],
    relatedLinks: [
      { label: "Dictionary", href: "/dictionary" },
      { label: "Kanji", href: "/kanji" },
      { label: "Grammar", href: "/grammar" },
      { label: "Media", href: "/media" },
      { label: "Enrichment", href: "/content/enrichment" },
      { label: "Versions", href: "/content/versions" },
    ],
  },

  "/dictionary": {
    title: "Từ điển (Lexeme)",
    description:
      "Quản lý kho từ vựng. Bảng dữ liệu với cột: từ, đọc, nghĩa, JLPT level. Hỗ trợ Create/Edit/Delete và filter theo level/reading.",
    steps: [
      { title: "Tìm từ", description: "Dùng thanh search để tìm theo từ tiếng Nhật, đọc, hoặc nghĩa." },
      { title: "Filter theo level", description: "Dropdown JLPT level (N5–N1) lọc nhanh theo nhóm." },
      { title: "Tạo từ mới", description: "Bấm nút Create → nhập form: từ, đọc, nghĩa, level, ví dụ." },
      { title: "Sửa/Xóa", description: "Click row → drawer bên phải hiển thị chi tiết → Edit hoặc Delete." },
    ],
    tips: [
      "Cần quyền admin.content.write để tạo/sửa/xóa.",
      "Mỗi thay đổi tạo content version — có thể rollback tại Content Versions.",
      "Export CSV có sẵn để backup hoặc review offline.",
    ],
  },

  "/kanji": {
    title: "Kanji",
    description:
      "Quản lý kho Kanji. Bảng hiển thị: kanji, on/kun-yomi, nghĩa, school level, stroke count. Filter theo stroke count và level.",
    steps: [
      { title: "Tìm kanji", description: "Search theo kanji character hoặc reading." },
      { title: "Filter", description: "Lọc theo stroke count hoặc school level." },
      { title: "Tạo/Sửa/Xóa", description: "Giống Dictionary — Create button ở header, click row để edit." },
    ],
    tips: [
      "Cần quyền admin.content.write.",
      "Kanji có thể link với lexeme entries để tạo liên kết học tập.",
    ],
  },

  "/grammar": {
    title: "Ngữ pháp (Grammar)",
    description:
      "Quản lý mẫu ngữ pháp. Bảng: pattern, cấu trúc, nghĩa tiếng Việt, JLPT level, category. Filter theo level và category.",
    steps: [
      { title: "Tìm ngữ pháp", description: "Search theo tên pattern hoặc nghĩa tiếng Việt." },
      { title: "Filter", description: "Lọc theo JLPT level hoặc category (business, daily, etc.)." },
      { title: "Tạo/Sửa/Xóa", description: "Create button, click row → edit drawer." },
    ],
    tips: [
      "Cần quyền admin.content.write.",
      "Grammar patterns nên có ví dụ trong cả business và daily context cho BJT prep.",
    ],
  },

  "/media": {
    title: "Quản lý Media",
    description:
      "Quản lý media assets. Bảng hiển thị: filename, MIME type, size, rights status, license. Hỗ trợ Edit/Delete và Export CSV.",
    steps: [
      { title: "Xem assets", description: "Bảng liệt kê tất cả files đã upload: ảnh, audio, video." },
      { title: "Edit metadata", description: "Click row → sửa alt text, license info, rights status." },
      { title: "Delete asset", description: "Xóa file không còn sử dụng." },
      { title: "Export CSV", description: "Download danh sách assets dạng CSV." },
    ],
    tips: [
      "Cần quyền admin.content.write để edit/delete.",
      "Rights status quan trọng — đảm bảo mỗi asset có license hợp lệ.",
    ],
  },

  "/content/enrichment": {
    title: "Enrichment Pipeline",
    description:
      "Theo dõi và quản lý quá trình enrichment tự động (furigana, TTS audio, translation). Bảng hiển thị: entity type, ID, enrichment type, status, attempts, error, timestamps.",
    steps: [
      { title: "Filter theo status", description: "Dùng dropdown Status (queued/running/succeeded/failed/cancelled) để xem nhóm cần quan tâm." },
      { title: "Xem chi tiết", description: "Click row → drawer hiển thị full error message, retry history, result JSON." },
      { title: "Retry failed items", description: "Chọn item failed → bấm Retry (cần nhập reason). Hỗ trợ bulk retry qua checkbox." },
      { title: "Cancel item", description: "Hủy enrichment đang queued/running nếu không cần thiết." },
    ],
    tips: [
      "Bulk Retry: tick nhiều rows → bấm nút 'Bulk Retry' ở header.",
      "Filter theo Provider và Date Range để tìm nhanh batch bị lỗi.",
      "Export CSV để phân tích offline.",
      "Mọi retry/cancel đều cần nhập reason (≥3 ký tự) và được ghi audit.",
    ],
  },

  "/content/versions": {
    title: "Phiên bản Nội dung",
    description:
      "Lịch sử phiên bản content. Bảng: entity type, entity ID, version number, status (draft/published/superseded), title, author, timestamps.",
    steps: [
      { title: "Tìm version", description: "Search theo title, filter theo Status, Entity Type, Author, Date Range." },
      { title: "Xem chi tiết", description: "Click row → drawer hiển thị change summary và snapshot JSON." },
      { title: "So sánh (Diff)", description: "Bấm 'Compare with current' để xem unified diff hoặc JSON diff (path, op, before/after)." },
      { title: "Revert", description: "Bấm 'Revert' để khôi phục version cũ. Cần nhập reason." },
    ],
    tips: [
      "Revert tạo version MỚI (không xóa lịch sử) — an toàn để thử.",
      "Diff mode: unified text hiển thị added/removed lines, JSON mode hiển thị path-level changes.",
      "Export CSV cho audit offline.",
    ],
  },

  "/i18n": {
    title: "Quản lý Đa ngôn ngữ (i18n)",
    description:
      "Quản lý translation keys cho toàn app. KPI hiển thị: pending keys, complete keys, top pending namespaces. Bảng: namespace, key, giá trị VI/JA/EN, status.",
    steps: [
      { title: "Xem KPI đầu trang", description: "Cards cho biết bao nhiêu keys chưa dịch xong và namespaces nào nhiều nhất." },
      { title: "Filter keys", description: "Tìm theo key hoặc namespace. Tab status: all/untranslated/complete." },
      { title: "Sửa translation", description: "Click row → drawer detail → bấm Edit cho locale cần sửa → nhập giá trị mới + reason." },
      { title: "Export CSV", description: "Download toàn bộ translation keys." },
    ],
    tips: [
      "Mỗi edit yêu cầu reason để audit.",
      "Focus vào tab 'untranslated' để nhanh chóng hoàn thiện bản dịch.",
      "Key format: namespace.section.name (ví dụ: content.dictionary.title).",
    ],
  },

  "/announcements": {
    title: "Thông báo (Announcements)",
    description:
      "Tạo và quản lý thông báo hiển thị cho learner. Hỗ trợ nhiều format (banner/modal), effects (confetti/sakura/shimmer...), targeting, scheduling.",
    steps: [
      { title: "Tạo thông báo", description: "Bấm Create → chọn Type (info/event/promo), Format (banner/modal), Target (all/free/premium)." },
      { title: "Viết nội dung", description: "Nhập Title và Body cho 3 ngôn ngữ (VI/EN/JA). Thêm CTA link nếu cần." },
      { title: "Cấu hình hiển thị", description: "Chọn Effects (confetti, sakura...), Background Preset, Show Frequency (every_visit/once_per_day/once_ever)." },
      { title: "Upload ảnh", description: "Kéo thả hoặc chọn file (tối đa 5MB). Hoặc paste URL." },
      { title: "Lên lịch", description: "Set startsAt/endsAt. Nếu không set, hiển thị ngay khi Active." },
      { title: "Bật/Tắt", description: "Toggle Active để bật/tắt hiển thị. Delete để xóa vĩnh viễn." },
    ],
    tips: [
      "Status tự động: Ẩn (inactive), Lên lịch (scheduled), Đang hiển thị (active), Hết hạn (expired).",
      "Allow Close Button: cho phép learner đóng thông báo.",
      "Dismiss Delay: số milliseconds trước khi cho phép đóng (tạo urgency).",
      "Priority: số càng nhỏ hiển thị trước. Không nên hiển thị quá 2 thông báo cùng lúc.",
    ],
  },

  /* ───── Learning ───── */
  "/daily-hub": {
    title: "Daily Hub",
    description:
      "Quản lý nội dung daily items cho learner. Có 2 tab: Items (danh sách daily items) và Configs (cấu hình). Items có 9 widget types: weather, business, housing, v.v.",
    steps: [
      { title: "Xem danh sách Items", description: "Bảng: Kind (emoji widget type), Date, Locale, Title, Japanese Text, Status, Updated. 25 items/trang." },
      { title: "Filter items", description: "Lọc theo Status (draft/scheduled/published/archived), Locale, Widget Kind, Date Range." },
      { title: "Tạo item mới", description: "Bấm Create → form: contentDate, locale, widgetKind, title, bodyMd, japaneseText, readingText, explanationText, imageUrl, sourceProvider, sourceRef." },
      { title: "Quản lý vòng đời", description: "Mỗi item có nút: Edit, Schedule (lên lịch), Publish (xuất bản), Archive (lưu trữ)." },
    ],
    tips: [
      "Schedule/Publish/Archive mở modal xác nhận riêng.",
      "Widget types: 🌤 weather, 💼 business, 🏠 housing, v.v. — mỗi type có layout khác nhau trên app.",
      "Nên lên lịch trước ít nhất 1 tuần để đảm bảo không trống ngày.",
    ],
    relatedLinks: [
      { label: "Daily Radar", href: "/daily-radar" },
    ],
  },

  "/daily-radar": {
    title: "Daily Radar",
    description:
      "Quản lý modules và cards cho tính năng Daily Radar. KPI: Total Modules, Enabled, Published Cards, Draft Cards, Spotlight. Có 2 mode: Module editor và Card editor.",
    steps: [
      { title: "Xem KPI", description: "5 cards: Total Modules, Enabled Modules, Published Cards, Draft Cards, Spotlight Title." },
      { title: "Chuyển mode", description: "Toggle giữa Module view và Card view." },
      { title: "Quản lý Modules", description: "Bảng: TitleVi, TitleJa, Category, Status, Default Priority, Updated At. Sửa inline." },
      { title: "Quản lý Cards", description: "Bảng cards thuộc module. Bấm Publish/Archive để chuyển trạng thái." },
      { title: "Toggle states", description: "Các toggle: isEnabled, isPinned, isSpotlight cho module/card." },
    ],
    tips: [
      "Module editor cho phép chỉnh metadata JSON trực tiếp.",
      "Spotlight card sẽ hiển thị nổi bật trên app của learner.",
    ],
  },

  "/magazine": {
    title: "Magazine (AI Daily Content)",
    description:
      "Quản lý nội dung daily magazine tự động sinh bởi AI. 5 loại widget: vocab, weather, horoscope, loto, bjt_phrase. Hỗ trợ sinh thủ công và xem trạng thái.",
    steps: [
      { title: "Xem danh sách bài viết", description: "Bảng: Title (JP/VI), Kind (widget type), Date, Status (published/draft), JLPT Level, Actions." },
      { title: "Sinh nội dung mới", description: "Bấm 'Sinh nội dung' → chọn Kind (vocab/weather/horoscope/loto/bjt_phrase), Date, Locale → Submit. AI sẽ sinh nội dung tự động." },
      { title: "Sinh lại (Regenerate)", description: "Nếu chất lượng chưa tốt, bấm 'Sinh lại' trên bài cụ thể → nội dung cũ bị overwrite bằng phiên bản mới." },
      { title: "Xóa bài", description: "Bấm 'Xóa' → xác nhận → bài bị xóa vĩnh viễn." },
    ],
    tips: [
      "⏰ Nội dung được tự động sinh mỗi ngày lúc 5:30 sáng (vocab, weather, horoscope, bjt_phrase) và Thứ 2 + Thứ 5 lúc 17:00 (loto).",
      "✋ Admin có thể sinh thủ công bất kỳ ngày/loại nào, hoặc sinh lại nếu chất lượng chưa tốt.",
      "🔑 Cần OPENAI_API_KEY trong env để dùng AI thật. Không có key → dùng mock data.",
      "🌐 Weather lấy từ JMA (気象庁). Loto dùng statistical mock (Phase 2: API thật).",
      "🔄 Sinh nội dung là idempotent — cùng ngày/loại sẽ không tạo trùng. Dùng 'Sinh lại' để overwrite.",
      "Mỗi widget type có layout hiển thị khác nhau trên app learner.",
    ],
    relatedLinks: [
      { label: "Daily Hub", href: "/daily-hub" },
      { label: "Daily Radar", href: "/daily-radar" },
    ],
  },

  "/decks": {
    title: "Flashcard Decks",
    description:
      "Quản lý bộ thẻ flashcard. Bảng: Title (VI/JA), Visibility (public/private/curated), Status (active/draft/archived), Cards count, Updated At.",
    steps: [
      { title: "Tìm deck", description: "Search theo title (debounced). Filter theo Status và Visibility." },
      { title: "Xem chi tiết", description: "Click row → drawer bên phải hiển thị header, card count, descriptions." },
      { title: "Chuyển trạng thái", description: "Nút: Approve → Active, Reject → Archived, Draft. Mỗi thao tác cần nhập reason." },
      { title: "Export", description: "Bấm Export CSV để download danh sách decks." },
    ],
    tips: [
      "Deck visibility: public (all users), private (creator only), curated (editorial picks).",
      "Approve/Reject flow: user-created decks submit → admin review → approve/reject.",
      "Phân trang: manual prev/next buttons.",
    ],
    relatedLinks: [
      { label: "Flashcard Templates", href: "/flashcards/templates" },
      { label: "Generated Cards", href: "/flashcards/generated" },
      { label: "Card Generator", href: "/cardgen" },
    ],
  },

  "/flashcards/templates": {
    title: "Flashcard Templates",
    description:
      "Quản lý template dùng để định nghĩa layout flashcard. Bảng hiển thị template list với variant count.",
    steps: [
      { title: "Xem templates", description: "Danh sách templates: tên, mô tả, số variants." },
      { title: "Tạo template", description: "Bấm Create → định nghĩa cấu trúc card (front/back fields, layout)." },
      { title: "Preview", description: "Bấm Preview để xem rendering thực tế." },
      { title: "Edit/Delete", description: "Click row → sửa hoặc xóa template." },
    ],
    tips: [
      "Cần quyền admin.content.read hoặc tương đương.",
      "Template tốt nên hỗ trợ cả text + audio fields.",
    ],
  },

  "/flashcards/generated": {
    title: "Generated Flashcards",
    description:
      "Xem danh sách flashcard decks được auto-generate từ Card Generator. Hỗ trợ Regenerate/Delete/Archive và xem nội dung.",
    steps: [
      { title: "Xem danh sách", description: "Bảng các decks đã generate: tên, status, card count." },
      { title: "Xem nội dung", description: "Click để mở và xem cards bên trong." },
      { title: "Regenerate", description: "Tạo lại deck với rules mới nhất." },
      { title: "Archive/Delete", description: "Lưu trữ hoặc xóa deck không cần thiết." },
    ],
    tips: [
      "Generated decks link đến Card Generator rules — thay đổi rule sẽ ảnh hưởng lần generate tiếp.",
    ],
  },

  "/reading-assist": {
    title: "Reading Assist Reports",
    description:
      "Xem báo cáo sử dụng tính năng Reading Assist (furigana, hover meanings). Bảng read-only hiển thị 50 reports gần nhất.",
    steps: [
      { title: "Xem reports", description: "Bảng: Kind, TextHash, User (tên + 8 ký tự UUID), Context, Time." },
    ],
    tips: [
      "Trang chỉ đọc — không có nút tạo/sửa/xóa.",
      "Dùng để theo dõi learner sử dụng reading assist ở đâu và content nào.",
      "Không có filter hay pagination — hiển thị 50 entries mới nhất.",
    ],
  },

  "/learning/paths": {
    title: "Learning Paths",
    description:
      "Thiết kế lộ trình học. Bảng: Slug, Title (VI/JA), Target Level, Display Order, Status (draft/published/archived), timestamps.",
    steps: [
      { title: "Tìm path", description: "Search theo slug hoặc title. Filter: Status, Target Level (N5–N1)." },
      { title: "Tạo path mới", description: "Bấm Create → drawer: nhập Slug (required), Title VI (required), Title JA, Description VI/JA, Target Level, Display Order." },
      { title: "Publish", description: "Path mới tạo ở trạng thái Draft. Bấm Publish (cần reason) để learner thấy." },
      { title: "Archive/Delete", description: "Archive để ẩn, Delete để xóa. Cả hai cần reason." },
      { title: "Duplicate", description: "Nhân bản path hiện có làm base cho path mới." },
    ],
    tips: [
      "Slug là unique identifier — không thể sửa sau khi tạo.",
      "Mọi thao tác (create/edit/publish/archive/delete/duplicate) đều cần reason cho audit.",
      "Target Level giúp matching path với learner level phù hợp.",
    ],
  },

  "/learning/competencies": {
    title: "Năng lực (Competencies)",
    description:
      "Quản lý framework năng lực. Bảng: Code, Title (VI/JA), Level (beginner/intermediate/advanced/mastery), Status, timestamps.",
    steps: [
      { title: "Tìm competency", description: "Search theo code hoặc title. Filter: Status, Level." },
      { title: "Tạo mới", description: "Bấm Create → drawer: Code (required), Title VI (required), Title JA, Description VI, Level." },
      { title: "Publish/Archive/Delete", description: "Chuyển trạng thái — mỗi thao tác cần reason." },
    ],
    tips: [
      "Code là unique identifier — format nên nhất quán (vd: bjt.listening.main_idea).",
      "Level: beginner → intermediate → advanced → mastery.",
      "Competencies link tới questions để hệ thống adaptive learning đánh giá skill learner.",
    ],
  },

  "/learning/review": {
    title: "Spaced Repetition Review",
    description:
      "Dashboard giám sát SRS (spaced repetition). KPI: Total Cards, Due Now, Leeched, Reviews, Retention %, Avg Ease Factor, Avg Lapses, Avg Interval. Có chart Retention Curve và bảng Problem Cards.",
    steps: [
      { title: "Xem KPI", description: "8 metrics tổng quan: cards, reviews, retention, ease factor, lapses, interval." },
      { title: "Xem Retention Curve", description: "Bar chart 30/60/90 ngày: mỗi cột = 1 ngày, cao = review count, màu = retention % (xanh ≥80%, vàng 60-79%, đỏ <60%)." },
      { title: "Tìm Problem Cards", description: "Bảng: Card Title, User (masked), State, Interval, Ease, Lapses, Retention, Due At." },
      { title: "Filter problems", description: "Window days (7/14/30/60/90), search, Min Lapses, Max Retention %, Leeched only checkbox." },
      { title: "Force Reintroduce", description: "Click card → drawer detail → bấm 'Force Reintroduce' (cần reason) để reset SRS schedule." },
    ],
    tips: [
      "Leeched cards = cards mà learner quên liên tục (lapses > threshold). Cần attention.",
      "Force Reintroduce: reset card về trạng thái mới, learner sẽ ôn lại từ đầu.",
      "Retention dưới 70% ở bảng KPI là dấu hiệu content hoặc scheduling cần điều chỉnh.",
      "Export CSV để phân tích problem patterns offline.",
    ],
  },

  "/exercises": {
    title: "Cấu hình Bài tập",
    description:
      "Quản lý cấu hình exercise (KHÔNG phải từng bài tập riêng lẻ). Bảng: Exercise Type, Placement, Sort Order, Level, Enabled badge.",
    steps: [
      { title: "Xem cấu hình", description: "Bảng liệt kê các exercise config: loại bài tập nào được bật ở đâu." },
      { title: "Tạo config", description: "Bấm Create → modal: Exercise Type (meaning_match/cloze/word_order/translation/listening), Placement (practice_tab/post_review/daily_hub), Sort Order, Level (N5–N1 hoặc none), Enabled." },
      { title: "Edit/Delete", description: "Click để sửa config hoặc Delete (confirm dialog)." },
    ],
    tips: [
      "Đây là CONFIG bài tập, không phải quản lý từng câu hỏi riêng.",
      "Exercise Type: meaning_match, cloze, word_order, translation, listening.",
      "Placement quyết định nơi hiển thị: practice_tab (tab luyện tập), post_review (sau ôn bài), daily_hub (trang daily).",
      "Level = null nghĩa là áp dụng cho mọi level.",
    ],
  },

  "/gamification": {
    title: "Gamification",
    description:
      "Quản lý hệ thống game hóa. 4 tabs: Streaks | Achievements | Leaderboards | Pets.",
    steps: [
      { title: "Tab Streaks", description: "Bảng: Name, ActivityType, MinActions, FreezesAllowed, Enabled. Tạo/Sửa/Xóa streak rules." },
      { title: "Tab Achievements", description: "Bảng read-only: Slug, NameKey, Category, IconUrl, Tiers (expandable). Chỉ xem, không sửa." },
      { title: "Tab Leaderboards", description: "Bảng: Name, MetricType, Period, MaxEntries, Enabled. Tạo/Sửa/Xóa leaderboard configs." },
      { title: "Tab Pets", description: "Stats cards + bảng pets: ID, UserID, Name, Stage (emoji), XP, Happiness, Mood (emoji), TotalFeedings. Nút Reset (cần reason)." },
    ],
    tips: [
      "Streaks: MinActions = số hành động tối thiểu/ngày để giữ streak. FreezesAllowed = số ngày nghỉ cho phép.",
      "Achievements: chỉ đọc ở đây. Tạo/edit achievements qua backend hoặc seed.",
      "Pets: Reset pet = đưa về trạng thái ban đầu (XP=0, Happiness=0). Cần reason cho audit.",
      "Leaderboards: Period (daily/weekly/monthly/all_time) quyết định khi nào reset.",
    ],
  },

  "/cardgen": {
    title: "Card Generator",
    description:
      "Cấu hình rules generate flashcards tự động. 2 tabs: Rules (cấu hình) | Jobs (lịch sử chạy).",
    steps: [
      { title: "Tab Rules", description: "Bảng: Mode (by_level/by_topic/by_weak_area/daily_auto), Source (lexeme/grammar/kanji), Level, Direction (jp_to_vn/vn_to_jp/both), MaxCards, Enabled." },
      { title: "Tạo rule", description: "Bấm Create → chọn Mode, Source, Level, Direction, MaxCards, toggle Enabled." },
      { title: "Edit/Delete rule", description: "Click row để sửa hoặc xóa." },
      { title: "Tab Jobs", description: "Bảng read-only: Status (badge), CardsGenerated, TriggeredBy, CreatedAt." },
    ],
    tips: [
      "Mode: by_level (theo JLPT), by_topic (theo chủ đề), by_weak_area (theo điểm yếu learner), daily_auto (tự động hàng ngày).",
      "Direction: jp_to_vn (nhìn JP đoán VN), vn_to_jp (ngược lại), both (cả hai).",
      "Jobs tab cho biết mỗi lần generate tạo bao nhiêu cards và ai trigger.",
      "Rule Enabled = false sẽ không được chạy trong auto-generation.",
    ],
  },

  /* ───── Assessment ───── */
  "/bjt": {
    title: "BJT Dashboard",
    description:
      "Dashboard read-only hiển thị KPI và phân tích BJT. 6 KPI cards + nhiều charts và bảng.",
    steps: [
      { title: "Xem 6 KPI cards", description: "Total Learners, Published Exams, Sessions, Completed, Pass Rate %, Avg Score %." },
      { title: "Learner Distribution", description: "Bar chart phân bố learners theo level." },
      { title: "Pass Rate Trend", description: "Line chart pass rate theo tuần." },
      { title: "Pass Rate by Level", description: "Bảng chi tiết pass rate từng level." },
      { title: "Top Topics", description: "Bảng: skill tag, attempts, correct answers, accuracy %." },
      { title: "Drop-off Sections", description: "Bảng: section code, số câu trả lời, accuracy — cho biết learner bỏ cuộc ở đâu." },
      { title: "Upcoming Mock Exams", description: "Danh sách mock exams sắp diễn ra." },
    ],
    tips: [
      "Trang chỉ đọc. Dữ liệu từ API `/api/admin/bjt/summary` (single call).",
      "Freshness indicator: 'Last Session: [date]' và 'Last Question: [date]' cho biết dữ liệu cập nhật đến khi nào.",
      "Drop-off sections cho biết phần nào quá khó — cần thêm content hoặc remediation.",
    ],
    relatedLinks: [
      { label: "Question Bank", href: "/assessment/question-bank" },
      { label: "Mock Exams", href: "/assessment/mock-exams" },
      { label: "Quiz Templates", href: "/assessment/quiz-templates" },
      { label: "BJT Analytics", href: "/analytics/bjt" },
    ],
  },

  "/assessment/quiz-templates": {
    title: "Quiz Templates",
    description:
      "Tạo và quản lý template cho các loại quiz. CRUD interface với Create/Edit/Publish.",
    steps: [
      { title: "Xem templates", description: "Bảng: tên, loại quiz, số câu hỏi, thời gian, status." },
      { title: "Tạo template", description: "Bấm Create → set: loại quiz, thời gian, số câu, rules chọn câu hỏi từ pool." },
      { title: "Edit/Publish", description: "Sửa template → bấm Publish để active." },
    ],
    tips: [
      "Template define cách quiz được assemble — questions lấy từ Question Bank.",
      "Practice quiz: ngắn, không giới hạn thời gian. Mock exam: full-length, timed.",
    ],
  },

  "/assessment/question-bank": {
    title: "Ngân hàng Câu hỏi",
    description:
      "Kho câu hỏi cho quiz/exam. CRUD + bulk import + tagging. Create/Edit questions với stem, choices, answer, explanation.",
    steps: [
      { title: "Tìm câu hỏi", description: "Filter: section, level, topic, status." },
      { title: "Tạo câu hỏi", description: "Bấm Create → nhập stem, choices, correct answer, explanation." },
      { title: "Bulk import", description: "Upload CSV/JSON để import nhiều câu cùng lúc." },
      { title: "Tag", description: "Gắn competency tags cho mỗi câu hỏi." },
    ],
    tips: [
      "Mỗi câu PHẢI có explanation — đây là yếu tố quan trọng nhất cho learning.",
      "Tag competency giúp hệ thống adaptive learning hoạt động chính xác.",
    ],
  },

  "/assessment/quiz-sessions": {
    title: "Quiz Sessions",
    description:
      "Xem lịch sử phiên quiz của learner. View sessions, review answers, cancel sessions.",
    steps: [
      { title: "Tìm session", description: "Filter theo user, quiz type, date range, score range." },
      { title: "Xem chi tiết", description: "Click → xem từng câu trả lời, đúng/sai, thời gian mỗi câu." },
      { title: "Cancel session", description: "Hủy session đang dở (nếu learner report lỗi)." },
    ],
    tips: [
      "Sessions data dùng để phân tích question difficulty và discrimination.",
    ],
  },

  "/assessment/mock-exams": {
    title: "Mock Exams",
    description:
      "Quản lý đề thi thử BJT. Create/Edit exams, schedule, view results.",
    steps: [
      { title: "Xem đề thi", description: "Danh sách: tên, trạng thái, số lượt thi." },
      { title: "Tạo đề mới", description: "Bấm Create → chọn template → chọn questions hoặc auto-generate từ pool." },
      { title: "Schedule", description: "Set thời gian mở/đóng cho mock exam." },
      { title: "Xem kết quả", description: "Xem aggregated results: pass rate, avg score, score distribution." },
    ],
    tips: [
      "Nên có ít nhất 5 mock exams khác nhau để learner rotation.",
      "BJT thật: 100 câu/120 phút. Mock nên giữ đúng tỉ lệ.",
    ],
  },

  "/assessment/remediation": {
    title: "Remediation Plans",
    description:
      "Quản lý kế hoạch bổ trợ tự động: khi learner yếu ở competency X → gợi ý content Y.",
    steps: [
      { title: "Xem rules", description: "Bảng: competency source → content target → conditions." },
      { title: "Tạo rule", description: "Bấm Create → chọn competency yếu → chọn content bổ trợ." },
      { title: "Edit/Link", description: "Liên kết remediation plan với questions cụ thể." },
    ],
    tips: [
      "Remediation tự động kích hoạt sau mỗi quiz/mock exam dựa trên results.",
      "Nên cover tất cả BJT competencies.",
    ],
  },

  /* ───── Battle ───── */
  "/battle/configs": {
    title: "Battle Configs",
    description:
      "Cấu hình game rules cho Battle mode: scoring curves, reward configs, thông số game.",
    steps: [
      { title: "Xem configs", description: "Bảng cấu hình: parameter name, value, description." },
      { title: "Edit rules", description: "Click để sửa: scoring formula, time limits, reward tables." },
      { title: "Set curves", description: "Cấu hình ELO curves và matchmaking parameters." },
      { title: "Configure rewards", description: "Set XP/badge rewards cho winners." },
    ],
    tips: [
      "Cần quyền admin.content.read và feature flag adminNav.battle enabled.",
      "Thay đổi config ảnh hưởng ngay lập tức cho matches mới.",
    ],
  },

  "/battle/bots": {
    title: "Battle Bots",
    description:
      "Quản lý AI bots đối đầu khi không đủ players. Create/Edit bots với difficulty settings.",
    steps: [
      { title: "Xem bots", description: "Bảng: tên, level, strategy type, enabled status." },
      { title: "Tạo bot", description: "Bấm Create → set: name, difficulty level, response time, accuracy rate." },
      { title: "Enable/Disable", description: "Toggle bot on/off." },
      { title: "Tune difficulty", description: "Adjust accuracy và response speed cho mỗi level tier." },
    ],
    tips: [
      "Bot accuracy nên 60-90% tùy level — quá dễ/khó đều giảm engagement.",
      "Feature flag adminNav.battle phải enabled để thấy trang này.",
    ],
  },

  "/battle/matches": {
    title: "Battle Matches",
    description:
      "Xem lịch sử trận đấu. View details, replay analysis, filter theo date/player/mode/result.",
    steps: [
      { title: "Tìm match", description: "Filter: date range, player ID, mode, result (win/lose/draw)." },
      { title: "Xem chi tiết", description: "Click → xem từng câu, ai trả lời trước, điểm từng câu." },
      { title: "Replay analysis", description: "Phân tích flow trận đấu theo timeline." },
    ],
    tips: [
      "Dùng data này để balance bot difficulty và matchmaking.",
      "Matches với duration quá ngắn (< 10s) có thể là suspicious → xem Battle Abuse.",
    ],
  },

  "/battle/leaderboard": {
    title: "Battle Leaderboard",
    description:
      "Quản lý bảng xếp hạng: seasons, rules, freeze/unfreeze leaderboard.",
    steps: [
      { title: "Xem leaderboard", description: "Top players theo ELO rating trong season hiện tại." },
      { title: "Create season", description: "Tạo season mới với duration, rules, rewards." },
      { title: "Edit rules", description: "Sửa scoring rules, decay settings." },
      { title: "Freeze/Unfreeze", description: "Đóng băng leaderboard (maintenance) hoặc mở lại." },
    ],
    tips: [
      "Season nên 1 tháng. Rewards cho top 10% motivate participation.",
      "Freeze khi có incident (abuse, bug) — không ảnh hưởng match history.",
    ],
  },

  "/battle/abuse": {
    title: "Battle Abuse Detection",
    description:
      "Review reports gian lận: investigate evidence, issue sanctions (warn/suspend/ban).",
    steps: [
      { title: "Xem flagged cases", description: "Danh sách matches/players bị AI flag là suspicious." },
      { title: "Review evidence", description: "Click → xem: response time anomalies, win-trading patterns." },
      { title: "Issue sanction", description: "Quyết định: Warn, Suspend (tạm), Ban (vĩnh viễn)." },
    ],
    tips: [
      "Response time < 1s cho câu hỏi phức tạp là suspicious.",
      "Win-trading: 2 players luân phiên thắng/thua — check match history cả 2.",
      "Cần quyền iam.manage hoặc support.user.read.",
    ],
  },

  /* ───── Users ───── */
  "/users": {
    title: "Quản lý Người dùng",
    description:
      "Console quản lý users. 5 KPI cards + bảng dữ liệu lớn + nhiều actions. Hỗ trợ bulk operations.",
    steps: [
      { title: "Xem KPI", description: "5 cards: Total Users, Active Learners, Paid Users, Suspended/Disabled, Onboarding Incomplete." },
      { title: "Filter users", description: "Search (name/email), Status (active/pending/disabled/suspended/deleted), Locale, Plan, Last Active date range." },
      { title: "Xem bảng", description: "Columns: ID, Name, Email, Status (badge), AccountType, Plan (badge), Locale, Quota (used/limit), DueFlashcards, LastActivity." },
      { title: "Actions (per row)", description: "View 360 (link), Change Status (modal + reason), Change Plan (modal + reason), Add Note (modal)." },
      { title: "Bulk operations", description: "Tick checkbox nhiều rows → Bulk Status Change (modal + reason)." },
      { title: "Create/Invite", description: "Nút '+ Create User' để invite user mới (nếu có quyền)." },
      { title: "Export CSV", description: "Download toàn bộ user data (name, email, status, plan, locale, created...)." },
    ],
    tips: [
      "Pagination 20/trang (configurable). Rất nhiều users — luôn dùng filter.",
      "Change Status options: active, pending, disabled, suspended.",
      "Change Plan cần quyền monetization write riêng.",
      "Không xóa user trực tiếp — dùng Privacy Data Requests workflow.",
    ],
    relatedLinks: [
      { label: "User 360", href: "/users/360" },
      { label: "Support Notes", href: "/support/notes" },
      { label: "Privacy Requests", href: "/privacy/data-requests" },
    ],
  },

  "/users/360": {
    title: "User 360° View",
    description:
      "Cái nhìn toàn diện 1 learner. CẦN nhập User ID và lý do truy cập (bắt buộc). Access grant có hiệu lực 30 phút. 6 tabs thông tin.",
    steps: [
      { title: "Nhập User ID", description: "Gõ hoặc paste User ID (UUID) vào ô search." },
      { title: "Cung cấp Access Reason", description: "Chọn category (compliance/support/abuse/billing/other) + nhập reason (≥8 ký tự). BẮT BUỘC." },
      { title: "Tab Overview", description: "Profile: Name, Email, Status, Privacy Level, Timezone, Locale, Keycloak Subject, timestamps, Provider Accounts." },
      { title: "Tab Learning", description: "BJT band estimate, due flashcards, review events 7d, onboarding status." },
      { title: "Tab Plan", description: "Plan hiện tại, entitlements, quotas (key, limit, used, window), subscription status." },
      { title: "Tab Sessions", description: "Login events: type, provider, timestamp." },
      { title: "Tab Support", description: "Support notes read-only + nút Append note mới." },
      { title: "Tab Audit", description: "Full audit log (tối đa 80 entries) của user này." },
    ],
    tips: [
      "Access grant lưu trong sessionStorage — hết hạn sau 30 phút hoặc đóng tab.",
      "Mỗi lần access đều được ghi audit (ai xem, lý do gì, khi nào).",
      "Dùng 360 view khi xử lý support ticket — có đầy đủ context.",
      "Quotas table hiển thị: key, limit (hoặc ∞ nếu unlimited), used, window.",
    ],
  },

  "/support/notes": {
    title: "Support Notes",
    description:
      "Ghi chú nội bộ về users. Bảng: Time, User ID (masked), Actor, Visibility (private/team/audit_only), Reason. Link mở User 360.",
    steps: [
      { title: "Filter notes", description: "User ID, Created By, Visibility (private/team/audit_only), Date From/To, Full-text search." },
      { title: "Xem chi tiết", description: "Click row → drawer: visibility badge, timestamp, actor, body text, reason." },
      { title: "Tạo note mới", description: "Bấm Create → modal: Target User ID (required), Body (required), Visibility (team/private/audit_only), Reason (≥3 chars)." },
      { title: "Export CSV", description: "Download notes cho audit offline." },
    ],
    tips: [
      "Privacy banner nhắc nhở về dữ liệu nhạy cảm.",
      "Visibility: team (team thấy), private (chỉ mình), audit_only (chỉ auditors thấy).",
      "User ID hiển thị masked (8 ký tự đầu + …) — click 'Open in User 360' để xem full.",
      "Nếu có quyền iam.manage: sẽ thấy cảnh báo đỏ audit scope.",
    ],
  },

  "/privacy/data-requests": {
    title: "Privacy Data Requests",
    description:
      "Xử lý yêu cầu GDPR/privacy: data export và data deletion. Status counters + bảng requests + detail drawer với workflow actions.",
    steps: [
      { title: "Xem status counters", description: "Badges trên header: Pending (vàng), Processing (xám), Completed (xanh), Failed (đỏ)." },
      { title: "Filter", description: "Kind (export/delete), Status (pending/processing/completed/failed)." },
      { title: "Xem chi tiết", description: "Click row → drawer: kind, status, user ID, timestamps, error (nếu failed), result payload, audit log." },
      { title: "Workflow actions", description: "Acknowledge (pending → processing), Fulfill (export: optional download URL + notes), Reject (nhập reason), Erasure Confirm (delete: phải nhập confirmation token = request ID + reason)." },
    ],
    tips: [
      "GDPR: xử lý trong 30 ngày. Theo dõi deadline chặt chẽ.",
      "Erasure Confirm CỰC KỲ nguy hiểm — KHÔNG THỂ UNDO. Confirmation token bắt buộc = request ID.",
      "Export CSV để tracking offline.",
      "Mọi action đều ghi audit với actor, reason, timestamp.",
    ],
  },

  /* ───── Analytics ───── */
  "/analytics": {
    title: "Analytics Hub",
    description:
      "Điểm khởi đầu cho tất cả analytics. Tab navigation đến các trang con chi tiết.",
    steps: [
      { title: "Chọn domain", description: "Navigate tới analytics domain cần xem: Growth, Learning, Content, BJT, Flashcards, Battle." },
    ],
    relatedLinks: [
      { label: "User Growth", href: "/analytics/growth" },
      { label: "Learning", href: "/analytics/learning" },
      { label: "Content", href: "/analytics/content" },
      { label: "BJT", href: "/analytics/bjt" },
      { label: "Flashcards", href: "/analytics/flashcards" },
      { label: "Battle", href: "/analytics/battle" },
    ],
  },

  "/analytics/growth": {
    title: "Growth Analytics",
    description:
      "Phân tích tăng trưởng. Metrics: signups, activations, paid conversions, referrals, shares. Dimensions: by campaign, referral kind, share kind.",
    steps: [
      { title: "Chọn date range", description: "Picker ở góc phải để thay đổi khoảng thời gian." },
      { title: "Xem metrics cards", description: "KPI: signups, activations, paid_conversions, referrals, shares." },
      { title: "Drill down by dimension", description: "Xem breakdown: by_campaign, by_referral_kind, by_share_kind." },
    ],
    tips: [
      "Cần quyền analytics.read hoặc viewer.analytics.",
      "So sánh week-over-week để phát hiện anomalies.",
    ],
  },

  "/analytics/learning": {
    title: "Learning Analytics",
    description:
      "Phân tích học tập. Metrics: reviews, active studiers. Dimensions: top studiers, by card state, by rating.",
    steps: [
      { title: "Xem overview", description: "Total reviews, active studier count." },
      { title: "Top studiers", description: "Bảng top learners theo review count." },
      { title: "By card state", description: "Phân bố cards theo state: new/learning/review/relearning." },
      { title: "By rating", description: "Phân bố review ratings: again/hard/good/easy." },
    ],
    tips: [
      "Rating 'again' cao = content quá khó hoặc SRS interval quá dài.",
      "Active studiers / Total users = engagement rate.",
    ],
  },

  "/analytics/content": {
    title: "Content Analytics",
    description:
      "Phân tích content. Metrics: card links created, lexeme added. Dimensions: top engaged content, by type, by lexeme status.",
    steps: [
      { title: "Xem metrics", description: "Số card links mới tạo, lexemes mới thêm." },
      { title: "Top engaged", description: "Content nào được learners interact nhiều nhất." },
      { title: "By type", description: "Phân bố content theo type: lexeme, kanji, grammar." },
      { title: "By lexeme status", description: "Draft vs Published vs Archived." },
    ],
    tips: [
      "Content chưa ai interact = cần review quality hoặc discoverability.",
    ],
  },

  "/analytics/bjt": {
    title: "BJT Analytics",
    description:
      "Phân tích BJT. Metrics: attempts, completions, avg score, pass rate, avg time. Dimensions: by test, by section, by band.",
    steps: [
      { title: "Xem overall metrics", description: "Attempts, completions, pass rate %, avg score, avg time." },
      { title: "By test", description: "So sánh performance giữa các đề thi khác nhau." },
      { title: "By section", description: "Phân tích listening vs reading vs grammar." },
      { title: "By band", description: "Phân bố learners theo BJT band (J5→J1+)." },
    ],
    tips: [
      "Avg time quá ngắn = đề quá dễ hoặc learner skip. Quá dài = đề quá khó.",
      "Pass rate by section cho biết phần nào cần thêm content/practice.",
    ],
  },

  "/analytics/flashcards": {
    title: "Flashcard Analytics",
    description:
      "Phân tích flashcards. Metrics: reviews, retention, mastered, lapses. Dimensions: by deck, by rating.",
    steps: [
      { title: "Xem metrics", description: "Total reviews, overall retention %, mastered cards, lapses." },
      { title: "By deck", description: "Performance từng deck: retention, completion rate." },
      { title: "By rating", description: "Phân bố ratings: again/hard/good/easy." },
    ],
    tips: [
      "Retention > 85% = SRS intervals tốt. < 70% = cần adjust.",
      "Deck với retention thấp = content cần review quality.",
    ],
  },

  "/analytics/battle": {
    title: "Battle Analytics",
    description:
      "Phân tích Battle. Metrics: matches, active players, abuse reports, avg duration. Dimensions: by mode, by status, by user.",
    steps: [
      { title: "Xem metrics", description: "Matches played, active players, abuse reports, avg match duration." },
      { title: "By mode", description: "So sánh mode nào popular nhất." },
      { title: "By status", description: "Completed vs abandoned vs cancelled." },
      { title: "By user", description: "Top players theo matches played." },
    ],
    tips: [
      "Abandoned rate cao = UX problem hoặc matchmaking quá chậm.",
      "Abuse reports tăng = cần review detection rules.",
    ],
  },

  /* ───── Monetization ───── */
  "/monetization": {
    title: "Monetization Overview",
    description:
      "Dashboard doanh thu tổng hợp. Kiến trúc 3 lớp bảo vệ server-side: Entitlement Guard (chặn feature premium), Quota Service (giới hạn sử dụng), Feature Flag (bật/tắt toàn hệ thống).",
    steps: [
      { title: "Xem KPIs", description: "Revenue metrics: MRR, subscribers, conversion rate, ARPU, funnel biểu đồ phân bổ plan." },
      { title: "Navigate tabs", description: "Sidebar/tab nav: Plans, Entitlements, Quotas, Subscriptions, Billing Events, Refunds, Provider Config, Webhook DLQ." },
      { title: "Kiểm tra enforcement", description: "Feature flag 'monetization.enforcement' quyết định có bật thu phí hay không. Tắt = mọi user dùng free mode." },
    ],
    tips: [
      "Quyền cần có: admin.monetization.read (xem) + admin.monetization.write (sửa).",
      "3 lớp bảo vệ: Entitlement Guard → 403 ENTITLEMENT_DENIED, Quota Service → 403 QUOTA_EXCEEDED, Feature Flag → 503 feature_disabled.",
      "Tất cả enforce server-side, không bypass được từ frontend.",
      "Nguyên tắc Free tier: Browse/Daily/Gamification cơ bản = full. Practice = có quota. AI-powered/Mock exam = premium only.",
    ],
    relatedLinks: [
      { label: "Plans", href: "/monetization/plans" },
      { label: "Subscriptions", href: "/monetization/subscriptions" },
      { label: "Quotas", href: "/monetization/quotas" },
      { label: "Billing Events", href: "/monetization/billing-events" },
      { label: "Feature Flags", href: "/ops/feature-flags" },
      { label: "Ads", href: "/ads" },
    ],
  },

  "/monetization/plans": {
    title: "Subscription Plans",
    description:
      "CRUD quản lý gói cước. Mỗi plan define pricing, trial, features highlight. 3 gói đề xuất: Free, Pro, Premium.",
    steps: [
      { title: "Xem danh sách plans", description: "Bảng: tên, slug, giá (monthly/yearly), billing period, active subscribers, status (draft/active)." },
      { title: "Tạo plan mới", description: "Bấm 'Tạo Plan' → nhập slug (VD: pro), nameKey (i18n), status = draft trước. Điền Reason (bắt buộc ≥3 ký tự)." },
      { title: "Gắn Entitlements & Quotas", description: "Sau khi tạo plan → vào tab Entitlements/Quotas để link features và limits cho plan." },
      { title: "Activate/Deactivate", description: "Chuyển status active khi sẵn sàng. Deactivated plans không nhận subscriber mới." },
      { title: "Edit/Delete", description: "Sửa thông tin hoặc xóa plan (chỉ khi không có active subscribers)." },
    ],
    tips: [
      "Cần quyền admin.monetization.write.",
      "Template 3 gói: Free (0đ), Pro (99k-149k/tháng, trial 7 ngày), Premium (199k-299k/tháng, trial 14 ngày).",
      "Config JSON plan cần: pricing (monthly/yearly/currency), billing_interval, trial_days, features_highlight.",
      "Thay đổi giá chỉ áp dụng cho NEW subscribers. Existing giữ giá cũ đến khi renewal.",
      "Không nên có quá 3–4 plans. Tạo draft → test → rồi mới active.",
      "Checklist trước khi active: đã link entitlements, đã set quotas, đã test trên staging.",
    ],
    relatedLinks: [
      { label: "Entitlements", href: "/monetization/entitlements" },
      { label: "Quotas", href: "/monetization/quotas" },
    ],
  },

  "/monetization/entitlements": {
    title: "Entitlements (Quyền truy cập Feature)",
    description:
      "Quản lý quyền truy cập feature theo plan. Ma trận Feature × Plan cho biết plan nào có feature nào. Guard tự động chặn ở server.",
    steps: [
      { title: "Xem ma trận", description: "Feature × Plan matrix hiển thị plan nào có feature nào. Ví dụ: quiz.official_simulation chỉ có ở Premium." },
      { title: "Tạo Entitlement Definition", description: "Key format: {module}.{feature} (VD: analytics.detailed_report). Category: flashcard/bjt/reading_assist/analytics/media/ai/battle/ads/admin." },
      { title: "Link vào Plan", description: "Chọn entitlement → 'Link Plan' → chọn plan → nhập Reason → Confirm." },
      { title: "Remove entitlement", description: "Gỡ entitlement khỏi plan. LƯU Ý: users hiện tại MẤT quyền ngay lập tức!" },
    ],
    tips: [
      "Cần quyền admin.monetization.write.",
      "Ví dụ phân bổ: learner.basic (Free ✅, Pro ✅, Premium ✅), ads.reduced (Pro ✅), ads.remove (Premium ✅), flashcard.suggest_cards (Pro ✅, Premium ✅), quiz.official_simulation (Premium ✅ only).",
      "Remove entitlement = users hiện tại mất quyền ngay. Cẩn thận! Nên thông báo user trước.",
      "Free plan nên có đủ features cơ bản (browse, daily, gamification) để tạo giá trị trước khi upgrade.",
      "Nếu tạo entitlement mới → cần dev thêm @RequiresEntitlement guard trong controller.",
    ],
    relatedLinks: [
      { label: "Plans", href: "/monetization/plans" },
      { label: "Quotas", href: "/monetization/quotas" },
    ],
  },

  "/monetization/quotas": {
    title: "Quotas (Giới hạn sử dụng)",
    description:
      "Quản lý giới hạn sử dụng theo plan. Tạo Policy → Link Plan với Limit → User vượt limit = API trả 403 QUOTA_EXCEEDED.",
    steps: [
      { title: "Xem quotas", description: "Bảng: quota key, window (day/week/month), limit per plan, current usage stats." },
      { title: "Tạo Quota Policy", description: "Key format: {module}_{action}_per_{window} (VD: flashcard_reviews_per_day). Chọn window: day/week/month. Set warnThresholdPercent (mặc định 80%)." },
      { title: "Link Plan với Limit", description: "Chọn Policy → Plan → nhập Limit. VD: flashcard_reviews_per_day: Free=30, Pro=300, Premium=999999 (unlimited)." },
      { title: "Override cho user cụ thể", description: "Tạo Override: User ID + Quota Key + Limit Value + Expires At (tùy chọn) + Reason. User đó dùng limit override thay vì plan." },
      { title: "Reset quota", description: "Reset quota đã dùng cho user cụ thể hoặc Bulk reset. Thường chạy tự động theo window." },
    ],
    tips: [
      "Cần quyền admin.monetization.write.",
      "Bảng quota đề xuất: flashcard_reviews_per_day (Free=30, Pro=300, Premium=∞), quiz.bjt.start/day (3/20/∞), flashcard_gen_per_day (3/30/100), battle_matches_per_day (5/20/∞).",
      "Quota reset tự động theo window (daily/monthly). Manual reset khi cần support user hoặc compensate.",
      "Nếu tạo quota mới → cần dev thêm QuotaService.consume() call trong service tương ứng.",
      "Override có thể set Expires At để tự động hết hạn — dùng khi tặng user VIP tạm thời.",
    ],
    relatedLinks: [
      { label: "Plans", href: "/monetization/plans" },
      { label: "Subscriptions", href: "/monetization/subscriptions" },
    ],
  },

  "/monetization/subscriptions": {
    title: "Subscriptions",
    description:
      "Xem và quản lý subscriptions user. Filter, xem chi tiết billing, Extend (gia hạn) hoặc Cancel.",
    steps: [
      { title: "Tìm subscription", description: "Filter: user, plan, status (active/cancelled/expired), date range." },
      { title: "Xem chi tiết", description: "Click → billing history, next renewal date, payment method, plan info." },
      { title: "Extend", description: "Gia hạn subscription — thường dùng khi support compensate user (lỗi hệ thống, downtime, v.v.)." },
      { title: "Cancel", description: "Hủy subscription — user vẫn dùng premium đến hết billing period hiện tại, sau đó về Free." },
    ],
    tips: [
      "Cần quyền admin.monetization.write.",
      "Cancel ≠ immediate stop. User vẫn dùng premium đến hết period đã trả. Chỉ không gia hạn tiếp.",
      "Extend nên ghi Reason rõ ràng (VD: 'compensate 2-day downtime on 2025-01-15').",
    ],
  },

  "/monetization/billing-events": {
    title: "Billing Events",
    description:
      "Lịch sử sự kiện billing: payments, renewals, failures. Chỉ đọc — dùng để investigate billing issues.",
    steps: [
      { title: "Filter events", description: "Theo event type (payment_success, payment_failed, renewal, refund), user, date range, status." },
      { title: "Xem chi tiết", description: "Click → full event payload JSON, timestamps, related subscription." },
      { title: "Export", description: "Download billing events CSV/JSON cho reporting hoặc đối soát." },
    ],
    tips: [
      "Cần quyền admin.monetization.read.",
      "Chỉ đọc — không có actions sửa/xóa. Dùng để investigate billing issues.",
      "Nếu thấy nhiều payment_failed liên tiếp → kiểm tra Provider Config và Webhook DLQ.",
    ],
  },

  "/monetization/refunds": {
    title: "Refunds (Hoàn tiền)",
    description:
      "Xử lý yêu cầu hoàn tiền. Review → Approve/Deny → Process payout qua payment provider.",
    steps: [
      { title: "Xem requests", description: "Danh sách refund requests: user, amount, reason, status (pending/approved/denied/processed)." },
      { title: "Review chi tiết", description: "Click → subscription info, payment history, user reason, account age." },
      { title: "Approve/Deny", description: "Approve (chấp nhận hoàn tiền) hoặc Deny (từ chối kèm reason cho user)." },
      { title: "Process payout", description: "Sau approve, bấm Process → hoàn tiền qua payment provider. User tự động downgrade về Free." },
    ],
    tips: [
      "Cần quyền admin.monetization.write.",
      "Approve refund = downgrade user về Free plan sau khi process. Không thể undo.",
      "Nên review payment history và account age trước khi approve — tránh abuse refund.",
    ],
  },

  "/monetization/provider-config": {
    title: "Payment Provider Config",
    description:
      "Cấu hình kết nối payment provider (Stripe, etc.). API keys, webhook URLs, test/live modes.",
    steps: [
      { title: "Xem config hiện tại", description: "Provider settings: API keys (masked), webhook URLs, mode (test/live), last verified." },
      { title: "Update settings", description: "Sửa configuration values. LƯU Ý: ảnh hưởng thanh toán đang xử lý nếu sửa sai." },
      { title: "Test API connection", description: "Bấm 'Test' → verify kết nối với provider hoạt động. Luôn test sau mỗi lần update." },
    ],
    tips: [
      "Cần quyền admin.monetization.write.",
      "CẨN THẬN khi thay đổi — có thể ảnh hưởng thanh toán đang xử lý. Nên test ở test mode trước.",
      "Luôn Test sau khi update config. Nếu test fail → rollback ngay.",
      "Kill switch: tắt 'billing.stripe.enabled' feature flag nếu cần emergency stop thanh toán.",
    ],
  },

  "/monetization/webhook-dlq": {
    title: "Webhook Dead Letter Queue",
    description:
      "Webhooks từ payment provider bị thất bại. Queue tích tụ = vấn đề hệ thống cần investigate root cause.",
    steps: [
      { title: "Xem queue", description: "Danh sách webhooks failed: event type, error message, retry count, first failed at." },
      { title: "View payload", description: "Click → full webhook JSON payload để debug." },
      { title: "Retry", description: "Bấm Retry → gửi lại webhook vào processing pipeline." },
      { title: "Discard", description: "Bỏ qua webhook không cần xử lý (VD: duplicate, outdated)." },
    ],
    tips: [
      "Cần quyền admin.monetization.write và iam.manage.",
      "Webhook DLQ tích tụ = vấn đề hệ thống. Investigate root cause (provider config? network? parsing error?) thay vì chỉ retry.",
      "Retry thường fix được transient errors (timeout, 5xx). Nếu retry vẫn fail → xem payload để debug.",
    ],
  },

  "/ads": {
    title: "Ads Console",
    description:
      "Console quảng cáo đầy đủ với 7 tabs: Overview | Placements | Campaigns | Providers | Rules | Performance | Audit.",
    steps: [
      { title: "Tab Overview", description: "8 KPI cards (ActiveCampaigns, Impressions7d, Clicks7d, CTR...) + Charts (trend, CTR by placement, RPM/CPM) + Task alerts." },
      { title: "Tab Placements", description: "CRUD bảng: Code, Type, Status, Location, Enabled. Tạo/sửa/xóa ad placements." },
      { title: "Tab Campaigns", description: "CRUD bảng: Name, Status, Budget, Start/End, Enabled. Quản lý ad campaigns." },
      { title: "Tab Providers", description: "Bảng providers: Key, Type, Enabled, Config (JSON). Edit/Delete." },
      { title: "Tab Rules", description: "Bảng: Condition (JSON), Action, Priority, Enabled. Cấu hình targeting rules." },
      { title: "Tab Performance", description: "Charts + analytics table (read-only)." },
      { title: "Tab Audit", description: "Lịch sử actions: timestamp, actor, action, resource, before/after JSON, reason." },
    ],
    tips: [
      "Permissions riêng cho từng tab: canPlacements, canCampaigns, canProviders, canRules, canAudit.",
      "KHÔNG hiển thị ads khi learner đang làm quiz/exam.",
      "Premium users KHÔNG thấy ads — đây là selling point chính.",
      "Privacy note hiển thị ở header nếu có.",
      "Task alerts (vàng) ở Overview tab cảnh báo: campaigns sắp hết, providers disabled, placements thiếu config.",
    ],
  },

  /* ───── Growth ───── */
  "/growth": {
    title: "Growth Overview",
    description:
      "Dashboard tăng trưởng: viral metrics, campaign performance overview.",
    steps: [
      { title: "Xem viral metrics", description: "K-factor, invite conversion rate, share rate." },
      { title: "Campaign performance", description: "So sánh hiệu quả các campaigns đang chạy." },
    ],
    relatedLinks: [
      { label: "Social", href: "/growth/social" },
      { label: "Referrals", href: "/growth/referrals" },
      { label: "Postcards", href: "/growth/postcards" },
      { label: "Campaigns", href: "/growth/campaigns" },
    ],
  },

  "/growth/social": {
    title: "Social Campaigns",
    description:
      "Quản lý social campaigns. Create campaigns, configure sharing templates, view analytics.",
    steps: [
      { title: "Xem campaigns", description: "Bảng social campaign configs với metrics." },
      { title: "Create campaign", description: "Tạo campaign mới: tên, platform, template, target audience." },
      { title: "Configure templates", description: "Set up share templates cho từng loại achievement/event." },
      { title: "View analytics", description: "Shares, clicks, conversions per campaign." },
    ],
    tips: [
      "Cần quyền admin.growth.read/write.",
    ],
  },

  "/growth/referrals": {
    title: "Referral Program",
    description:
      "Quản lý chương trình giới thiệu. Create program, set rewards, approve payouts. View referral data và reward status.",
    steps: [
      { title: "Xem data", description: "Bảng referral data: referrer, invitee, status, reward." },
      { title: "Create program", description: "Set rules: reward cho referrer, reward cho invitee, conditions." },
      { title: "Set rewards", description: "Config: premium days, XP bonus, badges." },
      { title: "Approve payouts", description: "Review pending rewards → approve distribution." },
    ],
    tips: [
      "Double-sided rewards (cả 2 bên được thưởng) có conversion tốt hơn 30-50%.",
    ],
  },

  "/growth/postcards": {
    title: "Share Postcards",
    description:
      "Quản lý postcard templates cho social sharing. Create/Edit/Preview/Enable/Disable templates.",
    steps: [
      { title: "Xem templates", description: "Bảng: template name, type (quiz result/streak/badge...), status, preview." },
      { title: "Create template", description: "Upload design, set dynamic fields (username, score, date...)." },
      { title: "Preview", description: "Generate sample postcard để kiểm tra rendering." },
      { title: "Enable/Disable", description: "Toggle template active status." },
    ],
    tips: [
      "Size tối ưu cho social: 1200×630px (OG image standard).",
      "Dynamic fields: {{username}}, {{score}}, {{date}}, {{badge_name}}, etc.",
    ],
  },

  "/growth/campaigns": {
    title: "Marketing Campaigns",
    description:
      "Quản lý campaigns: bảng với metrics (users, conversions, ROI). Create/Edit, set budget, view performance.",
    steps: [
      { title: "Xem campaigns", description: "Bảng: Name, Status, Budget, Users Reached, Conversions, ROI." },
      { title: "Create campaign", description: "Bấm Create → set: name, type, budget, schedule, target audience." },
      { title: "Set budget", description: "Budget tracking: spent vs allocated." },
      { title: "View metrics", description: "Click → detailed performance: reach, engagement, conversions." },
    ],
    tips: [
      "Cần quyền admin.growth.write.",
    ],
  },

  /* ───── Operations ───── */
  "/ops/feature-flags": {
    title: "Feature Flags",
    description:
      "Quản lý feature flags toàn hệ thống. Searchable list với inline edit, rollout %, kill switch indicator, history, CSV export.",
    steps: [
      { title: "Tìm flag", description: "Search text (key + description), filter Scope, filter Enabled (all/on/off)." },
      { title: "Xem bảng", description: "Columns: Key (monospace), Description, Enabled badge, KillSwitch indicator, Scope, Updated At." },
      { title: "Edit flag", description: "Click row → modal: enabled toggle, killSwitch toggle, rolloutPercent (số), rolloutSchedule (JSON), reason (≥3 chars)." },
      { title: "High-risk flags", description: "Flags bắt đầu bằng auth.*, billing.*, monetization.*, security.*, rate_limit.*, killswitch.* YÊU CẦU nhập confirmation key." },
      { title: "Xem history", description: "Bấm History → audit trail: ai đổi gì, khi nào, reason." },
      { title: "Export CSV", description: "Download toàn bộ flags." },
    ],
    tips: [
      "Rollout %: 0 = off, 100 = on cho tất cả. Giữa = gradual rollout (random % users).",
      "Kill switch = emergency off. Khác feature flag bình thường ở priority và visibility.",
      "Thay đổi flags auth/billing/security CỰC KỲ ảnh hưởng — confirmation key bắt buộc.",
      "Mọi thay đổi cần reason ≥3 ký tự cho audit.",
    ],
  },

  "/ops/kill-switches": {
    title: "Kill Switches",
    description:
      "View giống Feature Flags nhưng CHỈ hiển thị flags có killSwitch = true. Dùng cho emergency shutdown.",
    steps: [
      { title: "Xem kill switches", description: "Bảng filtered: chỉ flags là kill switch." },
      { title: "Toggle", description: "Bật kill switch = TẮT NGAY tính năng. Tắt kill switch = khôi phục." },
    ],
    tips: [
      "Cùng UI với Feature Flags — filter sẵn killSwitchOnly=true.",
      "Kill switch khác feature flag: nó tắt NGAY LẬP TỨC, không gradual rollout.",
      "Chỉ dùng khi có incident thực sự. Mỗi lần toggle phải có reason rõ ràng.",
    ],
  },

  "/ops/dead-letters": {
    title: "Dead Letter Queue",
    description:
      "Quản lý DLQ: messages bị lỗi không xử lý được. Paginated (50/trang) với detail drawer, bulk actions, CSV export.",
    steps: [
      { title: "Filter", description: "Status (open/failed/resolved/discarded/all), QueueName, Source, full-text search." },
      { title: "Xem bảng", description: "Columns: ID, Source, QueueName, EventType, Status (badge), RetryCount, ErrorCode, CreatedAt." },
      { title: "Xem chi tiết", description: "Click row → drawer: all fields, raw JSON payload, audit history, Retry/Discard buttons." },
      { title: "Retry/Discard", description: "Per-item hoặc bulk (checkbox + header button). Cần reason." },
      { title: "Export CSV", description: "Download DLQ data." },
    ],
    tips: [
      "Status tones: open (warning), failed (danger), resolved (success), discarded (muted).",
      "Bulk actions: tick checkboxes → Retry/Discard selected. Mỗi action cần reason.",
      "DLQ tích tụ = systemic problem. Đừng chỉ retry — investigate root cause.",
      "Raw payload trong drawer giúp debug lỗi cụ thể.",
    ],
  },

  "/ops/notifications": {
    title: "Broadcasts & Notifications",
    description:
      "Soạn và quản lý broadcast notifications cho users. CRUD + scheduling + audience targeting + delivery estimate.",
    steps: [
      { title: "Filter broadcasts", description: "Status (draft/scheduled/sent/cancelled/all), Channel (push/email/in_app/all)." },
      { title: "Xem bảng", description: "Columns: Title, Body (truncated), Channel badge, Status badge, ScheduledAt, CreatedAt." },
      { title: "Compose broadcast", description: "Bấm Create → modal: Title, Body, Channel (push/email/in_app), ScheduledAt (optional)." },
      { title: "Set audience", description: "Filters: locale codes, plan names, levels, country codes, specific userIds (newline-delimited UUIDs)." },
      { title: "Estimate audience", description: "Bấm 'Estimate audience' → hiển thị 'X estimated recipients'." },
      { title: "Schedule/Send", description: "Set ScheduledAt cho tương lai hoặc gửi ngay. Cancel nếu cần." },
      { title: "View detail", description: "Click → drawer: all fields + audit events table (action, actor, reason, timestamp)." },
    ],
    tips: [
      "Pagination 50/trang.",
      "Mọi thao tác cần reason ≥3 ký tự.",
      "Audience filters comma-separated (locale, plan, level, country) hoặc newline-separated (userIds).",
      "Push notification tối đa 1/ngày. Quá nhiều → users tắt notifications hoặc uninstall.",
      "Best time: 8-9AM hoặc 8-9PM.",
    ],
  },

  "/ops/security": {
    title: "Security Events",
    description:
      "Theo dõi sự kiện bảo mật. Bảng: Time, Type (failed_login/permission_denied/suspicious_request/rate_limit_exceeded/privilege_escalation_attempt), Severity (low→critical), Actor, Target, Action, Reason.",
    steps: [
      { title: "Filter events", description: "Type dropdown, Severity dropdown, Actor ID, Date From/To." },
      { title: "Xem bảng", description: "Columns: Time, Type badge, Severity badge (color-coded), Actor, Target, Action, Reason." },
      { title: "Xem chi tiết", description: "Click → drawer: full event data, Before/After JSON, resolutions audit log." },
      { title: "Resolve", description: "Mark as Resolved (problem fixed) hoặc Mark as False Positive. Cần reason." },
      { title: "Export CSV", description: "Download events." },
    ],
    tips: [
      "Severity colors: low (xám), medium (vàng), high (cam), critical (đỏ).",
      "privilege_escalation_attempt = CỰC KỲ nguy hiểm — investigate ngay.",
      "rate_limit_exceeded nhiều = có thể là DDoS hoặc bot scraping.",
      "False Positive: đánh dấu khi confirm event là harmless (ví dụ: admin quên password).",
    ],
  },

  "/import": {
    title: "Import Hub",
    description:
      "Dashboard import: 6 KPI cards (Pending, In Progress, Succeeded 24h, Failed 24h, Errors 24h, Active Manifests) + navigation buttons. Auto-refresh 30 giây.",
    steps: [
      { title: "Xem KPI cards", description: "6 cards: Pending (đang chờ), In Progress, Succeeded 24h (✓ xanh), Failed 24h, Errors 24h, Active Manifests." },
      { title: "Navigate", description: "2 buttons: đi tới Import Failed và Import Manifests." },
    ],
    tips: [
      "Trang chỉ đọc — overview status. Actions ở trang con.",
      "Auto-refresh mỗi 30 giây.",
      "Failed 24h tăng = kiểm tra ngay Import Failed page.",
    ],
    relatedLinks: [
      { label: "Import Manifests", href: "/import/manifests" },
      { label: "Failed Imports", href: "/import/failed" },
    ],
  },

  "/import/manifests": {
    title: "Import Manifests",
    description:
      "CRUD quản lý import mapping manifests. Manifest = JSON mapping rule từ source → target. Columns: Source, Target, Version, Status (draft/active/archived), Notes.",
    steps: [
      { title: "Xem manifests", description: "Bảng: Source (monospace), Target (monospace), Version, Status badge, Notes, Actions." },
      { title: "Create manifest", description: "Modal: sourceType, targetType, version, status, notes, mappingJson (JSON textarea — validated), reason." },
      { title: "Edit manifest", description: "Click Edit → same modal with existing values." },
      { title: "Run manifest", description: "Nút Run (chỉ enabled khi status = active) để execute import theo mapping." },
    ],
    tips: [
      "mappingJson phải là valid JSON — form sẽ validate trước khi submit.",
      "Status flow: draft → active → archived. Chỉ active manifests mới Run được.",
      "MỌI thao tác cần audit reason ≥3 ký tự.",
      "Manifests define HOW to import — actual data comes from source systems.",
    ],
  },

  "/import/failed": {
    title: "Import Failed Queue",
    description:
      "Danh sách items import bị lỗi. Filter + Retry/Discard per-item hoặc bulk. Limit 200 items.",
    steps: [
      { title: "Filter errors", description: "Phase (dropdown, dynamic), Severity (dropdown, dynamic)." },
      { title: "Xem bảng", description: "Columns (+ checkbox): RawItemID, SourceKey, Phase, Severity badge (fatal=đỏ, warning=vàng), Message, Actions." },
      { title: "Retry item", description: "Bấm Retry → modal reason → item quay lại processing queue." },
      { title: "Discard item", description: "Bấm Discard → modal reason → item bị bỏ qua vĩnh viễn." },
      { title: "Bulk actions", description: "Tick checkboxes → 'Bulk Retry (n)' hoặc 'Bulk Discard (n)' buttons ở header." },
    ],
    tips: [
      "Cần quyền content.manage (canWrite).",
      "Severity fatal = data corruption hoặc critical error. Warning = recoverable.",
      "MỌI action (retry/discard) cần reason ≥3 ký tự cho audit.",
      "Max 200 items hiển thị. Nếu nhiều hơn, fix root cause trước khi retry.",
    ],
  },

  "/audit": {
    title: "Audit Log",
    description:
      "Lịch sử mọi hành động admin. Bảng read-only: ai làm gì, khi nào, before/after data.",
    steps: [
      { title: "Filter", description: "Actor (admin ID), action type, target resource, date range." },
      { title: "Xem bảng", description: "Columns: Time, Actor, Action, Target, Changes summary." },
      { title: "Xem chi tiết", description: "Click → full payload: before state, after state, reason." },
      { title: "Export", description: "Download audit log cho compliance reporting." },
    ],
    tips: [
      "Audit log KHÔNG THỂ XÓA — compliance requirement.",
      "Dùng khi cần investigate: ai thay đổi gì, khi nào, tại sao.",
      "Cần quyền viewer.audit hoặc iam.manage.",
    ],
  },

  "/settings": {
    title: "System Settings",
    description:
      "Feature flags grouped theo namespace (auth, billing, monetization, v.v.). Giống Feature Flags page nhưng hiển thị theo nhóm collapsible.",
    steps: [
      { title: "Xem groups", description: "Flags grouped theo namespace: auth, billing, monetization, etc. + _root cho ungrouped." },
      { title: "Search", description: "Full-text search filter cả groups và flags." },
      { title: "Edit flag", description: "Bấm Edit → modal: enabled, killSwitch, rules JSON, reason. Confirmation key cho high-risk." },
      { title: "Export CSV", description: "Download toàn bộ settings." },
    ],
    tips: [
      "Đây là CÙNG data với Feature Flags page — chỉ khác cách hiển thị (grouped vs flat).",
      "High-risk flags (auth.*, billing.*, etc.) cần confirmation key.",
      "Cần quyền iam.manage.",
    ],
  },

  "/settings/companion": {
    title: "Companion Settings (Shiba)",
    description:
      "Cấu hình bot companion (Shiba): Rive assets, behavior settings, và CRUD quản lý tips.",
    steps: [
      { title: "Xem config cards", description: "3 cards: Rive Asset (current + available count), Tips (count + categories), Behavior (proactive tip interval, sleep timeout seconds)." },
      { title: "Quản lý Tips", description: "Bảng: Category, ContentJA, ContentVI, ExampleJA, ExampleVI, Active badge, SortOrder, Actions." },
      { title: "Filter tips", description: "Dropdown Category: all/grammar/vocab/keigo/culture/business." },
      { title: "Create tip", description: "Modal: category (select), contentJa (required), contentVi (required), exampleJa, exampleVi, sortOrder." },
      { title: "Edit/Delete tip", description: "Click Edit/Delete per row. Edit mode thêm Active checkbox." },
    ],
    tips: [
      "Companion = bot Shiba trên learner app, hiển thị tips ngẫu nhiên.",
      "Categories: grammar, vocab, keigo, culture, business — mix cho đa dạng.",
      "Proactive tip interval = số giây giữa các lần tự động show tip.",
      "Sleep timeout = giây không tương tác trước khi companion 'ngủ'.",
    ],
  },

  /* ───── Legal ───── */
  "/legal/documents": {
    title: "Legal Documents",
    description:
      "Quản lý văn bản pháp lý. Danh sách documents theo policyKey. View versions, Create draft, Publish, Rollback.",
    steps: [
      { title: "Xem documents", description: "Bảng documents theo policyKey: tên, version hiện tại, status." },
      { title: "Xem versions", description: "Click → danh sách versions theo thời gian." },
      { title: "Create draft", description: "Tạo phiên bản mới ở trạng thái draft." },
      { title: "Publish", description: "Publish draft → version mới active cho users." },
      { title: "Rollback", description: "Quay về version cũ nếu cần." },
    ],
    tips: [
      "Cần quyền iam.manage.",
      "Publish version mới = users sẽ thấy version mới khi truy cập.",
      "Giữ lại TẤT CẢ versions cũ — legal requirement.",
    ],
  },

  "/legal/terms": {
    title: "Terms of Service",
    description:
      "Quản lý Terms of Service (fixed policyKey = terms_of_service). Cùng UI với Legal Documents nhưng lock vào ToS.",
    steps: [
      { title: "Xem version history", description: "Danh sách versions ToS: version number, status, published date." },
      { title: "Create new version", description: "Draft version mới → edit content → Publish." },
    ],
    tips: [
      "Thay đổi ToS cần thông báo users trước 30 ngày (GDPR/JP law).",
    ],
  },

  "/legal/consent": {
    title: "Privacy Policy / Consent",
    description:
      "Quản lý Privacy Policy (fixed policyKey = privacy_policy). Cùng UI với Legal Documents.",
    steps: [
      { title: "Xem versions", description: "History privacy policy versions." },
      { title: "Create/Publish", description: "Draft → edit → Publish new version." },
    ],
    tips: [
      "Privacy Policy thay đổi cũng cần notice period.",
    ],
  },

  "/legal/cookies": {
    title: "Cookie Settings",
    description:
      "Quản lý cookie categories và consent flow configuration.",
    steps: [
      { title: "Xem categories", description: "Danh sách cookie categories: necessary, analytics, marketing, etc." },
      { title: "Edit categories", description: "Sửa mô tả, mandatory status cho từng category." },
      { title: "Configure consent flow", description: "Set cách hiển thị consent banner cho users." },
    ],
    tips: [
      "Category 'necessary' luôn mandatory — không cho phép opt-out.",
      "GDPR: consent phải opt-in (không pre-checked).",
    ],
  },

  "/legal/retention": {
    title: "Data Retention",
    description:
      "Quản lý retention schedules: bao lâu giữ mỗi loại data trước khi xóa tự động.",
    steps: [
      { title: "Xem schedules", description: "Bảng: data type, retention period, deletion policy." },
      { title: "Set periods", description: "Chỉnh retention period cho từng loại data." },
      { title: "Schedule deletion", description: "Cấu hình auto-deletion job." },
    ],
    tips: [
      "User data: minimum cần giữ theo legal requirement trước khi auto-delete.",
      "Audit logs thường giữ vĩnh viễn hoặc rất lâu.",
    ],
  },

  "/legal/tokushoho": {
    title: "特商法 (Tokushoho)",
    description:
      "Quản lý văn bản Tokushoho (luật thương mại đặc biệt Nhật Bản) — bắt buộc cho dịch vụ trả phí tại Nhật.",
    steps: [
      { title: "Xem nội dung", description: "Tokushoho compliance document hiện tại." },
      { title: "Update", description: "Sửa nội dung: tên công ty, địa chỉ, contact, pricing, refund policy, v.v." },
      { title: "Publish", description: "Publish version mới." },
    ],
    tips: [
      "BẮT BUỘC cho dịch vụ có thu phí tại thị trường Nhật.",
      "Cần cập nhật khi thay đổi: giá, chính sách refund, thông tin công ty.",
    ],
  },

  /* ───── IAM ───── */
  "/iam": {
    title: "IAM Overview",
    description:
      "Tổng quan phân quyền: stats về admins, roles, permissions đang active.",
    steps: [
      { title: "Xem stats", description: "Số admins, roles, permissions active." },
      { title: "Navigate", description: "Đi tới Roles, Permissions, Admins, Role Audit." },
    ],
    relatedLinks: [
      { label: "Roles", href: "/iam/roles" },
      { label: "Permissions", href: "/iam/permissions" },
      { label: "Admins", href: "/iam/admins" },
      { label: "Role Audit", href: "/iam/role-audit" },
    ],
  },

  "/iam/roles": {
    title: "Roles",
    description:
      "CRUD quản lý roles. Bảng: name, permissions count, user count. Create/Edit role, assign permissions, delete.",
    steps: [
      { title: "Xem roles", description: "Bảng: tên role, số permissions gắn, số admins assigned." },
      { title: "Create role", description: "Bấm Create → nhập tên, mô tả → chọn permissions từ catalog." },
      { title: "Edit role", description: "Click → sửa tên/mô tả, thêm/xóa permissions." },
      { title: "Delete role", description: "Xóa role (chỉ khi không còn admin nào assigned)." },
    ],
    tips: [
      "Cần quyền iam.manage.",
      "Principle of least privilege: chỉ gán permissions tối thiểu cần thiết.",
      "Built-in roles (Super Admin) không nên sửa.",
    ],
  },

  "/iam/permissions": {
    title: "Permissions Catalog",
    description:
      "Danh sách read-only tất cả permission codes. Bảng: code, description, category.",
    steps: [
      { title: "Xem danh sách", description: "Bảng: code (monospace), mô tả, category, roles đang dùng." },
      { title: "Tìm permission", description: "Search theo code (ví dụ: admin.content.read)." },
    ],
    tips: [
      "Trang chỉ đọc — permissions được define ở backend code.",
      "Code format: domain.resource.action (ví dụ: admin.content.write, iam.manage).",
    ],
  },

  "/iam/admins": {
    title: "Admin Accounts",
    description:
      "CRUD quản lý admin accounts. Bảng: email, roles, status, last login. Create/Edit/Assign roles/Suspend/Delete.",
    steps: [
      { title: "Xem admins", description: "Bảng: email, roles assigned, status (active/suspended), last login." },
      { title: "Create/Invite", description: "Bấm Create → nhập email → assign roles → gửi invite." },
      { title: "Edit admin", description: "Click → sửa roles, status." },
      { title: "Suspend/Delete", description: "Suspend = khóa tạm. Delete = xóa vĩnh viễn." },
    ],
    tips: [
      "Cần quyền iam.manage.",
      "Suspended admin không login được nhưng giữ audit history.",
      "Super Admin role nên giới hạn 1–2 người tối đa.",
    ],
  },

  "/iam/role-audit": {
    title: "Role Audit Log",
    description:
      "Lịch sử thay đổi roles/permissions. Read-only audit trail: ai thay đổi role nào, khi nào.",
    steps: [
      { title: "Xem log", description: "Bảng: timestamp, actor, action (create/update/delete), target role, changes." },
      { title: "Filter", description: "Theo actor, date range, action type." },
    ],
    tips: [
      "Trang chỉ đọc.",
      "Dùng khi cần investigate: ai đã grant/revoke permission nào.",
    ],
  },
};

/**
 * Get help content for a given admin route path.
 * Tries exact match first, then prefix match for nested routes.
 */
export function getAdminHelpContent(path: string): HelpContent | null {
  // Exact match
  if (ADMIN_HELP_CONTENT[path]) {
    return ADMIN_HELP_CONTENT[path];
  }
  // Try parent path
  const segments = path.split("/").filter(Boolean);
  while (segments.length > 0) {
    segments.pop();
    const parent = segments.length > 0 ? `/${segments.join("/")}` : "/";
    if (ADMIN_HELP_CONTENT[parent]) {
      return ADMIN_HELP_CONTENT[parent];
    }
  }
  return null;
}
