/**
 * Seed expansion: additional vocabulary, kanji, grammar with examples.
 * Production-quality Japanese content for BJT/business + daily life.
 *
 * Run:  node scripts/seed-content-expansion.mjs
 *
 * Idempotent — safe to run multiple times.
 */

import pg from "pg";
const { Client } = pg;

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:15432/nihongo_bjt";

// ═══════════════════════════════════════════════════════════════════════
// Example Sentences (BJT business scenarios + keigo + daily)
// ═══════════════════════════════════════════════════════════════════════

const exampleSentences = [
  { key: "exb-001", japaneseText: "弊社の新製品をご紹介させていただきます。", reading: "へいしゃのしんせいひんをごしょうかいさせていただきます。", translationVi: "Cho phép tôi giới thiệu sản phẩm mới của công ty chúng tôi." },
  { key: "exb-002", japaneseText: "ご多忙のところ恐縮ですが、ご確認をお願いいたします。", reading: "ごたぼうのところきょうしゅくですが、ごかくにんをおねがいいたします。", translationVi: "Xin lỗi vì làm phiền khi quý vị đang bận, nhưng xin hãy xác nhận giúp." },
  { key: "exb-003", japaneseText: "来期の事業計画について議論したいと思います。", reading: "らいきのじぎょうけいかくについてぎろんしたいとおもいます。", translationVi: "Tôi muốn thảo luận về kế hoạch kinh doanh kỳ tới." },
  { key: "exb-004", japaneseText: "先方から見積書が届きましたので、ご査収ください。", reading: "せんぽうからみつもりしょがとどきましたので、ごさしゅうください。", translationVi: "Báo giá từ phía đối tác đã đến, xin hãy kiểm tra và nhận." },
  { key: "exb-005", japaneseText: "製造コストを削減するため、工程を見直しました。", reading: "せいぞうこすとをさくげんするため、こうていをみなおしました。", translationVi: "Để cắt giảm chi phí sản xuất, chúng tôi đã xem xét lại quy trình." },
  { key: "exb-006", japaneseText: "人事異動の内示がありましたのでお知らせします。", reading: "じんじいどうのないじがありましたのでおしらせします。", translationVi: "Có thông báo nội bộ về thay đổi nhân sự, xin thông báo đến quý vị." },
  { key: "exb-007", japaneseText: "市場調査の結果をもとに戦略を立てましょう。", reading: "しじょうちょうさのけっかをもとにせんりゃくをたてましょう。", translationVi: "Hãy xây dựng chiến lược dựa trên kết quả khảo sát thị trường." },
  { key: "exb-008", japaneseText: "品質管理の基準を満たしていないため、出荷を見合わせます。", reading: "ひんしつかんりのきじゅんをみたしていないため、しゅっかをみあわせます。", translationVi: "Vì chưa đạt tiêu chuẩn quản lý chất lượng nên tạm hoãn xuất hàng." },
  { key: "exb-009", japaneseText: "ご不便をおかけして申し訳ございません。", reading: "ごふべんをおかけしてもうしわけございません。", translationVi: "Rất xin lỗi vì đã gây bất tiện cho quý khách." },
  { key: "exb-010", japaneseText: "株主総会の議事録を作成しました。", reading: "かぶぬしそうかいのぎじろくをさくせいしました。", translationVi: "Tôi đã soạn biên bản cuộc họp cổ đông." },
  { key: "exb-011", japaneseText: "研修プログラムの参加者を募集しています。", reading: "けんしゅうぷろぐらむのさんかしゃをぼしゅうしています。", translationVi: "Chúng tôi đang tuyển người tham gia chương trình đào tạo." },
  { key: "exb-012", japaneseText: "この案件は至急対応が必要です。", reading: "このあんけんはしきゅうたいおうがひつようです。", translationVi: "Vụ việc này cần xử lý gấp." },
  { key: "exb-013", japaneseText: "顧客満足度の向上に努めてまいります。", reading: "こきゃくまんぞくどのこうじょうにつとめてまいります。", translationVi: "Chúng tôi sẽ nỗ lực nâng cao mức độ hài lòng của khách hàng." },
  { key: "exb-014", japaneseText: "今回の不具合については早急に原因を究明いたします。", reading: "こんかいのふぐあいについてはそうきゅうにげんいんをきゅうめいいたします。", translationVi: "Về sự cố lần này, chúng tôi sẽ khẩn trương tìm nguyên nhân." },
  { key: "exb-015", japaneseText: "御社のご要望に沿えるよう最善を尽くします。", reading: "おんしゃのごようぼうにそえるようさいぜんをつくします。", translationVi: "Chúng tôi sẽ cố gắng hết sức để đáp ứng yêu cầu của quý công ty." },
  { key: "exb-016", japaneseText: "引き続きよろしくお願いいたします。", reading: "ひきつづきよろしくおねがいいたします。", translationVi: "Xin tiếp tục giúp đỡ." },
  { key: "exb-017", japaneseText: "先日はお時間をいただきありがとうございました。", reading: "せんじつはおじかんをいただきありがとうございました。", translationVi: "Cảm ơn vì đã dành thời gian hôm trước." },
  { key: "exb-018", japaneseText: "急なお願いで恐れ入りますが、明日までにご回答いただけますか。", reading: "きゅうなおねがいでおそれいりますが、あしたまでにごかいとういただけますか。", translationVi: "Xin lỗi vì yêu cầu đột ngột, nhưng bạn có thể trả lời trước ngày mai không?" },
  { key: "exb-019", japaneseText: "取締役会で承認されましたので、実行に移します。", reading: "とりしまりやくかいでしょうにんされましたので、じっこうにうつします。", translationVi: "Đã được hội đồng quản trị phê duyệt, chúng tôi sẽ tiến hành thực hiện." },
  { key: "exb-020", japaneseText: "来月から新しい福利厚生制度を導入します。", reading: "らいげつからあたらしいふくりこうせいせいどをどうにゅうします。", translationVi: "Từ tháng sau sẽ áp dụng chế độ phúc lợi mới." },
];

