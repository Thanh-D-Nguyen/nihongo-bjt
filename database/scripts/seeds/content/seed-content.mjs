/**
 * Seed Japanese content for search: lexemes, kanji, grammar, example sentences.
 *
 * Run:  node scripts/seed-content.mjs
 *
 * Uses raw pg to insert into content schema tables.
 * Covers BJT business Japanese + daily-life vocabulary for realistic search testing.
 */

import pg from "pg";
const { Client } = pg;

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:15432/nihongo_bjt";

// ═══════════════════════════════════════════════════════════════════════
// Example Sentences
// ═══════════════════════════════════════════════════════════════════════

const exampleSentences = [
  { key: "ex-001", japaneseText: "会議は午後3時から始まります。", reading: "かいぎはごごさんじからはじまります。", translationVi: "Cuộc họp bắt đầu lúc 3 giờ chiều." },
  { key: "ex-002", japaneseText: "この書類にサインをお願いします。", reading: "このしょるいにさいんをおねがいします。", translationVi: "Xin hãy ký vào tài liệu này." },
  { key: "ex-003", japaneseText: "出張は来週の月曜日です。", reading: "しゅっちょうはらいしゅうのげつようびです。", translationVi: "Chuyến công tác là vào thứ Hai tuần sau." },
  { key: "ex-004", japaneseText: "新しいプロジェクトを担当することになりました。", reading: "あたらしいぷろじぇくとをたんとうすることになりました。", translationVi: "Tôi được giao phụ trách dự án mới." },
  { key: "ex-005", japaneseText: "お忙しいところ恐れ入りますが。", reading: "おいそがしいところおそれいりますが。", translationVi: "Xin lỗi vì làm phiền khi bạn đang bận." },
  { key: "ex-006", japaneseText: "ご検討いただけますでしょうか。", reading: "ごけんとういただけますでしょうか。", translationVi: "Bạn có thể xem xét giúp được không ạ?" },
  { key: "ex-007", japaneseText: "電車が遅れて、遅刻してしまいました。", reading: "でんしゃがおくれて、ちこくしてしまいました。", translationVi: "Tàu bị trễ nên tôi đã đi muộn." },
  { key: "ex-008", japaneseText: "日本語を勉強して3年になります。", reading: "にほんごをべんきょうしてさんねんになります。", translationVi: "Tôi đã học tiếng Nhật được 3 năm." },
  { key: "ex-009", japaneseText: "すみません、道を教えていただけませんか。", reading: "すみません、みちをおしえていただけませんか。", translationVi: "Xin lỗi, bạn có thể chỉ đường cho tôi không?" },
  { key: "ex-010", japaneseText: "来月から新しい部署に異動になります。", reading: "らいげつからあたらしいぶしょにいどうになります。", translationVi: "Từ tháng sau tôi sẽ chuyển sang bộ phận mới." },
  { key: "ex-011", japaneseText: "この件についてご報告いたします。", reading: "このけんについてごほうこくいたします。", translationVi: "Tôi xin báo cáo về vấn đề này." },
  { key: "ex-012", japaneseText: "お先に失礼します。", reading: "おさきにしつれいします。", translationVi: "Xin phép tôi về trước." },
  { key: "ex-013", japaneseText: "予算を超えないようにしてください。", reading: "よさんをこえないようにしてください。", translationVi: "Xin đừng vượt quá ngân sách." },
  { key: "ex-014", japaneseText: "取引先との打ち合わせがあります。", reading: "とりひきさきとのうちあわせがあります。", translationVi: "Tôi có cuộc họp với đối tác kinh doanh." },
  { key: "ex-015", japaneseText: "納期は今月末です。", reading: "のうきはこんげつまつです。", translationVi: "Hạn giao hàng là cuối tháng này." },
  { key: "ex-016", japaneseText: "毎朝7時に起きます。", reading: "まいあさしちじにおきます。", translationVi: "Mỗi sáng tôi thức dậy lúc 7 giờ." },
  { key: "ex-017", japaneseText: "コンビニでお弁当を買いました。", reading: "こんびにでおべんとうをかいました。", translationVi: "Tôi đã mua cơm hộp ở cửa hàng tiện lợi." },
  { key: "ex-018", japaneseText: "天気がいいから散歩しましょう。", reading: "てんきがいいからさんぽしましょう。", translationVi: "Thời tiết đẹp nên hãy đi dạo nhé." },
  { key: "ex-019", japaneseText: "駅まで歩いて10分ぐらいです。", reading: "えきまであるいてじゅっぷんぐらいです。", translationVi: "Đi bộ đến ga khoảng 10 phút." },
  { key: "ex-020", japaneseText: "週末は映画を見に行きたいです。", reading: "しゅうまつはえいがをみにいきたいです。", translationVi: "Cuối tuần tôi muốn đi xem phim." },
  { key: "ex-021", japaneseText: "彼は仕事に対してとても真面目です。", reading: "かれはしごとにたいしてとてもまじめです。", translationVi: "Anh ấy rất nghiêm túc đối với công việc." },
  { key: "ex-022", japaneseText: "売上が前年比120%に達しました。", reading: "うりあげがぜんねんひひゃくにじゅっぱーせんとにたっしました。", translationVi: "Doanh số đạt 120% so với năm trước." },
  { key: "ex-023", japaneseText: "申し訳ございませんが、在庫切れです。", reading: "もうしわけございませんが、ざいこぎれです。", translationVi: "Rất xin lỗi, hiện đã hết hàng." },
  { key: "ex-024", japaneseText: "この問題について一緒に考えましょう。", reading: "このもんだいについていっしょにかんがえましょう。", translationVi: "Hãy cùng suy nghĩ về vấn đề này." },
  { key: "ex-025", japaneseText: "ご不明な点がございましたらお申し付けください。", reading: "ごふめいなてんがございましたらおもうしつけください。", translationVi: "Nếu có điều gì không rõ, xin hãy cho chúng tôi biết." },
];

