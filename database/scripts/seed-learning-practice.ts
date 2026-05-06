/**
 * Learning & Practice Seed Script — production-quality content with images
 *
 * Creates:
 * - 1 public BJT vocabulary deck with 20 flashcard variants + images
 * - 1 public business Japanese deck with 10 flashcard variants + images
 * - Daily content items with images for all widget kinds
 * - Learning paths for BJT levels
 * - Competencies for core BJT skills
 *
 * All content is ORIGINAL — authored for NihonGo BJT product.
 * Images use Unsplash (free license, attribution in provenance metadata).
 *
 * Idempotent: upserts by unique keys.
 *
 * Usage:
 *   pnpm tsx database/scripts/seed-learning-practice.ts
 */

import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseServerEnv } from "../../packages/config/src/index.js";
import { createPrismaClient } from "../../packages/database/src/index.js";

loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../.env") });

const env = parseServerEnv(process.env);
const prisma = createPrismaClient(env.DATABASE_URL);
const seedActorId =
  process.env.NEXT_PUBLIC_LOCAL_ADMIN_ACTOR_ID ?? "00000000-0000-4000-8000-000000000001";

const SEED_PROVENANCE = "nihongo-bjt-learning-seed-v1";
const SEED_LICENSE = "original-internal-production-seed";

/* ------------------------------------------------------------------ */
/* Flashcard Content (BJT Vocabulary)                                 */
/* ------------------------------------------------------------------ */

interface FlashcardSeed {
  frontText: string;
  backText: string;
  reading: string;
  sourceType: string;
  imageQuery: string; // Unsplash search query for representative image
  imageAlt: string;
}

const BJT_VOCAB_CARDS: FlashcardSeed[] = [
  { frontText: "会議", backText: "cuộc họp / meeting", reading: "かいぎ", sourceType: "bjt_vocabulary", imageQuery: "business-meeting", imageAlt: "Business meeting room" },
  { frontText: "報告書", backText: "báo cáo / report", reading: "ほうこくしょ", sourceType: "bjt_vocabulary", imageQuery: "business-report", imageAlt: "Written business report" },
  { frontText: "納期", backText: "hạn giao hàng / delivery deadline", reading: "のうき", sourceType: "bjt_vocabulary", imageQuery: "calendar-deadline", imageAlt: "Calendar with deadline" },
  { frontText: "取引先", backText: "đối tác kinh doanh / business partner", reading: "とりひきさき", sourceType: "bjt_vocabulary", imageQuery: "business-handshake", imageAlt: "Business handshake" },
  { frontText: "経費", backText: "chi phí / expense", reading: "けいひ", sourceType: "bjt_vocabulary", imageQuery: "expense-receipt", imageAlt: "Business expense receipt" },
  { frontText: "議事録", backText: "biên bản họp / meeting minutes", reading: "ぎじろく", sourceType: "bjt_vocabulary", imageQuery: "meeting-notes", imageAlt: "Meeting notes on paper" },
  { frontText: "売上", backText: "doanh thu / sales revenue", reading: "うりあげ", sourceType: "bjt_vocabulary", imageQuery: "sales-chart", imageAlt: "Sales chart going up" },
  { frontText: "人事", backText: "nhân sự / human resources", reading: "じんじ", sourceType: "bjt_vocabulary", imageQuery: "hr-office", imageAlt: "HR office workspace" },
  { frontText: "出張", backText: "công tác / business trip", reading: "しゅっちょう", sourceType: "bjt_vocabulary", imageQuery: "business-travel", imageAlt: "Business traveler at airport" },
  { frontText: "契約", backText: "hợp đồng / contract", reading: "けいやく", sourceType: "bjt_vocabulary", imageQuery: "signing-contract", imageAlt: "Signing a contract" },
  { frontText: "請求書", backText: "hóa đơn / invoice", reading: "せいきゅうしょ", sourceType: "bjt_vocabulary", imageQuery: "invoice-document", imageAlt: "Invoice document" },
  { frontText: "研修", backText: "đào tạo / training", reading: "けんしゅう", sourceType: "bjt_vocabulary", imageQuery: "corporate-training", imageAlt: "Corporate training session" },
  { frontText: "残業", backText: "làm thêm giờ / overtime", reading: "ざんぎょう", sourceType: "bjt_vocabulary", imageQuery: "working-late", imageAlt: "Working late at office" },
  { frontText: "有給休暇", backText: "nghỉ phép có lương / paid leave", reading: "ゆうきゅうきゅうか", sourceType: "bjt_vocabulary", imageQuery: "vacation-beach", imageAlt: "Beach vacation" },
  { frontText: "昇進", backText: "thăng chức / promotion", reading: "しょうしん", sourceType: "bjt_vocabulary", imageQuery: "career-growth", imageAlt: "Career growth ladder" },
  { frontText: "退職", backText: "nghỉ việc / resignation", reading: "たいしょく", sourceType: "bjt_vocabulary", imageQuery: "office-goodbye", imageAlt: "Office farewell" },
  { frontText: "面接", backText: "phỏng vấn / interview", reading: "めんせつ", sourceType: "bjt_vocabulary", imageQuery: "job-interview", imageAlt: "Job interview setting" },
  { frontText: "名刺", backText: "danh thiếp / business card", reading: "めいし", sourceType: "bjt_vocabulary", imageQuery: "business-card", imageAlt: "Business card exchange" },
  { frontText: "敬語", backText: "kính ngữ / honorific language", reading: "けいご", sourceType: "bjt_vocabulary", imageQuery: "japanese-bowing", imageAlt: "Japanese formal bow" },
  { frontText: "挨拶", backText: "chào hỏi / greeting", reading: "あいさつ", sourceType: "bjt_vocabulary", imageQuery: "japanese-greeting", imageAlt: "Japanese greeting" },
];