// ═══════════════════════════════════════════════════════════════════════
// Lexemes — BJT business expansion + N3-N1 vocabulary
// ═══════════════════════════════════════════════════════════════════════

const lexemes = [
  // ── BJT Business Core ──
  { headword: "弊社", reading: "へいしゃ", jlptLevel: "N2", shortMeaningVi: "công ty chúng tôi (khiêm nhường)", senses: [{ pos: "danh từ", meaningVi: "công ty chúng tôi (cách nói khiêm nhường)" }] },
  { headword: "御社", reading: "おんしゃ", jlptLevel: "N2", shortMeaningVi: "quý công ty (kính ngữ)", senses: [{ pos: "danh từ", meaningVi: "quý công ty (kính ngữ, dùng khi nói)" }] },
  { headword: "貴社", reading: "きしゃ", jlptLevel: "N2", shortMeaningVi: "quý công ty (văn viết)", senses: [{ pos: "danh từ", meaningVi: "quý công ty (kính ngữ, dùng trong văn viết)" }] },
  { headword: "製品", reading: "せいひん", jlptLevel: "N2", shortMeaningVi: "sản phẩm", senses: [{ pos: "danh từ", meaningVi: "sản phẩm, hàng hóa sản xuất" }] },
  { headword: "製造", reading: "せいぞう", jlptLevel: "N2", shortMeaningVi: "sản xuất", senses: [{ pos: "danh từ", meaningVi: "sản xuất, chế tạo" }, { pos: "động từ する", meaningVi: "sản xuất, chế tạo" }] },
  { headword: "品質", reading: "ひんしつ", jlptLevel: "N2", shortMeaningVi: "chất lượng", senses: [{ pos: "danh từ", meaningVi: "chất lượng (sản phẩm, dịch vụ)" }] },
  { headword: "削減", reading: "さくげん", jlptLevel: "N1", shortMeaningVi: "cắt giảm", senses: [{ pos: "danh từ", meaningVi: "sự cắt giảm" }, { pos: "động từ する", meaningVi: "cắt giảm, giảm bớt" }] },
  { headword: "顧客", reading: "こきゃく", jlptLevel: "N1", shortMeaningVi: "khách hàng", senses: [{ pos: "danh từ", meaningVi: "khách hàng (formal)" }] },
  { headword: "人事", reading: "じんじ", jlptLevel: "N2", shortMeaningVi: "nhân sự", senses: [{ pos: "danh từ", meaningVi: "nhân sự, công việc nhân sự" }] },
  { headword: "研修", reading: "けんしゅう", jlptLevel: "N2", shortMeaningVi: "đào tạo", senses: [{ pos: "danh từ", meaningVi: "đào tạo, tập huấn" }, { pos: "động từ する", meaningVi: "tham gia đào tạo" }] },
  { headword: "募集", reading: "ぼしゅう", jlptLevel: "N2", shortMeaningVi: "tuyển dụng", senses: [{ pos: "danh từ", meaningVi: "tuyển dụng, chiêu mộ" }, { pos: "động từ する", meaningVi: "tuyển dụng, chiêu mộ" }] },
  { headword: "承認", reading: "しょうにん", jlptLevel: "N1", shortMeaningVi: "phê duyệt", senses: [{ pos: "danh từ", meaningVi: "sự phê duyệt, chấp thuận" }, { pos: "động từ する", meaningVi: "phê duyệt, chấp thuận" }] },
  { headword: "議事録", reading: "ぎじろく", jlptLevel: "N1", shortMeaningVi: "biên bản họp", senses: [{ pos: "danh từ", meaningVi: "biên bản cuộc họp, hội nghị" }] },
  { headword: "株主", reading: "かぶぬし", jlptLevel: "N1", shortMeaningVi: "cổ đông", senses: [{ pos: "danh từ", meaningVi: "cổ đông, người nắm cổ phiếu" }] },
  { headword: "取締役", reading: "とりしまりやく", jlptLevel: "N1", shortMeaningVi: "giám đốc điều hành", senses: [{ pos: "danh từ", meaningVi: "thành viên hội đồng quản trị, giám đốc điều hành" }] },
  { headword: "福利厚生", reading: "ふくりこうせい", jlptLevel: "N1", shortMeaningVi: "phúc lợi", senses: [{ pos: "danh từ", meaningVi: "phúc lợi (cho nhân viên)" }] },

  // ── Business Communication ──
  { headword: "確認", reading: "かくにん", jlptLevel: "N3", shortMeaningVi: "xác nhận", senses: [{ pos: "danh từ", meaningVi: "sự xác nhận, kiểm tra" }, { pos: "động từ する", meaningVi: "xác nhận, kiểm tra" }] },
  { headword: "対応", reading: "たいおう", jlptLevel: "N2", shortMeaningVi: "xử lý, đối ứng", senses: [{ pos: "danh từ", meaningVi: "sự xử lý, đối ứng" }, { pos: "động từ する", meaningVi: "xử lý, đối ứng, ứng phó" }] },
  { headword: "調査", reading: "ちょうさ", jlptLevel: "N2", shortMeaningVi: "điều tra", senses: [{ pos: "danh từ", meaningVi: "điều tra, khảo sát" }, { pos: "動từ する", meaningVi: "điều tra, nghiên cứu" }] },
  { headword: "導入", reading: "どうにゅう", jlptLevel: "N2", shortMeaningVi: "đưa vào, áp dụng", senses: [{ pos: "danh từ", meaningVi: "sự đưa vào, áp dụng (hệ thống/chế độ mới)" }, { pos: "動từ する", meaningVi: "đưa vào, áp dụng" }] },
  { headword: "実績", reading: "じっせき", jlptLevel: "N1", shortMeaningVi: "thành tích", senses: [{ pos: "danh từ", meaningVi: "thành tích, kết quả thực tế" }] },
  { headword: "方針", reading: "ほうしん", jlptLevel: "N2", shortMeaningVi: "phương châm", senses: [{ pos: "danh từ", meaningVi: "phương châm, chính sách, đường lối" }] },
  { headword: "促進", reading: "そくしん", jlptLevel: "N1", shortMeaningVi: "thúc đẩy", senses: [{ pos: "danh từ", meaningVi: "sự thúc đẩy, xúc tiến" }, { pos: "動từ する", meaningVi: "thúc đẩy, xúc tiến" }] },
  { headword: "査収", reading: "さしゅう", jlptLevel: "N1", shortMeaningVi: "kiểm tra và nhận", senses: [{ pos: "danh từ", meaningVi: "kiểm tra và nhận (business formal)" }] },
  { headword: "至急", reading: "しきゅう", jlptLevel: "N2", shortMeaningVi: "gấp, khẩn cấp", senses: [{ pos: "phó từ", meaningVi: "gấp, khẩn cấp, ngay lập tức" }] },
  { headword: "議論", reading: "ぎろん", jlptLevel: "N2", shortMeaningVi: "thảo luận", senses: [{ pos: "danh từ", meaningVi: "thảo luận, tranh luận" }, { pos: "動từ する", meaningVi: "thảo luận, bàn bạc" }] },
  { headword: "工程", reading: "こうてい", jlptLevel: "N2", shortMeaningVi: "quy trình", senses: [{ pos: "danh từ", meaningVi: "quy trình sản xuất, công đoạn" }] },
  { headword: "内示", reading: "ないじ", jlptLevel: "N1", shortMeaningVi: "thông báo nội bộ", senses: [{ pos: "danh từ", meaningVi: "thông báo nội bộ (trước công bố chính thức)" }] },
  { headword: "見直す", reading: "みなおす", jlptLevel: "N2", shortMeaningVi: "xem xét lại", senses: [{ pos: "動từ", meaningVi: "xem xét lại, đánh giá lại" }] },
  { headword: "究明", reading: "きゅうめい", jlptLevel: "N1", shortMeaningVi: "tìm ra nguyên nhân", senses: [{ pos: "danh từ", meaningVi: "sự tìm hiểu rõ nguyên nhân" }, { pos: "動từ する", meaningVi: "tìm hiểu rõ, làm sáng tỏ" }] },

  // ── Workplace Daily ──
  { headword: "給料", reading: "きゅうりょう", jlptLevel: "N3", shortMeaningVi: "lương", senses: [{ pos: "danh từ", meaningVi: "lương, tiền lương" }] },
  { headword: "昇進", reading: "しょうしん", jlptLevel: "N2", shortMeaningVi: "thăng chức", senses: [{ pos: "danh từ", meaningVi: "sự thăng chức, thăng tiến" }, { pos: "動từ する", meaningVi: "được thăng chức" }] },
  { headword: "退職", reading: "たいしょく", jlptLevel: "N2", shortMeaningVi: "nghỉ việc", senses: [{ pos: "danh từ", meaningVi: "nghỉ việc, từ chức" }, { pos: "動từ する", meaningVi: "nghỉ việc, từ chức" }] },
  { headword: "有給", reading: "ゆうきゅう", jlptLevel: "N2", shortMeaningVi: "nghỉ phép có lương", senses: [{ pos: "danh từ", meaningVi: "nghỉ phép có lương" }] },
  { headword: "通勤", reading: "つうきん", jlptLevel: "N2", shortMeaningVi: "đi làm", senses: [{ pos: "danh từ", meaningVi: "việc đi lại giữa nhà và công ty" }, { pos: "動từ する", meaningVi: "đi làm (hàng ngày)" }] },
];