// ═══════════════════════════════════════════════════════════════════════
// Lexemes (50 entries — business + daily life)
// ═══════════════════════════════════════════════════════════════════════

const lexemes = [
  // ── BJT / Business ──
  { headword: "会議", reading: "かいぎ", jlptLevel: "N4", shortMeaningVi: "cuộc họp", senses: [{ pos: "danh từ", meaningVi: "cuộc họp, hội nghị" }] },
  { headword: "書類", reading: "しょるい", jlptLevel: "N3", shortMeaningVi: "tài liệu", senses: [{ pos: "danh từ", meaningVi: "tài liệu, giấy tờ" }] },
  { headword: "出張", reading: "しゅっちょう", jlptLevel: "N3", shortMeaningVi: "công tác", senses: [{ pos: "danh từ", meaningVi: "chuyến công tác, đi công tác" }] },
  { headword: "担当", reading: "たんとう", jlptLevel: "N3", shortMeaningVi: "phụ trách", senses: [{ pos: "danh từ", meaningVi: "phụ trách, đảm nhiệm" }, { pos: "động từ する", meaningVi: "chịu trách nhiệm, phụ trách" }] },
  { headword: "報告", reading: "ほうこく", jlptLevel: "N3", shortMeaningVi: "báo cáo", senses: [{ pos: "danh từ", meaningVi: "báo cáo, tường trình" }, { pos: "động từ する", meaningVi: "báo cáo, trình bày" }] },
  { headword: "予算", reading: "よさん", jlptLevel: "N2", shortMeaningVi: "ngân sách", senses: [{ pos: "danh từ", meaningVi: "ngân sách, kinh phí" }] },
  { headword: "納期", reading: "のうき", jlptLevel: "N2", shortMeaningVi: "hạn giao hàng", senses: [{ pos: "danh từ", meaningVi: "hạn giao hàng, thời hạn giao" }] },
  { headword: "取引先", reading: "とりひきさき", jlptLevel: "N2", shortMeaningVi: "đối tác", senses: [{ pos: "danh từ", meaningVi: "đối tác kinh doanh, khách hàng" }] },
  { headword: "売上", reading: "うりあげ", jlptLevel: "N2", shortMeaningVi: "doanh số", senses: [{ pos: "danh từ", meaningVi: "doanh số, doanh thu" }] },
  { headword: "在庫", reading: "ざいこ", jlptLevel: "N2", shortMeaningVi: "tồn kho", senses: [{ pos: "danh từ", meaningVi: "hàng tồn kho, kho hàng" }] },
  { headword: "部署", reading: "ぶしょ", jlptLevel: "N2", shortMeaningVi: "bộ phận", senses: [{ pos: "danh từ", meaningVi: "bộ phận, phòng ban" }] },
  { headword: "異動", reading: "いどう", jlptLevel: "N2", shortMeaningVi: "chuyển công tác", senses: [{ pos: "danh từ", meaningVi: "chuyển công tác, thay đổi vị trí" }] },
  { headword: "検討", reading: "けんとう", jlptLevel: "N2", shortMeaningVi: "xem xét", senses: [{ pos: "danh từ", meaningVi: "xem xét, cân nhắc" }, { pos: "động từ する", meaningVi: "xem xét, nghiên cứu" }] },
  { headword: "打ち合わせ", reading: "うちあわせ", jlptLevel: "N2", shortMeaningVi: "họp bàn", senses: [{ pos: "danh từ", meaningVi: "cuộc họp bàn, thảo luận" }] },
  { headword: "見積もり", reading: "みつもり", jlptLevel: "N2", shortMeaningVi: "báo giá", senses: [{ pos: "danh từ", meaningVi: "bản báo giá, ước tính chi phí" }] },
  { headword: "契約", reading: "けいやく", jlptLevel: "N2", shortMeaningVi: "hợp đồng", senses: [{ pos: "danh từ", meaningVi: "hợp đồng, khế ước" }, { pos: "động từ する", meaningVi: "ký hợp đồng" }] },
  { headword: "経営", reading: "けいえい", jlptLevel: "N2", shortMeaningVi: "kinh doanh", senses: [{ pos: "danh từ", meaningVi: "kinh doanh, quản lý doanh nghiệp" }] },
  { headword: "提案", reading: "ていあん", jlptLevel: "N2", shortMeaningVi: "đề xuất", senses: [{ pos: "danh từ", meaningVi: "đề xuất, đề nghị" }, { pos: "động từ する", meaningVi: "đề xuất, kiến nghị" }] },
  { headword: "営業", reading: "えいぎょう", jlptLevel: "N3", shortMeaningVi: "kinh doanh", senses: [{ pos: "danh từ", meaningVi: "kinh doanh, bán hàng, phòng sales" }] },
  { headword: "残業", reading: "ざんぎょう", jlptLevel: "N3", shortMeaningVi: "làm thêm giờ", senses: [{ pos: "danh từ", meaningVi: "làm thêm giờ, tăng ca" }] },

  // ── Daily life / N4-N5 ──
  { headword: "天気", reading: "てんき", jlptLevel: "N5", shortMeaningVi: "thời tiết", senses: [{ pos: "danh từ", meaningVi: "thời tiết, trời" }] },
  { headword: "電車", reading: "でんしゃ", jlptLevel: "N5", shortMeaningVi: "tàu điện", senses: [{ pos: "danh từ", meaningVi: "tàu điện" }] },
  { headword: "勉強", reading: "べんきょう", jlptLevel: "N5", shortMeaningVi: "học tập", senses: [{ pos: "danh từ", meaningVi: "việc học, học tập" }, { pos: "động từ する", meaningVi: "học, học tập" }] },
  { headword: "散歩", reading: "さんぽ", jlptLevel: "N4", shortMeaningVi: "đi dạo", senses: [{ pos: "danh từ", meaningVi: "đi dạo, đi bộ" }] },
  { headword: "映画", reading: "えいが", jlptLevel: "N5", shortMeaningVi: "phim", senses: [{ pos: "danh từ", meaningVi: "phim, điện ảnh" }] },
  { headword: "食べる", reading: "たべる", jlptLevel: "N5", shortMeaningVi: "ăn", senses: [{ pos: "động từ", meaningVi: "ăn" }] },
  { headword: "飲む", reading: "のむ", jlptLevel: "N5", shortMeaningVi: "uống", senses: [{ pos: "động từ", meaningVi: "uống" }] },
  { headword: "行く", reading: "いく", jlptLevel: "N5", shortMeaningVi: "đi", senses: [{ pos: "động từ", meaningVi: "đi" }] },
  { headword: "来る", reading: "くる", jlptLevel: "N5", shortMeaningVi: "đến", senses: [{ pos: "động từ", meaningVi: "đến, tới" }] },
  { headword: "見る", reading: "みる", jlptLevel: "N5", shortMeaningVi: "xem", senses: [{ pos: "động từ", meaningVi: "nhìn, xem" }] },
  { headword: "聞く", reading: "きく", jlptLevel: "N5", shortMeaningVi: "nghe", senses: [{ pos: "động từ", meaningVi: "nghe, hỏi" }] },
  { headword: "読む", reading: "よむ", jlptLevel: "N5", shortMeaningVi: "đọc", senses: [{ pos: "動từ", meaningVi: "đọc" }] },
  { headword: "書く", reading: "かく", jlptLevel: "N5", shortMeaningVi: "viết", senses: [{ pos: "động từ", meaningVi: "viết" }] },
  { headword: "話す", reading: "はなす", jlptLevel: "N5", shortMeaningVi: "nói", senses: [{ pos: "động từ", meaningVi: "nói, nói chuyện" }] },
  { headword: "買う", reading: "かう", jlptLevel: "N5", shortMeaningVi: "mua", senses: [{ pos: "động từ", meaningVi: "mua" }] },
  { headword: "教える", reading: "おしえる", jlptLevel: "N5", shortMeaningVi: "dạy", senses: [{ pos: "động từ", meaningVi: "dạy, chỉ bảo" }] },
  { headword: "友達", reading: "ともだち", jlptLevel: "N5", shortMeaningVi: "bạn bè", senses: [{ pos: "danh từ", meaningVi: "bạn bè" }] },
  { headword: "仕事", reading: "しごと", jlptLevel: "N4", shortMeaningVi: "công việc", senses: [{ pos: "danh từ", meaningVi: "công việc, việc làm" }] },
  { headword: "病院", reading: "びょういん", jlptLevel: "N5", shortMeaningVi: "bệnh viện", senses: [{ pos: "danh từ", meaningVi: "bệnh viện" }] },
  { headword: "銀行", reading: "ぎんこう", jlptLevel: "N5", shortMeaningVi: "ngân hàng", senses: [{ pos: "danh từ", meaningVi: "ngân hàng" }] },

  // ── N3-N1 ──
  { headword: "経験", reading: "けいけん", jlptLevel: "N3", shortMeaningVi: "kinh nghiệm", senses: [{ pos: "danh từ", meaningVi: "kinh nghiệm" }, { pos: "động từ する", meaningVi: "trải nghiệm" }] },
  { headword: "環境", reading: "かんきょう", jlptLevel: "N3", shortMeaningVi: "môi trường", senses: [{ pos: "danh từ", meaningVi: "môi trường" }] },
  { headword: "社会", reading: "しゃかい", jlptLevel: "N3", shortMeaningVi: "xã hội", senses: [{ pos: "danh từ", meaningVi: "xã hội" }] },
  { headword: "政治", reading: "せいじ", jlptLevel: "N3", shortMeaningVi: "chính trị", senses: [{ pos: "danh từ", meaningVi: "chính trị" }] },
  { headword: "経済", reading: "けいざい", jlptLevel: "N3", shortMeaningVi: "kinh tế", senses: [{ pos: "danh từ", meaningVi: "kinh tế" }] },
  { headword: "技術", reading: "ぎじゅつ", jlptLevel: "N3", shortMeaningVi: "kỹ thuật", senses: [{ pos: "danh từ", meaningVi: "kỹ thuật, công nghệ" }] },
  { headword: "交渉", reading: "こうしょう", jlptLevel: "N1", shortMeaningVi: "đàm phán", senses: [{ pos: "danh từ", meaningVi: "đàm phán, thương lượng" }] },
  { headword: "戦略", reading: "せんりゃく", jlptLevel: "N1", shortMeaningVi: "chiến lược", senses: [{ pos: "danh từ", meaningVi: "chiến lược" }] },
  { headword: "効率", reading: "こうりつ", jlptLevel: "N2", shortMeaningVi: "hiệu suất", senses: [{ pos: "danh từ", meaningVi: "hiệu suất, năng suất" }] },
  { headword: "責任", reading: "せきにん", jlptLevel: "N3", shortMeaningVi: "trách nhiệm", senses: [{ pos: "danh từ", meaningVi: "trách nhiệm" }] },
];