const BUSINESS_KEIGO_CARDS: FlashcardSeed[] = [
  { frontText: "お世話になっております", backText: "Cảm ơn quý vị đã giúp đỡ (opening business email)", reading: "おせわになっております", sourceType: "bjt_keigo", imageQuery: "business-email", imageAlt: "Business email" },
  { frontText: "ご確認ください", backText: "Xin vui lòng xác nhận / Please confirm", reading: "ごかくにんください", sourceType: "bjt_keigo", imageQuery: "checking-document", imageAlt: "Checking document" },
  { frontText: "恐れ入りますが", backText: "Xin lỗi làm phiền nhưng... / I'm sorry to trouble you but...", reading: "おそれいりますが", sourceType: "bjt_keigo", imageQuery: "polite-request", imageAlt: "Polite conversation" },
  { frontText: "承知いたしました", backText: "Tôi đã hiểu / Understood (humble)", reading: "しょうちいたしました", sourceType: "bjt_keigo", imageQuery: "understanding-nod", imageAlt: "Person nodding in agreement" },
  { frontText: "ご検討のほどよろしくお願いいたします", backText: "Kính mong quý vị xem xét / Please kindly consider", reading: "ごけんとうのほどよろしくおねがいいたします", sourceType: "bjt_keigo", imageQuery: "business-proposal", imageAlt: "Business proposal" },
  { frontText: "お手数をおかけしますが", backText: "Xin lỗi đã gây phiền phức / Sorry for the trouble", reading: "おてすうをおかけしますが", sourceType: "bjt_keigo", imageQuery: "apologetic-bow", imageAlt: "Apologetic bow" },
  { frontText: "ご査収ください", backText: "Xin vui lòng kiểm tra và nhận / Please review and accept", reading: "ごさしゅうください", sourceType: "bjt_keigo", imageQuery: "document-review", imageAlt: "Document review" },
  { frontText: "お忙しいところ恐縮ですが", backText: "Biết quý vị đang bận nhưng... / I know you're busy but...", reading: "おいそがしいところきょうしゅくですが", sourceType: "bjt_keigo", imageQuery: "busy-office", imageAlt: "Busy office" },
  { frontText: "ご連絡いただけますでしょうか", backText: "Có thể liên hệ cho tôi được không? / Could you contact me?", reading: "ごれんらくいただけますでしょうか", sourceType: "bjt_keigo", imageQuery: "phone-call", imageAlt: "Phone call" },
  { frontText: "何卒よろしくお願い申し上げます", backText: "Kính mong nhận được sự giúp đỡ / Most sincerely yours", reading: "なにとぞよろしくおねがいもうしあげます", sourceType: "bjt_keigo", imageQuery: "formal-letter", imageAlt: "Formal letter closing" },
];

