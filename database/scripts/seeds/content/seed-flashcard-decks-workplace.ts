/**
 * Seed 10 public flashcard decks — workplace/office Japanese (BJT-focused).
 * Idempotent: uses upsert on deck title + no owner (public system decks).
 *
 * Topics:
 * 1. 自己紹介・挨拶 (Self-introduction & Greetings)
 * 2. 電話対応 (Phone etiquette)
 * 3. メール・ビジネス文書 (Business email/documents)
 * 4. 会議・プレゼン (Meetings & Presentations)
 * 5. 報連相 (Report/Contact/Consult)
 * 6. 敬語・丁寧語 (Keigo & Polite expressions)
 * 7. 人事・福利厚生 (HR & Benefits)
 * 8. 営業・商談 (Sales & Negotiation)
 * 9. IT・テクノロジー (IT & Technology workplace)
 * 10. 職場マナー・人間関係 (Workplace manners & Relations)
 *
 * Run: pnpm exec tsx database/scripts/seeds/content/seed-flashcard-decks-workplace.ts
 */
import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../../.env") });

import { createPrismaClient } from "../../../../packages/database/src/index.js";

const prisma = createPrismaClient();

interface CardData {
  front: string;
  back: string;
  reading?: string;
}

interface DeckData {
  titleVi: string;
  titleJa: string;
  descriptionVi: string;
  descriptionJa: string;
  cards: CardData[];
}