// ═══════════════════════════════════════════════════════════════════════
// Kanji (40 entries — common business + daily)
// ═══════════════════════════════════════════════════════════════════════

const kanjiList = [
  { character: "会", meaningVi: "hội, gặp", onyomi: "カイ、エ", kunyomi: "あ.う", strokeCount: 6, level: 4, examples: [{ word: "会議", reading: "かいぎ", meaningVi: "cuộc họp", hanViet: "hội nghị" }, { word: "会社", reading: "かいしゃ", meaningVi: "công ty", hanViet: "hội xã" }] },
  { character: "社", meaningVi: "xã, công ty", onyomi: "シャ", kunyomi: "やしろ", strokeCount: 7, level: 4, examples: [{ word: "会社", reading: "かいしゃ", meaningVi: "công ty", hanViet: "hội xã" }, { word: "社長", reading: "しゃちょう", meaningVi: "giám đốc", hanViet: "xã trưởng" }] },
  { character: "仕", meaningVi: "phục vụ", onyomi: "シ、ジ", kunyomi: "つか.える", strokeCount: 5, level: 4, examples: [{ word: "仕事", reading: "しごと", meaningVi: "công việc", hanViet: "sĩ sự" }, { word: "仕方", reading: "しかた", meaningVi: "cách làm", hanViet: "sĩ phương" }] },
  { character: "事", meaningVi: "việc, sự", onyomi: "ジ、ズ", kunyomi: "こと", strokeCount: 8, level: 4, examples: [{ word: "仕事", reading: "しごと", meaningVi: "công việc", hanViet: "sĩ sự" }, { word: "事務", reading: "じむ", meaningVi: "sự vụ", hanViet: "sự vụ" }] },
  { character: "業", meaningVi: "nghiệp", onyomi: "ギョウ、ゴウ", kunyomi: "わざ", strokeCount: 13, level: 3, examples: [{ word: "営業", reading: "えいぎょう", meaningVi: "kinh doanh", hanViet: "doanh nghiệp" }, { word: "残業", reading: "ざんぎょう", meaningVi: "tăng ca", hanViet: "tàn nghiệp" }] },
  { character: "売", meaningVi: "bán", onyomi: "バイ", kunyomi: "う.る、う.れる", strokeCount: 7, level: 4, examples: [{ word: "売上", reading: "うりあげ", meaningVi: "doanh số", hanViet: "mại thượng" }, { word: "販売", reading: "はんばい", meaningVi: "bán hàng", hanViet: "phiến mại" }] },
  { character: "買", meaningVi: "mua", onyomi: "バイ", kunyomi: "か.う", strokeCount: 12, level: 5, examples: [{ word: "買い物", reading: "かいもの", meaningVi: "mua sắm", hanViet: "mãi vật" }] },
  { character: "経", meaningVi: "kinh", onyomi: "ケイ、キョウ", kunyomi: "へ.る、た.つ", strokeCount: 11, level: 3, examples: [{ word: "経済", reading: "けいざい", meaningVi: "kinh tế", hanViet: "kinh tế" }, { word: "経験", reading: "けいけん", meaningVi: "kinh nghiệm", hanViet: "kinh nghiệm" }] },
  { character: "済", meaningVi: "tế, xong", onyomi: "サイ、セイ", kunyomi: "す.む", strokeCount: 11, level: 3, examples: [{ word: "経済", reading: "けいざい", meaningVi: "kinh tế", hanViet: "kinh tế" }] },
  { character: "報", meaningVi: "báo", onyomi: "ホウ", kunyomi: "むく.いる", strokeCount: 12, level: 3, examples: [{ word: "報告", reading: "ほうこく", meaningVi: "báo cáo", hanViet: "báo cáo" }, { word: "情報", reading: "じょうほう", meaningVi: "thông tin", hanViet: "tình báo" }] },
  { character: "告", meaningVi: "cáo, thông báo", onyomi: "コク", kunyomi: "つ.げる", strokeCount: 7, level: 3, examples: [{ word: "報告", reading: "ほうこく", meaningVi: "báo cáo", hanViet: "báo cáo" }, { word: "広告", reading: "こうこく", meaningVi: "quảng cáo", hanViet: "quảng cáo" }] },
  { character: "日", meaningVi: "nhật, ngày", onyomi: "ニチ、ジツ", kunyomi: "ひ、か", strokeCount: 4, level: 5, examples: [{ word: "日本語", reading: "にほんご", meaningVi: "tiếng Nhật", hanViet: "nhật bản ngữ" }, { word: "毎日", reading: "まいにち", meaningVi: "mỗi ngày", hanViet: "mỗi nhật" }] },
  { character: "本", meaningVi: "bản, gốc", onyomi: "ホン", kunyomi: "もと", strokeCount: 5, level: 5, examples: [{ word: "日本", reading: "にほん", meaningVi: "Nhật Bản", hanViet: "nhật bản" }, { word: "本当", reading: "ほんとう", meaningVi: "thật sự", hanViet: "bản đương" }] },
  { character: "語", meaningVi: "ngữ, ngôn ngữ", onyomi: "ゴ", kunyomi: "かた.る", strokeCount: 14, level: 5, examples: [{ word: "日本語", reading: "にほんご", meaningVi: "tiếng Nhật", hanViet: "nhật bản ngữ" }, { word: "英語", reading: "えいご", meaningVi: "tiếng Anh", hanViet: "anh ngữ" }] },
  { character: "人", meaningVi: "nhân, người", onyomi: "ジン、ニン", kunyomi: "ひと", strokeCount: 2, level: 5, examples: [{ word: "日本人", reading: "にほんじん", meaningVi: "người Nhật", hanViet: "nhật bản nhân" }, { word: "一人", reading: "ひとり", meaningVi: "một người", hanViet: "nhất nhân" }] },
  { character: "大", meaningVi: "đại, lớn", onyomi: "ダイ、タイ", kunyomi: "おお.きい", strokeCount: 3, level: 5, examples: [{ word: "大学", reading: "だいがく", meaningVi: "đại học", hanViet: "đại học" }, { word: "大きい", reading: "おおきい", meaningVi: "to, lớn", hanViet: "đại" }] },
  { character: "学", meaningVi: "học", onyomi: "ガク", kunyomi: "まな.ぶ", strokeCount: 8, level: 5, examples: [{ word: "大学", reading: "だいがく", meaningVi: "đại học", hanViet: "đại học" }, { word: "学生", reading: "がくせい", meaningVi: "học sinh", hanViet: "học sinh" }] },
  { character: "時", meaningVi: "thời, giờ", onyomi: "ジ", kunyomi: "とき", strokeCount: 10, level: 5, examples: [{ word: "時間", reading: "じかん", meaningVi: "thời gian", hanViet: "thời gian" }] },
  { character: "間", meaningVi: "gian, khoảng", onyomi: "カン、ケン", kunyomi: "あいだ、ま", strokeCount: 12, level: 5, examples: [{ word: "時間", reading: "じかん", meaningVi: "thời gian", hanViet: "thời gian" }, { word: "人間", reading: "にんげん", meaningVi: "con người", hanViet: "nhân gian" }] },
  { character: "金", meaningVi: "kim, tiền", onyomi: "キン、コン", kunyomi: "かね、かな", strokeCount: 8, level: 5, examples: [{ word: "お金", reading: "おかね", meaningVi: "tiền", hanViet: "kim" }, { word: "金曜日", reading: "きんようび", meaningVi: "thứ Sáu", hanViet: "kim diệu nhật" }] },
  { character: "食", meaningVi: "thực, ăn", onyomi: "ショク、ジキ", kunyomi: "た.べる、く.う", strokeCount: 9, level: 5, examples: [{ word: "食べる", reading: "たべる", meaningVi: "ăn", hanViet: "thực" }, { word: "食事", reading: "しょくじ", meaningVi: "bữa ăn", hanViet: "thực sự" }] },
  { character: "出", meaningVi: "xuất, ra", onyomi: "シュツ、スイ", kunyomi: "で.る、だ.す", strokeCount: 5, level: 5, examples: [{ word: "出張", reading: "しゅっちょう", meaningVi: "công tác", hanViet: "xuất trương" }, { word: "出口", reading: "でぐち", meaningVi: "lối ra", hanViet: "xuất khẩu" }] },
  { character: "入", meaningVi: "nhập, vào", onyomi: "ニュウ", kunyomi: "い.る、はい.る", strokeCount: 2, level: 5, examples: [{ word: "入口", reading: "いりぐち", meaningVi: "lối vào", hanViet: "nhập khẩu" }] },
  { character: "長", meaningVi: "trưởng, dài", onyomi: "チョウ", kunyomi: "なが.い", strokeCount: 8, level: 5, examples: [{ word: "社長", reading: "しゃちょう", meaningVi: "giám đốc", hanViet: "xã trưởng" }, { word: "部長", reading: "ぶちょう", meaningVi: "trưởng phòng", hanViet: "bộ trưởng" }] },
  { character: "手", meaningVi: "thủ, tay", onyomi: "シュ", kunyomi: "て", strokeCount: 4, level: 5, examples: [{ word: "上手", reading: "じょうず", meaningVi: "giỏi", hanViet: "thượng thủ" }, { word: "手紙", reading: "てがみ", meaningVi: "thư", hanViet: "thủ chỉ" }] },
  { character: "話", meaningVi: "thoại, nói", onyomi: "ワ", kunyomi: "はな.す、はなし", strokeCount: 13, level: 5, examples: [{ word: "電話", reading: "でんわ", meaningVi: "điện thoại", hanViet: "điện thoại" }, { word: "話す", reading: "はなす", meaningVi: "nói", hanViet: "thoại" }] },
  { character: "電", meaningVi: "điện", onyomi: "デン", kunyomi: null, strokeCount: 13, level: 5, examples: [{ word: "電車", reading: "でんしゃ", meaningVi: "tàu điện", hanViet: "điện xa" }, { word: "電話", reading: "でんわ", meaningVi: "điện thoại", hanViet: "điện thoại" }] },
  { character: "車", meaningVi: "xa, xe", onyomi: "シャ", kunyomi: "くるま", strokeCount: 7, level: 5, examples: [{ word: "電車", reading: "でんしゃ", meaningVi: "tàu điện", hanViet: "điện xa" }, { word: "自動車", reading: "じどうしゃ", meaningVi: "ô tô", hanViet: "tự động xa" }] },
  { character: "道", meaningVi: "đạo, đường", onyomi: "ドウ、トウ", kunyomi: "みち", strokeCount: 12, level: 4, examples: [{ word: "道", reading: "みち", meaningVi: "đường", hanViet: "đạo" }] },
  { character: "約", meaningVi: "ước, khoảng", onyomi: "ヤク", kunyomi: null, strokeCount: 9, level: 3, examples: [{ word: "契約", reading: "けいやく", meaningVi: "hợp đồng", hanViet: "khế ước" }, { word: "約束", reading: "やくそく", meaningVi: "hẹn", hanViet: "ước thúc" }] },
  { character: "策", meaningVi: "sách, kế sách", onyomi: "サク", kunyomi: null, strokeCount: 12, level: 2, examples: [{ word: "政策", reading: "せいさく", meaningVi: "chính sách", hanViet: "chính sách" }, { word: "戦略", reading: "せんりゃく", meaningVi: "chiến lược", hanViet: "chiến lược" }] },
  { character: "効", meaningVi: "hiệu", onyomi: "コウ", kunyomi: "き.く", strokeCount: 8, level: 2, examples: [{ word: "効率", reading: "こうりつ", meaningVi: "hiệu suất", hanViet: "hiệu suất" }, { word: "効果", reading: "こうか", meaningVi: "hiệu quả", hanViet: "hiệu quả" }] },
  { character: "率", meaningVi: "suất, tỷ lệ", onyomi: "リツ、ソツ", kunyomi: "ひき.いる", strokeCount: 11, level: 2, examples: [{ word: "効率", reading: "こうりつ", meaningVi: "hiệu suất", hanViet: "hiệu suất" }] },
  { character: "責", meaningVi: "trách", onyomi: "セキ", kunyomi: "せ.める", strokeCount: 11, level: 2, examples: [{ word: "責任", reading: "せきにん", meaningVi: "trách nhiệm", hanViet: "trách nhiệm" }] },
  { character: "任", meaningVi: "nhậm, nhiệm", onyomi: "ニン", kunyomi: "まか.せる", strokeCount: 6, level: 2, examples: [{ word: "責任", reading: "せきにん", meaningVi: "trách nhiệm", hanViet: "trách nhiệm" }, { word: "担任", reading: "たんにん", meaningVi: "phụ trách", hanViet: "đảm nhiệm" }] },
  { character: "交", meaningVi: "giao", onyomi: "コウ", kunyomi: "まじ.わる、ま.ぜる", strokeCount: 6, level: 3, examples: [{ word: "交渉", reading: "こうしょう", meaningVi: "đàm phán", hanViet: "giao thiệp" }] },
  { character: "渉", meaningVi: "thiệp, liên quan", onyomi: "ショウ", kunyomi: "わた.る", strokeCount: 11, level: 1, examples: [{ word: "交渉", reading: "こうしょう", meaningVi: "đàm phán", hanViet: "giao thiệp" }] },
  { character: "提", meaningVi: "đề, nêu", onyomi: "テイ", kunyomi: "さ.げる", strokeCount: 12, level: 2, examples: [{ word: "提案", reading: "ていあん", meaningVi: "đề xuất", hanViet: "đề án" }, { word: "提出", reading: "ていしゅつ", meaningVi: "nộp", hanViet: "đề xuất" }] },
  { character: "案", meaningVi: "án, phương án", onyomi: "アン", kunyomi: null, strokeCount: 10, level: 2, examples: [{ word: "提案", reading: "ていあん", meaningVi: "đề xuất", hanViet: "đề án" }, { word: "案内", reading: "あんない", meaningVi: "hướng dẫn", hanViet: "án nội" }] },
];