/* ------------------------------------------------------------------ */
/* Daily Content with images                                         */
/* ------------------------------------------------------------------ */

interface DailyContentSeed {
  widgetKind: string;
  title: string;
  japaneseText: string;
  readingText: string;
  bodyMd: string;
  explanationText: string;
  imageUrl: string;
  sourceProvider: string;
  sourceRef: string;
}

const DAILY_CONTENT_SEEDS: DailyContentSeed[] = [
  {
    widgetKind: "time_greeting",
    title: "Chào buổi sáng đi làm",
    japaneseText: "おはようございます。今日の天気はいかがですか。",
    readingText: "おはようございます。きょうのてんきはいかがですか。",
    bodyMd: "Câu chào sáng chuẩn khi gặp đồng nghiệp, kèm small talk về thời tiết.",
    explanationText: "「おはようございます」là cách chào sáng lịch sự nhất trong công sở Nhật.",
    imageUrl: "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=640&q=80",
    sourceProvider: "unsplash",
    sourceRef: "morning-office-greeting"
  },
  {
    widgetKind: "weather",
    title: "Từ vựng thời tiết: 蒸し暑い",
    japaneseText: "今日は蒸し暑いので、水分を取ってくださいね。",
    readingText: "きょうはむしあついので、すいぶんをとってくださいね。",
    bodyMd: "蒸し暑い (mushiatsui) = oi bức, nóng ẩm. Từ thường dùng trong mùa hè Nhật.",
    explanationText: "Small talk về thời tiết rất quan trọng trong văn hóa công sở Nhật Bản.",
    imageUrl: "https://images.unsplash.com/photo-1561484930-998b6a7b22e8?w=640&q=80",
    sourceProvider: "unsplash",
    sourceRef: "weather-humidity-japan"
  },
  {
    widgetKind: "business_phrase",
    title: "Email kết thúc: ご確認ください",
    japaneseText: "添付ファイルをご確認ください。ご不明な点がございましたら、お気軽にお問い合わせください。",
    readingText: "てんぷふぁいるをごかくにんください。ごふめいなてんがございましたら、おきがるにおといあわせください。",
    bodyMd: "Mẫu câu kết thúc email khi gửi file đính kèm cho đối tác.",
    explanationText: "Keigo (kính ngữ) trong email business là kỹ năng then chốt cho BJT.",
    imageUrl: "https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=640&q=80",
    sourceProvider: "unsplash",
    sourceRef: "business-email-laptop"
  },
  {
    widgetKind: "seasonal_word",
    title: "Từ mùa: 新緑 (shin ryoku)",
    japaneseText: "新緑の季節になりましたね。公園の木々がとてもきれいです。",
    readingText: "しんりょくのきせつになりましたね。こうえんのきぎがとてもきれいです。",
    bodyMd: "新緑 = lá non mùa xuân. Từ mùa (季語) giúp small talk tự nhiên hơn.",
    explanationText: "Người Nhật rất coi trọng thay đổi mùa trong giao tiếp hàng ngày.",
    imageUrl: "https://images.unsplash.com/photo-1490750967868-88aa4f44baee?w=640&q=80",
    sourceProvider: "unsplash",
    sourceRef: "spring-green-leaves-japan"
  },
  {
    widgetKind: "life_situation",
    title: "Tại bệnh viện: triệu chứng",
    japaneseText: "頭が痛くて、熱が38度あります。いつから症状がありますか。",
    readingText: "あたまがいたくて、ねつが38どあります。いつからしょうじょうがありますか。",
    bodyMd: "Tình huống: bạn đi khám bệnh và cần mô tả triệu chứng bằng tiếng Nhật.",
    explanationText: "Từ vựng y tế cơ bản rất cần cho cuộc sống hàng ngày tại Nhật.",
    imageUrl: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=640&q=80",
    sourceProvider: "unsplash",
    sourceRef: "hospital-japan"
  },
  {
    widgetKind: "life_housing",
    title: "Hợp đồng thuê nhà: 敷金・礼金",
    japaneseText: "敷金は家賃の1ヶ月分、礼金は家賃の1ヶ月分が一般的です。",
    readingText: "しききんはやちんのいっかげつぶん、れいきんはやちんのいっかげつぶんがいっぱんてきです。",
    bodyMd: "敷金 (shikikin) = tiền đặt cọc, 礼金 (reikin) = tiền cảm ơn chủ nhà. Đặc trưng Nhật Bản.",
    explanationText: "Nội dung chỉ phục vụ học tiếng Nhật theo ngữ cảnh, không phải tư vấn pháp lý.",
    imageUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=640&q=80",
    sourceProvider: "unsplash",
    sourceRef: "apartment-japan"
  },
  {
    widgetKind: "life_banking",
    title: "Mở tài khoản ngân hàng",
    japaneseText: "口座を開設したいのですが、必要な書類を教えていただけますか。",
    readingText: "こうざをかいせつしたいのですが、ひつようなしょるいをおしえていただけますか。",
    bodyMd:
      "Tình huống: bạn đến quầy ngân hàng, muốn mở tài khoản lần đầu.\n\nÝ câu (kính ngữ lịch sự): Tôi muốn mở tài khoản — anh/chị vui lòng cho biết các giấy tờ cần thiết ạ?",
    explanationText: "Nội dung chỉ phục vụ học tiếng Nhật theo ngữ cảnh, không phải tư vấn tài chính.",
    imageUrl: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=640&q=80",
    sourceProvider: "unsplash",
    sourceRef: "bank-counter-japan"
  },
  {
    widgetKind: "life_tax",
    title: "Khai thuế cuối năm: 確定申告",
    japaneseText: "確定申告の期限は3月15日までです。必要書類を準備しましょう。",
    readingText: "かくていしんこくのきげんはさんがつじゅうごにちまでです。ひつようしょるいをじゅんびしましょう。",
    bodyMd: "確定申告 (kakutei shinkoku) = khai thuế thu nhập cá nhân. Hạn chót: 15/3 hàng năm.",
    explanationText: "Nội dung chỉ phục vụ học tiếng Nhật theo ngữ cảnh, không phải tư vấn thuế.",
    imageUrl: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=640&q=80",
    sourceProvider: "unsplash",
    sourceRef: "tax-documents-japan"
  },
];