// ═══════════════════════════════════════════════════════════════════════
// Kanji — Business/N2-N1 expansion with accurate data
// ═══════════════════════════════════════════════════════════════════════

const kanjiList = [
  { character: "製", meaningVi: "chế tạo", onyomi: "セイ", kunyomi: null, strokeCount: 14, level: 2, examples: [{ word: "製品", reading: "せいひん", meaningVi: "sản phẩm", hanViet: "chế phẩm" }, { word: "製造", reading: "せいぞう", meaningVi: "sản xuất", hanViet: "chế tạo" }] },
  { character: "品", meaningVi: "phẩm, sản phẩm", onyomi: "ヒン", kunyomi: "しな", strokeCount: 9, level: 3, examples: [{ word: "製品", reading: "せいひん", meaningVi: "sản phẩm", hanViet: "chế phẩm" }, { word: "品質", reading: "ひんしつ", meaningVi: "chất lượng", hanViet: "phẩm chất" }] },
  { character: "質", meaningVi: "chất", onyomi: "シツ、シチ", kunyomi: null, strokeCount: 15, level: 3, examples: [{ word: "品質", reading: "ひんしつ", meaningVi: "chất lượng", hanViet: "phẩm chất" }, { word: "質問", reading: "しつもん", meaningVi: "câu hỏi", hanViet: "chất vấn" }] },
  { character: "減", meaningVi: "giảm", onyomi: "ゲン", kunyomi: "へ.る、へ.らす", strokeCount: 12, level: 2, examples: [{ word: "削減", reading: "さくげん", meaningVi: "cắt giảm", hanViet: "tước giảm" }, { word: "減少", reading: "げんしょう", meaningVi: "giảm thiểu", hanViet: "giảm thiểu" }] },
  { character: "削", meaningVi: "tước, gọt", onyomi: "サク", kunyomi: "けず.る", strokeCount: 9, level: 2, examples: [{ word: "削減", reading: "さくげん", meaningVi: "cắt giảm", hanViet: "tước giảm" }, { word: "削除", reading: "さくじょ", meaningVi: "xóa bỏ", hanViet: "tước trừ" }] },
  { character: "顧", meaningVi: "cố, ngoảnh lại", onyomi: "コ", kunyomi: "かえり.みる", strokeCount: 21, level: 1, examples: [{ word: "顧客", reading: "こきゃく", meaningVi: "khách hàng", hanViet: "cố khách" }, { word: "顧問", reading: "こもん", meaningVi: "cố vấn", hanViet: "cố vấn" }] },
  { character: "客", meaningVi: "khách", onyomi: "キャク、カク", kunyomi: null, strokeCount: 9, level: 3, examples: [{ word: "顧客", reading: "こきゃく", meaningVi: "khách hàng", hanViet: "cố khách" }, { word: "客様", reading: "きゃくさま", meaningVi: "quý khách", hanViet: "khách" }] },
  { character: "認", meaningVi: "nhận, thừa nhận", onyomi: "ニン", kunyomi: "みと.める", strokeCount: 14, level: 2, examples: [{ word: "確認", reading: "かくにん", meaningVi: "xác nhận", hanViet: "xác nhận" }, { word: "承認", reading: "しょうにん", meaningVi: "phê duyệt", hanViet: "thừa nhận" }] },
  { character: "確", meaningVi: "xác, chắc chắn", onyomi: "カク", kunyomi: "たし.か、たし.かめる", strokeCount: 15, level: 2, examples: [{ word: "確認", reading: "かくにん", meaningVi: "xác nhận", hanViet: "xác nhận" }, { word: "正確", reading: "せいかく", meaningVi: "chính xác", hanViet: "chính xác" }] },
  { character: "導", meaningVi: "dẫn", onyomi: "ドウ", kunyomi: "みちび.く", strokeCount: 15, level: 2, examples: [{ word: "導入", reading: "どうにゅう", meaningVi: "đưa vào", hanViet: "dẫn nhập" }, { word: "指導", reading: "しどう", meaningVi: "hướng dẫn", hanViet: "chỉ đạo" }] },
  { character: "調", meaningVi: "điều", onyomi: "チョウ", kunyomi: "しら.べる、ととの.える", strokeCount: 15, level: 3, examples: [{ word: "調査", reading: "ちょうさ", meaningVi: "điều tra", hanViet: "điều tra" }, { word: "調整", reading: "ちょうせい", meaningVi: "điều chỉnh", hanViet: "điều chỉnh" }] },
  { character: "査", meaningVi: "tra, xét", onyomi: "サ", kunyomi: null, strokeCount: 9, level: 2, examples: [{ word: "調査", reading: "ちょうさ", meaningVi: "điều tra", hanViet: "điều tra" }, { word: "検査", reading: "けんさ", meaningVi: "kiểm tra", hanViet: "kiểm tra" }] },
  { character: "績", meaningVi: "tích, thành tích", onyomi: "セキ", kunyomi: null, strokeCount: 17, level: 2, examples: [{ word: "実績", reading: "じっせき", meaningVi: "thành tích", hanViet: "thực tích" }, { word: "成績", reading: "せいせき", meaningVi: "thành tích học tập", hanViet: "thành tích" }] },
  { character: "針", meaningVi: "châm, kim", onyomi: "シン", kunyomi: "はり", strokeCount: 10, level: 2, examples: [{ word: "方針", reading: "ほうしん", meaningVi: "phương châm", hanViet: "phương châm" }] },
  { character: "促", meaningVi: "thúc, xúc tiến", onyomi: "ソク", kunyomi: "うなが.す", strokeCount: 9, level: 1, examples: [{ word: "促進", reading: "そくしん", meaningVi: "thúc đẩy", hanViet: "xúc tiến" }] },
  { character: "進", meaningVi: "tiến", onyomi: "シン", kunyomi: "すす.む、すす.める", strokeCount: 11, level: 3, examples: [{ word: "促進", reading: "そくしん", meaningVi: "thúc đẩy", hanViet: "xúc tiến" }, { word: "昇進", reading: "しょうしん", meaningVi: "thăng chức", hanViet: "thăng tiến" }] },
  { character: "給", meaningVi: "cấp, cho", onyomi: "キュウ", kunyomi: null, strokeCount: 12, level: 3, examples: [{ word: "給料", reading: "きゅうりょう", meaningVi: "lương", hanViet: "cấp liệu" }, { word: "有給", reading: "ゆうきゅう", meaningVi: "có lương", hanViet: "hữu cấp" }] },
  { character: "退", meaningVi: "thối, lùi", onyomi: "タイ", kunyomi: "しりぞ.く、しりぞ.ける", strokeCount: 9, level: 2, examples: [{ word: "退職", reading: "たいしょく", meaningVi: "nghỉ việc", hanViet: "thối chức" }, { word: "退院", reading: "たいいん", meaningVi: "xuất viện", hanViet: "thối viện" }] },
  { character: "職", meaningVi: "chức", onyomi: "ショク", kunyomi: null, strokeCount: 18, level: 2, examples: [{ word: "退職", reading: "たいしょく", meaningVi: "nghỉ việc", hanViet: "thối chức" }, { word: "職場", reading: "しょくば", meaningVi: "nơi làm việc", hanViet: "chức trường" }] },
  { character: "勤", meaningVi: "cần, siêng năng", onyomi: "キン、ゴン", kunyomi: "つと.める", strokeCount: 12, level: 2, examples: [{ word: "通勤", reading: "つうきん", meaningVi: "đi làm", hanViet: "thông cần" }, { word: "勤務", reading: "きんむ", meaningVi: "làm việc", hanViet: "cần vụ" }] },
];