// ═══════════════════════════════════════════════════════════════════════
// Grammar Points (30 entries — BJT essential patterns)
// ═══════════════════════════════════════════════════════════════════════

const grammarPoints = [
  { pattern: "〜ている", meaningVi: "đang làm gì đó (trạng thái tiếp diễn)", jlptLevel: "N5", category: "動詞活用", details: [{ meaningVi: "Diễn tả hành động đang diễn ra hoặc trạng thái kết quả", explanation: "V-て + いる → trạng thái đang làm" }] },
  { pattern: "〜てもいいですか", meaningVi: "có được phép... không?", jlptLevel: "N5", category: "許可", details: [{ meaningVi: "Xin phép làm điều gì đó", explanation: "V-て + もいいですか → Tôi có thể...?" }] },
  { pattern: "〜なければならない", meaningVi: "phải, bắt buộc phải", jlptLevel: "N4", category: "義務", details: [{ meaningVi: "Diễn tả nghĩa vụ hoặc sự bắt buộc", explanation: "V-ない (bỏ い) + ければならない" }] },
  { pattern: "〜ことになる", meaningVi: "được quyết định rằng...", jlptLevel: "N3", category: "決定", details: [{ meaningVi: "Quyết định được đưa ra (không phải do mình)", explanation: "V辞書形 + ことになる → việc gì đó đã được quyết định" }] },
  { pattern: "〜ようにする", meaningVi: "cố gắng để...", jlptLevel: "N3", category: "努力", details: [{ meaningVi: "Cố gắng tạo thói quen hoặc đạt mục tiêu", explanation: "V辞書形/Vない + ようにする" }] },
  { pattern: "〜にとって", meaningVi: "đối với...", jlptLevel: "N3", category: "観点", details: [{ meaningVi: "Từ quan điểm của ai đó", explanation: "N + にとって → đối với N mà nói" }] },
  { pattern: "〜について", meaningVi: "về (vấn đề gì)", jlptLevel: "N3", category: "話題", details: [{ meaningVi: "Nêu chủ đề đang nói đến", explanation: "N + について → về N" }] },
  { pattern: "〜に対して", meaningVi: "đối với, ngược lại với", jlptLevel: "N3", category: "対比", details: [{ meaningVi: "Nêu đối tượng hoặc so sánh đối lập", explanation: "N + に対して → đối với N" }] },
  { pattern: "〜ていただけませんか", meaningVi: "bạn có thể... giúp tôi không?", jlptLevel: "N3", category: "敬語・依頼", details: [{ meaningVi: "Nhờ ai đó làm gì một cách lịch sự (kính ngữ)", explanation: "V-て + いただけませんか → xin hãy..." }] },
  { pattern: "〜させていただく", meaningVi: "xin phép được làm", jlptLevel: "N2", category: "敬語・謙譲", details: [{ meaningVi: "Khiêm nhường xin phép (thường dùng trong business)", explanation: "V-させて + いただく → tôi xin phép được..." }] },
  { pattern: "〜恐れ入りますが", meaningVi: "xin lỗi vì làm phiền nhưng", jlptLevel: "N2", category: "敬語・丁寧", details: [{ meaningVi: "Cụm mở đầu kính ngữ khi nhờ vả hoặc hỏi", explanation: "恐れ入りますが + 依頼/質問" }] },
  { pattern: "〜わけにはいかない", meaningVi: "không thể nào...", jlptLevel: "N2", category: "不可能", details: [{ meaningVi: "Không thể làm vì lý do đạo đức/xã hội", explanation: "V辞書形 + わけにはいかない" }] },
  { pattern: "〜ことはない", meaningVi: "không cần thiết phải...", jlptLevel: "N2", category: "不必要", details: [{ meaningVi: "Không cần phải lo lắng hay làm điều gì", explanation: "V辞書形 + ことはない → không cần phải V" }] },
  { pattern: "〜に伴い", meaningVi: "đi kèm với, cùng với", jlptLevel: "N2", category: "同時変化", details: [{ meaningVi: "Diễn tả sự thay đổi song song", explanation: "N + に伴い → khi N thay đổi thì..." }] },
  { pattern: "〜をもとに", meaningVi: "dựa trên, căn cứ vào", jlptLevel: "N2", category: "基準", details: [{ meaningVi: "Lấy cái gì đó làm cơ sở", explanation: "N + をもとに → dựa vào N" }] },
  { pattern: "〜に基づいて", meaningVi: "dựa trên, căn cứ theo", jlptLevel: "N2", category: "基準", details: [{ meaningVi: "Dựa trên quy tắc/dữ liệu chính thức", explanation: "N + に基づいて → căn cứ theo N" }] },
  { pattern: "〜たびに", meaningVi: "mỗi khi, mỗi lần", jlptLevel: "N2", category: "頻度", details: [{ meaningVi: "Mỗi khi sự kiện xảy ra thì kết quả cũng xảy ra", explanation: "V辞書形/N の + たびに" }] },
  { pattern: "〜次第", meaningVi: "tùy thuộc vào / ngay khi", jlptLevel: "N2", category: "条件", details: [{ meaningVi: "Tùy thuộc vào / ngay sau khi", explanation: "N + 次第 → tùy N; V-ます + 次第 → ngay khi V xong" }] },
  { pattern: "〜からこそ", meaningVi: "chính vì... nên", jlptLevel: "N2", category: "強調", details: [{ meaningVi: "Nhấn mạnh lý do", explanation: "V/A/N + からこそ → chính vì thế nên" }] },
  { pattern: "〜ものの", meaningVi: "tuy rằng, mặc dù", jlptLevel: "N2", category: "逆接", details: [{ meaningVi: "Nhượng bộ: tuy vậy nhưng thực tế khác", explanation: "V/A普通形 + ものの" }] },
  { pattern: "〜ばかりか", meaningVi: "không chỉ... mà còn", jlptLevel: "N2", category: "累加", details: [{ meaningVi: "Không chỉ A mà còn B (thường tiêu cực hoặc mạnh)", explanation: "N/V + ばかりか + さらに/も" }] },
  { pattern: "〜を踏まえて", meaningVi: "dựa trên, xem xét đến", jlptLevel: "N1", category: "基準", details: [{ meaningVi: "Xem xét kỹ trước khi hành động (business formal)", explanation: "N + を踏まえて → sau khi cân nhắc N" }] },
  { pattern: "〜に先立ち", meaningVi: "trước khi", jlptLevel: "N1", category: "時間", details: [{ meaningVi: "Trước sự kiện quan trọng (formal)", explanation: "N + に先立ち → trước khi N diễn ra" }] },
  { pattern: "〜をもって", meaningVi: "bằng, với (phương tiện formal)", jlptLevel: "N1", category: "手段", details: [{ meaningVi: "Sử dụng phương tiện/thời điểm (formal business)", explanation: "N + をもって → bằng N / kể từ N" }] },
  { pattern: "〜いかんによらず", meaningVi: "bất kể, không phụ thuộc vào", jlptLevel: "N1", category: "条件", details: [{ meaningVi: "Không phụ thuộc vào điều kiện nào", explanation: "N + のいかんによらず → bất kể N thế nào" }] },
  { pattern: "〜ないことには", meaningVi: "nếu không... thì không thể", jlptLevel: "N1", category: "条件", details: [{ meaningVi: "Điều kiện tiên quyết phải thực hiện", explanation: "V-ない + ことには → nếu không V thì..." }] },
  { pattern: "〜てこそ", meaningVi: "chỉ khi... mới...", jlptLevel: "N1", category: "強調", details: [{ meaningVi: "Chỉ khi làm điều đó mới đạt kết quả", explanation: "V-て + こそ → chỉ khi V mới..." }] },
  { pattern: "〜ずにはいられない", meaningVi: "không thể không...", jlptLevel: "N1", category: "感情", details: [{ meaningVi: "Không kiềm chế được, không thể không làm", explanation: "V-ない (bỏ ない) + ずにはいられない" }] },
  { pattern: "〜にほかならない", meaningVi: "không gì khác hơn là", jlptLevel: "N1", category: "断定", details: [{ meaningVi: "Khẳng định mạnh: chính xác là", explanation: "N/V + にほかならない → chính là" }] },
  { pattern: "〜べく", meaningVi: "để mà, với mục đích", jlptLevel: "N1", category: "目的", details: [{ meaningVi: "Với mục đích (formal, văn viết)", explanation: "V辞書形 + べく → để V" }] },
];