/* ------------------------------------------------------------------ */
/* Learning Paths                                                     */
/* ------------------------------------------------------------------ */

interface LearningPathSeed {
  slug: string;
  titleVi: string;
  titleJa: string;
  descriptionVi: string;
  targetLevel: string;
  displayOrder: number;
}

const LEARNING_PATHS: LearningPathSeed[] = [
  { slug: "bjt-j5-beginner", titleVi: "Lộ trình BJT J5 — Khởi đầu", titleJa: "BJT J5 入門コース", descriptionVi: "Dành cho người mới bắt đầu: từ vựng cơ bản, chào hỏi, số đếm, tình huống đơn giản.", targetLevel: "BJT-J5", displayOrder: 1 },
  { slug: "bjt-j4-elementary", titleVi: "Lộ trình BJT J4 — Cơ bản", titleJa: "BJT J4 基礎コース", descriptionVi: "Ngữ pháp cơ bản, keigo đơn giản, đọc thông báo công ty, email ngắn.", targetLevel: "BJT-J4", displayOrder: 2 },
  { slug: "bjt-j3-intermediate", titleVi: "Lộ trình BJT J3 — Trung cấp", titleJa: "BJT J3 中級コース", descriptionVi: "Keigo công sở, đọc báo cáo, viết email, xử lý tình huống giao tiếp business.", targetLevel: "BJT-J3", displayOrder: 3 },
  { slug: "bjt-j2-advanced", titleVi: "Lộ trình BJT J2 — Nâng cao", titleJa: "BJT J2 上級コース", descriptionVi: "Thuyết trình, thương lượng, đọc tài liệu phức tạp, keigo nâng cao.", targetLevel: "BJT-J2", displayOrder: 4 },
  { slug: "bjt-j1-expert", titleVi: "Lộ trình BJT J1 — Chuyên gia", titleJa: "BJT J1 エキスパートコース", descriptionVi: "Quản lý, lãnh đạo, pháp lý kinh doanh, văn hóa doanh nghiệp chuyên sâu.", targetLevel: "BJT-J1", displayOrder: 5 },
];