const DECKS: DeckData[] = [
  // ─── 1. Self-introduction & Greetings ────────────────────
  {
    titleVi: "Tự giới thiệu & Chào hỏi nơi công sở",
    titleJa: "自己紹介・職場の挨拶",
    descriptionVi: "Các mẫu câu chào hỏi, tự giới thiệu bản thân trong môi trường làm việc Nhật Bản",
    descriptionJa: "職場での自己紹介と基本的な挨拶表現",
    cards: [
      { front: "初めまして、〇〇と申します。", back: "Xin chào, tôi là ○○. (Lần đầu gặp mặt)", reading: "はじめまして、○○ともうします。" },
      { front: "本日からお世話になります。", back: "Từ hôm nay xin được nhờ vả mọi người. (Ngày đầu đi làm)", reading: "ほんじつからおせわになります。" },
      { front: "よろしくお願いいたします。", back: "Rất mong được chỉ giáo. (Câu kết khi giới thiệu)", reading: "よろしくおねがいいたします。" },
      { front: "お疲れ様です。", back: "Chào anh/chị (lời chào đồng nghiệp trong ngày)", reading: "おつかれさまです。" },
      { front: "お先に失礼します。", back: "Tôi xin phép về trước.", reading: "おさきにしつれいします。" },
      { front: "出身はベトナムです。", back: "Tôi đến từ Việt Nam.", reading: "しゅっしんはベトナムです。" },
      { front: "前職では営業を担当しておりました。", back: "Ở công ty trước tôi phụ trách mảng kinh doanh.", reading: "ぜんしょくではえいぎょうをたんとうしておりました。" },
      { front: "趣味は読書とジョギングです。", back: "Sở thích của tôi là đọc sách và chạy bộ.", reading: "しゅみはどくしょとジョギングです。" },
      { front: "ご指導のほど、よろしくお願いします。", back: "Xin hãy chỉ bảo cho tôi.", reading: "ごしどうのほど、よろしくおねがいします。" },
      { front: "何かございましたらお気軽にどうぞ。", back: "Nếu có gì xin cứ thoải mái liên hệ.", reading: "なにかございましたらおきがるにどうぞ。" },
      { front: "おはようございます。", back: "Chào buổi sáng. (Dùng ở công sở)", reading: "おはようございます。" },
      { front: "お世話になっております。", back: "Cảm ơn sự quan tâm của anh/chị. (Lời mở đầu email/điện thoại)", reading: "おせわになっております。" },
    ]
  },

  // ─── 2. Phone Etiquette ──────────────────────────────────
  {
    titleVi: "Ứng xử qua điện thoại công sở",
    titleJa: "電話対応の基本",
    descriptionVi: "Cách nghe/gọi điện thoại chuyên nghiệp trong môi trường doanh nghiệp Nhật",
    descriptionJa: "ビジネス電話の基本的な応対表現",
    cards: [
      { front: "お電話ありがとうございます。〇〇会社でございます。", back: "Cảm ơn quý khách đã gọi điện. Đây là công ty ○○.", reading: "おでんわありがとうございます。○○かいしゃでございます。" },
      { front: "少々お待ちください。", back: "Xin vui lòng chờ một chút.", reading: "しょうしょうおまちください。" },
      { front: "申し訳ございませんが、〇〇は只今席を外しております。", back: "Xin lỗi, ○○ hiện không có mặt tại chỗ.", reading: "もうしわけございませんが、○○はただいませきをはずしております。" },
      { front: "折り返しお電話いたしましょうか。", back: "Tôi gọi lại cho quý khách nhé?", reading: "おりかえしおでんわいたしましょうか。" },
      { front: "お伝えいただけますか。", back: "Anh/chị có thể nhắn lại giúp tôi được không?", reading: "おつたえいただけますか。" },
      { front: "恐れ入りますが、もう一度おっしゃっていただけますか。", back: "Xin lỗi, anh/chị có thể nói lại lần nữa không?", reading: "おそれいりますが、もういちどおっしゃっていただけますか。" },
      { front: "お電話番号をお願いできますか。", back: "Cho tôi xin số điện thoại được không ạ?", reading: "おでんわばんごうをおねがいできますか。" },
      { front: "確認いたします。", back: "Tôi xin xác nhận lại.", reading: "かくにんいたします。" },
      { front: "担当者に代わります。", back: "Tôi chuyển máy cho người phụ trách.", reading: "たんとうしゃにかわります。" },
      { front: "お忙しいところ恐れ入ります。", back: "Xin lỗi đã làm phiền lúc bận.", reading: "おいそがしいところおそれいります。" },
      { front: "失礼ですが、どちら様でしょうか。", back: "Xin lỗi, quý khách là ai ạ?", reading: "しつれいですが、どちらさまでしょうか。" },
      { front: "伝言をお願いしてもよろしいでしょうか。", back: "Tôi có thể nhờ nhắn lại được không?", reading: "でんごんをおねがいしてもよろしいでしょうか。" },
    ]
  },

  // ─── 3. Business Email & Documents ───────────────────────
  {
    titleVi: "Email & Văn bản công việc",
    titleJa: "ビジネスメール・文書",
    descriptionVi: "Từ vựng và mẫu câu thường dùng trong email, báo cáo, văn bản công việc",
    descriptionJa: "メールや報告書で使うビジネス表現",
    cards: [
      { front: "件名", back: "Tiêu đề (email)", reading: "けんめい" },
      { front: "添付ファイルをご確認ください。", back: "Xin hãy kiểm tra file đính kèm.", reading: "てんぷファイルをごかくにんください。" },
      { front: "ご査収のほどよろしくお願いいたします。", back: "Xin vui lòng kiểm nhận.", reading: "ごさしゅうのほどよろしくおねがいいたします。" },
      { front: "お忙しいところ恐縮ですが", back: "Biết rằng anh/chị đang bận, thật ngại nhưng...", reading: "おいそがしいところきょうしゅくですが" },
      { front: "ご検討いただければ幸いです。", back: "Rất vui nếu anh/chị cân nhắc giúp.", reading: "ごけんとういただければさいわいです。" },
      { front: "取り急ぎご連絡まで。", back: "Tạm thời liên lạc nhanh trước. (Kết email ngắn)", reading: "とりいそぎごれんらくまで。" },
      { front: "ご返信お待ちしております。", back: "Tôi đang chờ hồi âm của anh/chị.", reading: "ごへんしんおまちしております。" },
      { front: "議事録", back: "Biên bản họp", reading: "ぎじろく" },
      { front: "納期", back: "Thời hạn giao hàng / deadline", reading: "のうき" },
      { front: "報告書", back: "Báo cáo (văn bản)", reading: "ほうこくしょ" },
      { front: "ご確認のほど、よろしくお願い申し上げます。", back: "Kính mong anh/chị xác nhận giúp.", reading: "ごかくにんのほど、よろしくおねがいもうしあげます。" },
      { front: "下記の件についてご連絡いたします。", back: "Tôi xin liên lạc về vấn đề dưới đây.", reading: "かきのけんについてごれんらくいたします。" },
    ]
  },

  // ─── 4. Meetings & Presentations ─────────────────────────
  {
    titleVi: "Họp & Thuyết trình",
    titleJa: "会議・プレゼンテーション",
    descriptionVi: "Từ vựng và biểu đạt khi tham gia họp, thuyết trình trong công ty Nhật",
    descriptionJa: "会議やプレゼンで使う表現集",
    cards: [
      { front: "本日の議題は〜です。", back: "Chủ đề hôm nay là ~.", reading: "ほんじつのぎだいは〜です。" },
      { front: "資料をご覧ください。", back: "Xin hãy xem tài liệu.", reading: "しりょうをごらんください。" },
      { front: "ご質問はありますか。", back: "Có câu hỏi nào không ạ?", reading: "ごしつもんはありますか。" },
      { front: "結論から申し上げますと", back: "Nói kết luận trước thì...", reading: "けつろんからもうしあげますと" },
      { front: "前回の議事録を確認します。", back: "Tôi xin xác nhận biên bản lần trước.", reading: "ぜんかいのぎじろくをかくにんします。" },
      { front: "賛成です。", back: "Tôi đồng ý.", reading: "さんせいです。" },
      { front: "反対意見があります。", back: "Tôi có ý kiến phản đối.", reading: "はんたいいけんがあります。" },
      { front: "補足してもよろしいですか。", back: "Tôi bổ sung thêm được không ạ?", reading: "ほそくしてもよろしいですか。" },
      { front: "次のスライドをお願いします。", back: "Xin chuyển sang slide tiếp theo.", reading: "つぎのスライドをおねがいします。" },
      { front: "以上で発表を終わります。", back: "Trên đây là toàn bộ bài thuyết trình của tôi.", reading: "いじょうではっぴょうをおわります。" },
      { front: "アジェンダ", back: "Chương trình nghị sự (agenda)", reading: "アジェンダ" },
      { front: "今後の方針について話し合いましょう。", back: "Hãy thảo luận về phương hướng sắp tới.", reading: "こんごのほうしんについてはなしあいましょう。" },
    ]
  },

  // ─── 5. 報連相 (Report / Contact / Consult) ──────────────
  {
    titleVi: "Báo cáo - Liên lạc - Trao đổi (報連相)",
    titleJa: "報連相（ほうれんそう）",
    descriptionVi: "Kỹ năng 報連相 — nền tảng giao tiếp công sở Nhật Bản",
    descriptionJa: "社会人の基本スキル：報告・連絡・相談",
    cards: [
      { front: "報告", back: "Báo cáo (thông báo kết quả cho cấp trên)", reading: "ほうこく" },
      { front: "連絡", back: "Liên lạc (chia sẻ thông tin cần thiết)", reading: "れんらく" },
      { front: "相談", back: "Trao đổi / xin ý kiến (hỏi trước khi hành động)", reading: "そうだん" },
      { front: "進捗状況をご報告いたします。", back: "Tôi xin báo cáo tình hình tiến độ.", reading: "しんちょくじょうきょうをごほうこくいたします。" },
      { front: "問題が発生しましたのでご報告いたします。", back: "Có vấn đề phát sinh, xin phép báo cáo.", reading: "もんだいがはっせいしましたのでごほうこくいたします。" },
      { front: "ご相談したいことがあるのですが。", back: "Tôi có chuyện muốn trao đổi ạ.", reading: "ごそうだんしたいことがあるのですが。" },
      { front: "念のためご連絡いたします。", back: "Tôi liên lạc phòng trường hợp (để chắc chắn).", reading: "ねんのためごれんらくいたします。" },
      { front: "上司に確認してから折り返します。", back: "Tôi xác nhận với cấp trên rồi liên lạc lại.", reading: "じょうしにかくにんしてからおりかえします。" },
      { front: "期限に間に合わない可能性があります。", back: "Có khả năng không kịp deadline.", reading: "きげんにまにあわないかのうせいがあります。" },
      { front: "対応策を検討しております。", back: "Tôi đang xem xét phương án xử lý.", reading: "たいおうさくをけんとうしております。" },
      { front: "早めに報告することが大切です。", back: "Báo cáo sớm là điều quan trọng.", reading: "はやめにほうこくすることがたいせつです。" },
      { front: "悪い報告ほど早くすべきです。", back: "Tin xấu càng phải báo sớm.", reading: "わるいほうこくほどはやくすべきです。" },
    ]
  },

  // ─── 6. Keigo & Polite Expressions ───────────────────────
  {
    titleVi: "Kính ngữ trong công việc",
    titleJa: "ビジネス敬語",
    descriptionVi: "Keigo thiết yếu cho môi trường công sở: tôn kính ngữ, khiêm nhường ngữ, lịch sự ngữ",
    descriptionJa: "仕事で必須の敬語表現（尊敬語・謙譲語・丁寧語）",
    cards: [
      { front: "おっしゃる", back: "Nói (tôn kính ngữ của 言う)", reading: "おっしゃる" },
      { front: "申す / 申し上げる", back: "Nói (khiêm nhường ngữ của 言う)", reading: "もうす / もうしあげる" },
      { front: "いらっしゃる", back: "Có mặt / đến / ở (tôn kính ngữ của いる・行く・来る)", reading: "いらっしゃる" },
      { front: "参る", back: "Đi / đến (khiêm nhường ngữ của 行く・来る)", reading: "まいる" },
      { front: "ご覧になる", back: "Xem (tôn kính ngữ của 見る)", reading: "ごらんになる" },
      { front: "拝見する", back: "Xem (khiêm nhường ngữ của 見る)", reading: "はいけんする" },
      { front: "召し上がる", back: "Ăn / uống (tôn kính ngữ của 食べる・飲む)", reading: "めしあがる" },
      { front: "いただく", back: "Nhận / ăn (khiêm nhường ngữ của もらう・食べる)", reading: "いただく" },
      { front: "存じております", back: "Tôi biết (khiêm nhường ngữ của 知っている)", reading: "ぞんじております" },
      { front: "かしこまりました", back: "Tôi hiểu rồi ạ. (Lịch sự hơn わかりました)", reading: "かしこまりました" },
      { front: "差し支えなければ", back: "Nếu không phiền thì... (cách hỏi lịch sự)", reading: "さしつかえなければ" },
      { front: "恐れ入りますが", back: "Thật ngại nhưng... (mở đầu lịch sự khi nhờ vả)", reading: "おそれいりますが" },
    ]
  },

  // ─── 7. HR & Benefits ────────────────────────────────────
  {
    titleVi: "Nhân sự & Phúc lợi",
    titleJa: "人事・福利厚生",
    descriptionVi: "Từ vựng liên quan đến nhân sự, chế độ phúc lợi, lương thưởng trong công ty Nhật",
    descriptionJa: "人事制度や福利厚生に関する用語",
    cards: [
      { front: "有給休暇", back: "Nghỉ phép có lương", reading: "ゆうきゅうきゅうか" },
      { front: "残業", back: "Làm thêm giờ (overtime)", reading: "ざんぎょう" },
      { front: "昇進", back: "Thăng chức", reading: "しょうしん" },
      { front: "異動", back: "Chuyển bộ phận / điều chuyển", reading: "いどう" },
      { front: "賞与 / ボーナス", back: "Tiền thưởng (bonus)", reading: "しょうよ / ボーナス" },
      { front: "社会保険", back: "Bảo hiểm xã hội", reading: "しゃかいほけん" },
      { front: "退職届", back: "Đơn xin nghỉ việc", reading: "たいしょくとどけ" },
      { front: "試用期間", back: "Thời gian thử việc", reading: "しようきかん" },
      { front: "正社員", back: "Nhân viên chính thức (full-time)", reading: "せいしゃいん" },
      { front: "派遣社員", back: "Nhân viên phái cử (dispatch)", reading: "はけんしゃいん" },
      { front: "年末調整", back: "Quyết toán thuế cuối năm", reading: "ねんまつちょうせい" },
      { front: "産休・育休", back: "Nghỉ thai sản / Nghỉ chăm con", reading: "さんきゅう・いくきゅう" },
    ]
  },

  // ─── 8. Sales & Negotiation ──────────────────────────────
  {
    titleVi: "Kinh doanh & Đàm phán",
    titleJa: "営業・商談",
    descriptionVi: "Từ vựng và mẫu câu dùng trong giao dịch, đàm phán với đối tác Nhật",
    descriptionJa: "営業活動や商談で使う表現",
    cards: [
      { front: "お見積もり", back: "Báo giá (quotation)", reading: "おみつもり" },
      { front: "契約", back: "Hợp đồng", reading: "けいやく" },
      { front: "納品", back: "Giao hàng / bàn giao", reading: "のうひん" },
      { front: "ご提案させていただきます。", back: "Cho phép tôi đề xuất ạ.", reading: "ごていあんさせていただきます。" },
      { front: "ご予算はおいくらでしょうか。", back: "Ngân sách của quý khách là bao nhiêu ạ?", reading: "ごよさんはおいくらでしょうか。" },
      { front: "値引き", back: "Giảm giá / chiết khấu", reading: "ねびき" },
      { front: "前向きに検討いたします。", back: "Tôi sẽ xem xét tích cực. (Cách nói lịch sự)", reading: "まえむきにけんとういたします。" },
      { front: "取引先", back: "Đối tác kinh doanh", reading: "とりひきさき" },
      { front: "受注 / 発注", back: "Nhận đơn hàng / Đặt đơn hàng", reading: "じゅちゅう / はっちゅう" },
      { front: "競合他社", back: "Đối thủ cạnh tranh", reading: "きょうごうたしゃ" },
      { front: "御社のご要望にお応えできるよう努めます。", back: "Chúng tôi sẽ cố gắng đáp ứng yêu cầu của quý công ty.", reading: "おんしゃのごようぼうにおこたえできるようつとめます。" },
      { front: "ご成約ありがとうございます。", back: "Cảm ơn quý khách đã ký hợp đồng.", reading: "ごせいやくありがとうございます。" },
    ]
  },

  // ─── 9. IT & Technology Workplace ────────────────────────
  {
    titleVi: "IT & Công nghệ nơi công sở",
    titleJa: "IT・テクノロジー職場用語",
    descriptionVi: "Từ vựng tiếng Nhật dùng trong môi trường IT, phát triển phần mềm, họp kỹ thuật",
    descriptionJa: "IT企業やエンジニアが使う日本語表現",
    cards: [
      { front: "実装", back: "Triển khai / implement (code)", reading: "じっそう" },
      { front: "仕様", back: "Đặc tả / specification", reading: "しよう" },
      { front: "不具合", back: "Lỗi / bug", reading: "ふぐあい" },
      { front: "本番環境", back: "Môi trường production", reading: "ほんばんかんきょう" },
      { front: "テスト環境", back: "Môi trường test/staging", reading: "テストかんきょう" },
      { front: "リリース", back: "Release (phát hành phiên bản)", reading: "リリース" },
      { front: "レビュー", back: "Review (code review)", reading: "レビュー" },
      { front: "工数", back: "Man-hour / effort (giờ công)", reading: "こうすう" },
      { front: "要件定義", back: "Định nghĩa yêu cầu (requirement definition)", reading: "ようけんていぎ" },
      { front: "設計書", back: "Tài liệu thiết kế", reading: "せっけいしょ" },
      { front: "デプロイ", back: "Deploy (triển khai lên server)", reading: "デプロイ" },
      { front: "進捗", back: "Tiến độ (progress)", reading: "しんちょく" },
    ]
  },

  // ─── 10. Workplace Manners & Relations ───────────────────
  {
    titleVi: "Phép lịch sự & Quan hệ đồng nghiệp",
    titleJa: "職場マナー・人間関係",
    descriptionVi: "Quy tắc ứng xử, cách xây dựng mối quan hệ tốt với đồng nghiệp và cấp trên",
    descriptionJa: "職場での礼儀や人間関係構築の表現",
    cards: [
      { front: "お手数をおかけします。", back: "Xin lỗi đã gây phiền phức cho anh/chị.", reading: "おてすうをおかけします。" },
      { front: "助かります。", back: "Cảm ơn, giúp tôi rất nhiều.", reading: "たすかります。" },
      { front: "お気遣いありがとうございます。", back: "Cảm ơn sự quan tâm của anh/chị.", reading: "おきづかいありがとうございます。" },
      { front: "申し訳ございません。", back: "Tôi thành thật xin lỗi. (Trang trọng)", reading: "もうしわけございません。" },
      { front: "今後気をつけます。", back: "Từ nay tôi sẽ cẩn thận hơn.", reading: "こんごきをつけます。" },
      { front: "飲み会", back: "Tiệc nhậu sau giờ làm (nomikai)", reading: "のみかい" },
      { front: "歓迎会 / 送別会", back: "Tiệc chào đón / tiệc chia tay", reading: "かんげいかい / そうべつかい" },
      { front: "空気を読む", back: "Đọc không khí (hiểu ý ngầm)", reading: "くうきをよむ" },
      { front: "根回し", back: "Vận động trước (lobby/căn ke trước khi họp)", reading: "ねまわし" },
      { front: "上司", back: "Cấp trên / sếp", reading: "じょうし" },
      { front: "部下", back: "Cấp dưới / nhân viên", reading: "ぶか" },
      { front: "先輩 / 後輩", back: "Tiền bối / hậu bối (đàn anh / đàn em)", reading: "せんぱい / こうはい" },
    ]
  },
];