// ═══════════════════════════════════════════════════════════════════════
// Seed execution
// ═══════════════════════════════════════════════════════════════════════

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  console.log("Connected to database");

  try {
    await client.query("BEGIN");

    // ── 1. Example sentences ──
    console.log(`Seeding ${exampleSentences.length} example sentences...`);
    const exIds = {};
    for (const ex of exampleSentences) {
      const res = await client.query(
        `INSERT INTO content.example_sentence (japanese_text, reading, translation_vi, status, updated_at)
         VALUES ($1, $2, $3, 'active', now())
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [ex.japaneseText, ex.reading, ex.translationVi]
      );
      if (res.rows.length > 0) exIds[ex.key] = res.rows[0].id;
    }
    console.log(`  → Inserted ${Object.keys(exIds).length} example sentences`);

    // ── 2. Lexemes + senses ──
    console.log(`Seeding ${lexemes.length} lexemes...`);
    let lexCount = 0;
    for (const lex of lexemes) {
      // Check if already exists
      const existing = await client.query(
        `SELECT id FROM content.lexeme WHERE headword = $1 AND reading = $2 LIMIT 1`,
        [lex.headword, lex.reading]
      );
      if (existing.rows.length > 0) continue;

      const res = await client.query(
        `INSERT INTO content.lexeme (headword, reading, jlpt_level, short_meaning_vi, status, updated_at)
         VALUES ($1, $2, $3, $4, 'active', now())
         RETURNING id`,
        [lex.headword, lex.reading, lex.jlptLevel, lex.shortMeaningVi]
      );
      const lexemeId = res.rows[0].id;
      lexCount++;

      for (let i = 0; i < lex.senses.length; i++) {
        const sense = lex.senses[i];
        await client.query(
          `INSERT INTO content.lexeme_sense (lexeme_id, position, part_of_speech, meaning_vi)
           VALUES ($1, $2, $3, $4)`,
          [lexemeId, i, sense.pos, sense.meaningVi]
        );
      }
    }
    console.log(`  → Inserted ${lexCount} lexemes`);

    // ── 3. Kanji + examples ──
    console.log(`Seeding ${kanjiList.length} kanji...`);
    let kanjiCount = 0;
    for (const k of kanjiList) {
      const existing = await client.query(
        `SELECT id FROM content.kanji WHERE character = $1 LIMIT 1`,
        [k.character]
      );
      if (existing.rows.length > 0) continue;

      const res = await client.query(
        `INSERT INTO content.kanji (character, meaning_vi, onyomi, kunyomi, stroke_count, level, status, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'active', now())
         RETURNING id`,
        [k.character, k.meaningVi, k.onyomi, k.kunyomi, k.strokeCount, k.level]
      );
      const kanjiId = res.rows[0].id;
      kanjiCount++;

      for (let i = 0; i < (k.examples || []).length; i++) {
        const ex = k.examples[i];
        await client.query(
          `INSERT INTO content.kanji_example (kanji_id, position, word, reading, meaning_vi, han_viet)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [kanjiId, i, ex.word, ex.reading, ex.meaningVi, ex.hanViet]
        );
      }
    }
    console.log(`  → Inserted ${kanjiCount} kanji`);

    // ── 4. Grammar points + details ──
    console.log(`Seeding ${grammarPoints.length} grammar points...`);
    let grammarCount = 0;
    for (const gp of grammarPoints) {
      const existing = await client.query(
        `SELECT id FROM content.grammar_point WHERE pattern = $1 LIMIT 1`,
        [gp.pattern]
      );
      if (existing.rows.length > 0) continue;

      const res = await client.query(
        `INSERT INTO content.grammar_point (pattern, meaning_vi, jlpt_level, category, status, updated_at)
         VALUES ($1, $2, $3, $4, 'active', now())
         RETURNING id`,
        [gp.pattern, gp.meaningVi, gp.jlptLevel, gp.category]
      );
      const gpId = res.rows[0].id;
      grammarCount++;

      for (let i = 0; i < (gp.details || []).length; i++) {
        const d = gp.details[i];
        await client.query(
          `INSERT INTO content.grammar_point_detail (grammar_point_id, position, meaning_vi, explanation)
           VALUES ($1, $2, $3, $4)`,
          [gpId, i, d.meaningVi, d.explanation]
        );
      }
    }
    console.log(`  → Inserted ${grammarCount} grammar points`);

    await client.query("COMMIT");

    // ── Summary ──
    const counts = await client.query(`
      SELECT
        (SELECT count(*) FROM content.lexeme) AS lexemes,
        (SELECT count(*) FROM content.kanji) AS kanji,
        (SELECT count(*) FROM content.grammar_point) AS grammar,
        (SELECT count(*) FROM content.example_sentence) AS examples
    `);
    const c = counts.rows[0];
    console.log(`\n✅ Content seeded successfully!`);
    console.log(`   Lexemes: ${c.lexemes}, Kanji: ${c.kanji}, Grammar: ${c.grammar}, Examples: ${c.examples}`);
    console.log(`\n💡 Run search rebuild to sync Meilisearch: curl -X PATCH http://localhost:4000/api/admin/operations/search-rebuild`);

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Seed failed:", err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