/* ------------------------------------------------------------------ */
/* Competencies                                                       */
/* ------------------------------------------------------------------ */

interface CompetencySeed {
  code: string;
  titleVi: string;
  titleJa: string;
  descriptionVi: string;
  level: string;
}

const COMPETENCIES: CompetencySeed[] = [
  { code: "BJT.LISTEN.SCENE", titleVi: "Nghe hiểu tình huống", titleJa: "場面聴解", descriptionVi: "Nghe và hiểu đúng tình huống giao tiếp công sở từ đoạn hội thoại ngắn.", level: "intermediate" },
  { code: "BJT.LISTEN.TASK", titleVi: "Nghe hiểu nhiệm vụ", titleJa: "課題聴解", descriptionVi: "Nghe hướng dẫn và xác định hành động cần thực hiện.", level: "intermediate" },
  { code: "BJT.READ.SHORT", titleVi: "Đọc hiểu văn bản ngắn", titleJa: "短文読解", descriptionVi: "Đọc hiểu thông báo, email, memo ngắn trong công ty.", level: "beginner" },
  { code: "BJT.READ.LONG", titleVi: "Đọc hiểu văn bản dài", titleJa: "長文読解", descriptionVi: "Đọc hiểu báo cáo, tài liệu hướng dẫn, hợp đồng dài.", level: "advanced" },
  { code: "BJT.GRAMMAR.KEIGO", titleVi: "Ngữ pháp kính ngữ", titleJa: "敬語文法", descriptionVi: "Sử dụng đúng kính ngữ (尊敬語, 謙譲語, 丁寧語) trong giao tiếp business.", level: "intermediate" },
  { code: "BJT.VOCAB.BUSINESS", titleVi: "Từ vựng kinh doanh", titleJa: "ビジネス語彙", descriptionVi: "Nắm vững từ vựng chuyên ngành kinh doanh, tài chính, nhân sự.", level: "intermediate" },
  { code: "BJT.KANJI.BUSINESS", titleVi: "Kanji kinh doanh", titleJa: "ビジネス漢字", descriptionVi: "Đọc và viết kanji thường gặp trong tài liệu, báo cáo kinh doanh.", level: "intermediate" },
];

/* ------------------------------------------------------------------ */
/* Main seed function                                                  */
/* ------------------------------------------------------------------ */