async function main() {
  console.log("🃏 Seeding 10 public workplace flashcard decks...\n");

  for (const deckData of DECKS) {
    // Upsert deck by titleVi + no owner (system public deck)
    const existing = await prisma.deck.findFirst({
      where: { titleVi: deckData.titleVi, ownerUserId: null, visibility: "public" }
    });

    let deckId: string;

    if (existing) {
      // Update metadata
      await prisma.deck.update({
        where: { id: existing.id },
        data: {
          titleJa: deckData.titleJa,
          descriptionVi: deckData.descriptionVi,
          descriptionJa: deckData.descriptionJa,
        }
      });
      deckId = existing.id;

      // Delete existing cards to re-create (idempotent full refresh)
      await prisma.deckCard.deleteMany({ where: { deckId } });
      // Find orphan flashcard variants (cards only linked to this deck)
      const orphanCards = await prisma.flashcardVariant.findMany({
        where: { deckLinks: { none: {} }, sourceType: "seed_workplace" }
      });
      if (orphanCards.length > 0) {
        await prisma.flashcardVariant.deleteMany({
          where: { id: { in: orphanCards.map((c) => c.id) } }
        });
      }
      console.log(`  ♻️  Updated: ${deckData.titleVi}`);
    } else {
      const deck = await prisma.deck.create({
        data: {
          titleVi: deckData.titleVi,
          titleJa: deckData.titleJa,
          descriptionVi: deckData.descriptionVi,
          descriptionJa: deckData.descriptionJa,
          visibility: "public",
          ownerUserId: null,
        }
      });
      deckId = deck.id;
      console.log(`  ✨ Created: ${deckData.titleVi}`);
    }

    // Create cards
    for (let i = 0; i < deckData.cards.length; i++) {
      const c = deckData.cards[i]!;
      const card = await prisma.flashcardVariant.create({
        data: {
          frontText: c.front,
          backText: c.back,
          reading: c.reading ?? null,
          sourceType: "seed_workplace",
          sourceId: deckId, // reference deck as source for traceability
        }
      });
      await prisma.deckCard.create({
        data: { deckId, cardId: card.id, position: i }
      });
    }
  }

  const totalCards = DECKS.reduce((sum, d) => sum + d.cards.length, 0);
  console.log(`\n✅ Done! ${DECKS.length} decks, ${totalCards} cards total.`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