// ═══════════════════════════════════════════════════════════════════════
// Grammar Points — BJT keigo + business-critical patterns
// ═══════════════════════════════════════════════════════════════════════

const grammarPoints = [
  { pattern: "〜いたします", meaningVi: "tôi xin làm (khiêm nhường)", jlptLevel: "N3", category: "敬語・謙譲", details: [{ meaningVi: "Dạng khiêm nhường của する, dùng để hạ mình khi nói về hành động của bản thân", explanation: "お/ご + Vます + いたします hoặc いたす thay cho する" }] },
  { pattern: "〜ていただく", meaningVi: "được ai đó làm cho (kính ngữ)", jlptLevel: "N3", category: "敬語・尊敬", details: [{ meaningVi: "Nhận hành động từ người khác, dùng để tôn kính người đó", explanation: "V-て + いただく (kính ngữ của てもらう)" }] },
  { pattern: "〜おっしゃる", meaningVi: "nói (kính ngữ của 言う)", jlptLevel: "N3", category: "敬語・尊敬", details: [{ meaningVi: "Kính ngữ của 言う, dùng khi nói về hành động của người trên", explanation: "先生がおっしゃったように → Như thầy/cô đã nói" }] },
  { pattern: "〜ご覧になる", meaningVi: "xem (kính ngữ của 見る)", jlptLevel: "N3", category: "敬語・尊敬", details: [{ meaningVi: "Kính ngữ của 見る, dùng khi mời cấp trên xem", explanation: "こちらをご覧ください → Xin hãy xem đây" }] },
  { pattern: "〜かねます", meaningVi: "khó có thể, không thể (từ chối lịch sự)", jlptLevel: "N2", category: "敬語・丁寧", details: [{ meaningVi: "Từ chối lịch sự trong business, diễn tả rằng mình muốn nhưng không thể", explanation: "V-ます (bỏ ます) + かねます → rất tiếc nhưng không thể" }] },
  { pattern: "〜ざるを得ない", meaningVi: "không thể không, buộc phải", jlptLevel: "N2", category: "義務", details: [{ meaningVi: "Bị bắt buộc phải làm dù không muốn", explanation: "V-ない (bỏ ない) + ざるを得ない (する→せざるを得ない)" }] },
  { pattern: "〜に応じて", meaningVi: "tùy theo, phù hợp với", jlptLevel: "N2", category: "対応", details: [{ meaningVi: "Thay đổi/điều chỉnh phù hợp với điều kiện", explanation: "N + に応じて → tùy theo N mà điều chỉnh" }] },
  { pattern: "〜つつある", meaningVi: "đang dần, đang trong quá trình", jlptLevel: "N2", category: "変化", details: [{ meaningVi: "Diễn tả sự thay đổi đang diễn ra từ từ", explanation: "V-ます (bỏ ます) + つつある → đang dần V" }] },
  { pattern: "〜上で", meaningVi: "khi, trong việc; sau khi", jlptLevel: "N2", category: "条件", details: [{ meaningVi: "Trong quá trình làm gì / Sau khi đã làm xong thì", explanation: "V辞書形/Vた + 上で → khi V / sau khi V" }] },
  { pattern: "〜を通じて", meaningVi: "thông qua, suốt", jlptLevel: "N2", category: "手段", details: [{ meaningVi: "Thông qua phương tiện/kênh nào đó, hoặc suốt khoảng thời gian", explanation: "N + を通じて → thông qua N / suốt N" }] },
  { pattern: "〜にわたって", meaningVi: "trải dài, kéo dài suốt", jlptLevel: "N2", category: "範囲", details: [{ meaningVi: "Kéo dài suốt một phạm vi thời gian hoặc không gian rộng", explanation: "N + にわたって → kéo dài suốt N" }] },
  { pattern: "〜に沿って", meaningVi: "theo, dọc theo", jlptLevel: "N2", category: "基準", details: [{ meaningVi: "Làm theo kế hoạch/phương châm/đường lối đã đề ra", explanation: "N + に沿って → theo N (kế hoạch, phương châm)" }] },
  { pattern: "〜をはじめ", meaningVi: "bắt đầu từ, tiêu biểu là", jlptLevel: "N2", category: "例示", details: [{ meaningVi: "Nêu ví dụ tiêu biểu nhất rồi mở rộng", explanation: "N + をはじめ(として) → tiêu biểu là N và..." }] },
  { pattern: "〜に限り", meaningVi: "chỉ giới hạn ở", jlptLevel: "N2", category: "限定", details: [{ meaningVi: "Chỉ áp dụng/cho phép trong phạm vi giới hạn", explanation: "N + に限り → chỉ N mới được" }] },
  { pattern: "〜末", meaningVi: "sau khi (trải qua khó khăn)", jlptLevel: "N1", category: "結果", details: [{ meaningVi: "Sau một quá trình nỗ lực/khó khăn cuối cùng đạt được kết quả", explanation: "Vた/N の + 末(に) → sau quá trình V, cuối cùng..." }] },
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
    let exCount = 0;
    for (const ex of exampleSentences) {
      const res = await client.query(
        `INSERT INTO content.example_sentence (japanese_text, reading, translation_vi, status, updated_at)
         VALUES ($1, $2, $3, 'active', now())
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [ex.japaneseText, ex.reading, ex.translationVi]
      );
      if (res.rows.length > 0) exCount++;
    }
    console.log(`  → Inserted ${exCount} example sentences`);

    // ── 2. Lexemes + senses ──
    console.log(`Seeding ${lexemes.length} lexemes...`);
    let lexCount = 0;
    for (const lex of lexemes) {
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
    console.log(`\n✅ Content expansion seeded successfully!`);
    console.log(`   Total — Lexemes: ${c.lexemes}, Kanji: ${c.kanji}, Grammar: ${c.grammar}, Examples: ${c.examples}`);

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Seed failed:", err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