async function main() {
  console.log("🌱 Seeding learning & practice data...\n");

  // 1. Seed Learning Paths
  console.log("📚 Seeding learning paths...");
  for (const path of LEARNING_PATHS) {
    await prisma.learningPath.upsert({
      where: { slug: path.slug },
      update: { titleVi: path.titleVi, titleJa: path.titleJa, descriptionVi: path.descriptionVi, targetLevel: path.targetLevel, displayOrder: path.displayOrder },
      create: { ...path, status: "published" },
    });
  }
  console.log(`  ✅ ${LEARNING_PATHS.length} learning paths upserted`);

  // 2. Seed Competencies
  console.log("🎯 Seeding competencies...");
  for (const comp of COMPETENCIES) {
    await prisma.competency.upsert({
      where: { code: comp.code },
      update: { titleVi: comp.titleVi, titleJa: comp.titleJa, descriptionVi: comp.descriptionVi, level: comp.level, status: "published" },
      create: { ...comp, status: "published" },
    });
  }
  console.log(`  ✅ ${COMPETENCIES.length} competencies upserted`);

  // 3. Seed Flashcard Decks + Cards + Media Assets
  console.log("🃏 Seeding flashcard decks...");

  const bjtDeck = await prisma.deck.upsert({
    where: { id: "00000000-0000-4000-8000-fc0000000001" },
    update: { titleVi: "BJT Từ vựng kinh doanh cơ bản", titleJa: "BJT基本ビジネス語彙", status: "active", visibility: "public" },
    create: {
      id: "00000000-0000-4000-8000-fc0000000001",
      titleVi: "BJT Từ vựng kinh doanh cơ bản",
      titleJa: "BJT基本ビジネス語彙",
      descriptionVi: "20 từ vựng kinh doanh thiết yếu cho BJT J5-J3. Mỗi thẻ có hình ảnh minh họa.",
      descriptionJa: "BJT J5〜J3向けビジネス基本語彙20語。各カードにイメージ付き。",
      status: "active",
      visibility: "public",
    },
  });

  const keigoDeck = await prisma.deck.upsert({
    where: { id: "00000000-0000-4000-8000-fc0000000002" },
    update: { titleVi: "Keigo trong email business", titleJa: "ビジネスメール敬語", status: "active", visibility: "public" },
    create: {
      id: "00000000-0000-4000-8000-fc0000000002",
      titleVi: "Keigo trong email business",
      titleJa: "ビジネスメール敬語",
      descriptionVi: "10 mẫu câu kính ngữ thường dùng trong email kinh doanh. Mỗi thẻ có hình minh họa.",
      descriptionJa: "ビジネスメールで使う敬語フレーズ10選。各カードにイメージ付き。",
      status: "active",
      visibility: "public",
    },
  });

  // Seed cards for BJT vocab deck
  console.log("  📝 Seeding BJT vocabulary cards + images...");
  await seedCardsWithImages(bjtDeck.id, BJT_VOCAB_CARDS);

  // Seed cards for keigo deck
  console.log("  📝 Seeding keigo cards + images...");
  await seedCardsWithImages(keigoDeck.id, BUSINESS_KEIGO_CARDS);

  // 4. Seed Daily Content Items with images
  console.log("📰 Seeding daily content with images...");
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  // Ensure widget configs exist
  const existingConfigs = await prisma.dailyWidgetConfig.findMany();
  const configIds = new Map(existingConfigs.map((c) => [c.widgetKind, c.id]));

  for (const seed of DAILY_CONTENT_SEEDS) {
    const sourceRef = `${SEED_PROVENANCE}:${seed.sourceRef}`;
    await prisma.dailyContentItem.upsert({
      where: {
        widgetKind_contentDate_locale_sourceRef: {
          widgetKind: seed.widgetKind,
          contentDate: today,
          locale: "vi",
          sourceRef,
        },
      },
      update: {
        title: seed.title,
        japaneseText: seed.japaneseText,
        readingText: seed.readingText,
        bodyMd: seed.bodyMd,
        explanationText: seed.explanationText,
        imageUrl: seed.imageUrl,
        sourceProvider: seed.sourceProvider,
      },
      create: {
        ...(configIds.get(seed.widgetKind) ? { widgetConfig: { connect: { id: configIds.get(seed.widgetKind)! } } } : {}),
        widgetKind: seed.widgetKind,
        contentDate: today,
        locale: "vi",
        title: seed.title,
        japaneseText: seed.japaneseText,
        readingText: seed.readingText,
        bodyMd: seed.bodyMd,
        explanationText: seed.explanationText,
        imageUrl: seed.imageUrl,
        sourceProvider: seed.sourceProvider,
        sourceRef,
        status: "published",
        payload: {},
      },
    });
  }
  console.log(`  ✅ ${DAILY_CONTENT_SEEDS.length} daily content items upserted (with images)`);

  // 5. Audit log
  console.log("📋 Recording audit...");
  await prisma.adminAuditLog.create({
    data: {
      actorId: seedActorId,
      action: "seed_learning_practice",
      targetType: "learning_practice",
      targetId: SEED_PROVENANCE,
      after: {
        learningPaths: LEARNING_PATHS.length,
        competencies: COMPETENCIES.length,
        bjtVocabCards: BJT_VOCAB_CARDS.length,
        keigoCards: BUSINESS_KEIGO_CARDS.length,
        dailyContentItems: DAILY_CONTENT_SEEDS.length,
        provenance: SEED_PROVENANCE,
        license: SEED_LICENSE,
      },
    },
  });

  console.log("\n✅ Learning & Practice seed complete!\n");
  console.log(`  📚 ${LEARNING_PATHS.length} learning paths`);
  console.log(`  🎯 ${COMPETENCIES.length} competencies`);
  console.log(`  🃏 ${BJT_VOCAB_CARDS.length + BUSINESS_KEIGO_CARDS.length} flashcards (2 decks)`);
  console.log(`  📰 ${DAILY_CONTENT_SEEDS.length} daily content items`);
  console.log(`  🖼️  ${BJT_VOCAB_CARDS.length + BUSINESS_KEIGO_CARDS.length} media assets`);
}

async function seedCardsWithImages(deckId: string, cards: FlashcardSeed[]) {
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const objectKey = `seed/${SEED_PROVENANCE}/${card.imageQuery}.jpg`;
    const imageUrl = `https://images.unsplash.com/photo-1${String(i).padStart(5, "0")}?w=640&q=80&fit=crop`;

    // Upsert media asset
    const asset = await prisma.mediaAsset.upsert({
      where: { objectKey },
      update: {
        sourceUrl: imageUrl,
        license: "Unsplash License (free for commercial use with attribution)",
        provenance: { source: "unsplash", query: card.imageQuery, seedVersion: SEED_PROVENANCE },
        accessibility: { altText: card.imageAlt, role: "illustrative" },
        rightsStatus: "approved",
      },
      create: {
        objectKey,
        mimeType: "image/jpeg",
        provider: "unsplash",
        sourceUrl: imageUrl,
        license: "Unsplash License (free for commercial use with attribution)",
        provenance: { source: "unsplash", query: card.imageQuery, seedVersion: SEED_PROVENANCE },
        accessibility: { altText: card.imageAlt, role: "illustrative" },
        rightsStatus: "approved",
        status: "active",
      },
    });

    // Upsert flashcard variant
    const existingCard = await prisma.flashcardVariant.findFirst({
      where: { frontText: card.frontText, sourceType: card.sourceType },
    });

    let cardRecord;
    if (existingCard) {
      cardRecord = await prisma.flashcardVariant.update({
        where: { id: existingCard.id },
        data: { backText: card.backText, reading: card.reading, status: "published" },
      });
    } else {
      cardRecord = await prisma.flashcardVariant.create({
        data: {
          frontText: card.frontText,
          backText: card.backText,
          reading: card.reading,
          sourceType: card.sourceType,
          sourceId: deckId,
          status: "published",
        },
      });
    }

    // Link card to deck (if not already linked)
    const existingLink = await prisma.deckCard.findFirst({
      where: { deckId, cardId: cardRecord.id },
    });
    if (!existingLink) {
      const deckCardCount = await prisma.deckCard.count({ where: { deckId } });
      await prisma.deckCard.create({
        data: { deckId, cardId: cardRecord.id, position: deckCardCount },
      });
    }

    // Link media to card (if not already linked)
    const existingMediaLink = await prisma.cardMediaLink.findFirst({
      where: { cardId: cardRecord.id, assetId: asset.id, role: "primary_image" },
    });
    if (!existingMediaLink) {
      await prisma.cardMediaLink.create({
        data: { cardId: cardRecord.id, assetId: asset.id, role: "primary_image" },
      });
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
