import { parseServerEnv } from "../../../../packages/config/src/index.js";
import { createPrismaClient, type Prisma } from "../../../../packages/database/src/index.js";
import { buildDailySuggestedFlashcardBack, todayDateKey } from "../../../../packages/shared/src/index.js";
import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../../.env") });

const env = parseServerEnv(process.env);
const prisma = createPrismaClient(env.DATABASE_URL);
const today = new Date(`${todayDateKey(new Date())}T00:00:00.000Z`);

const widgetOrder = [
  "time_greeting",
  "weather",
  "seasonal_word",
  "business_phrase",
  "life_situation",
  "life_housing",
  "life_banking",
  "life_tax",
  "nhk_news"
];

const contentSeeds = [
  {
    bodyMd: "Chào buổi sáng / thời điểm bắt đầu ca — thường gặp khi vào văn phòng.",
    explanationText: "Thích hợp với đồng nghiệp quen, kèm cúi đầu nhẹ khi nói.",
    japaneseText: "おはようございます。今日も一日よろしくお願いします。",
    kind: "time_greeting",
    readingText: "おはようございます。きょうもいちにちよろしくおねがいします。",
    title: "Chào buổi sáng công sở"
  },
  {
    bodyMd: "Một câu chào nhẹ khi gặp đồng nghiệp hoặc bắt đầu trao đổi trong ngày.",
    explanationText: "Dùng trong môi trường công sở, vừa lịch sự vừa tự nhiên.",
    japaneseText: "お疲れさまです。本日もよろしくお願いいたします。",
    kind: "business_phrase",
    readingText: "おつかれさまです。ほんじつもよろしくおねがいいたします。",
    title: "Câu chào công sở hôm nay"
  },
  {
    bodyMd: "Từ mùa trong ngày giúp bạn mở đầu small talk theo phong cách Nhật.",
    explanationText: "調整 thường xuất hiện trong lịch họp, deadline và giao tiếp business.",
    japaneseText: "予定を調整して、改めてご連絡いたします。",
    kind: "seasonal_word",
    readingText: "よていをちょうせいして、あらためてごれんらくいたします。",
    title: "今日の言葉: 調整"
  },
  {
    bodyMd: "Tình huống: bạn cần báo đến muộn vì tàu chậm.",
    explanationText: "Giữ thông tin ngắn, nói lý do và thời gian dự kiến.",
    japaneseText: "電車が遅れているため、10分ほど遅れます。",
    kind: "life_situation",
    readingText: "でんしゃがおくれているため、じゅっぷんほどおくれます。",
    title: "Tình huống đời sống: báo đến muộn"
  },
  {
    bodyMd: "Fallback weather provider khi chưa cấu hình API thời tiết ngoài.",
    explanationText: "Câu small talk an toàn để nói về thời tiết trước cuộc họp.",
    japaneseText: "今日は少し蒸し暑いですね。",
    kind: "weather",
    readingText: "きょうはすこしむしあついですね。",
    title: "Weather Japanese"
  },
  {
    bodyMd: "Tin NHK seed nội bộ để luyện đọc trước khi nối RSS provider.",
    explanationText: "Đọc tiêu đề, chọn 2 từ khóa rồi tạo thẻ ôn tập.",
    japaneseText: "企業の採用活動が本格化しています。",
    kind: "nhk_news",
    readingText: "きぎょうのさいようかつどうがほんかくかしています。",
    title: "NHK News to Learn"
  },
  {
    bodyMd:
      "Tình huống: bạn đọc hợp đồng thuê nhà và gặp các khoản 敷金・礼金・更新料.\n\nÝ câu: Đặt cọc (敷金) và tiền lễ (礼金) thường bằng một tháng tiền nhà; phí gia hạn (更新料) có thể phát sinh mỗi hai năm.",
    explanationText: "Nội dung chỉ phục vụ học tiếng Nhật theo ngữ cảnh, không phải tư vấn pháp lý.",
    japaneseText: "敷金は家賃の１ヶ月分、礼金は家賃の１ヶ月分です。更新料は２年ごとに発生します。",
    kind: "life_housing",
    readingText: "しききんはやちんのいっかげつぶん、れいきんはやちんのいっかげつぶん です。こうしんりょうはにねんごとにはっせいします。",
    title: "Thuê nhà: 敷金・礼金・更新料"
  },
  {
    bodyMd:
      "Tình huống: bạn đến quầy ngân hàng, muốn mở tài khoản lần đầu.\n\nÝ câu (kính ngữ lịch sự): Tôi muốn mở tài khoản — anh/chị vui lòng cho biết các giấy tờ cần thiết ạ?",
    explanationText: "Nội dung chỉ phục vụ học tiếng Nhật theo ngữ cảnh, không phải tư vấn tài chính.",
    japaneseText: "口座を開設したいのですが、必要な書類を教えていただけますか。",
    kind: "life_banking",
    readingText: "こうざをかいせつしたいのですが、ひつようなしょるいをおしえていただけますか。",
    title: "Ngân hàng: mở tài khoản"
  },
  {
    bodyMd:
      "Tình huống: bạn nhận phiếu lương (給与明細) và cần đọc các khoản khấu trừ.\n\nÝ câu: Phần khấu trừ ghi thuế thu nhập, thuế cư trú, bảo hiểm y tế và bảo hiểm hưu trí (厚生年金).",
    explanationText: "Nội dung chỉ phục vụ học tiếng Nhật theo ngữ cảnh, không phải tư vấn thuế.",
    japaneseText: "給与明細の控除欄に、所得税・住民税・健康保険・厚生年金が記載されています。",
    kind: "life_tax",
    readingText: "きゅうよめいさいのこうじょらんに、しょとくぜい・じゅうみんぜい・けんこうほけん・こうせいねんきんがきさいされています。",
    title: "Phiếu lương: thuế & bảo hiểm"
  }
] as const;

function flashcardsFor(seed: (typeof contentSeeds)[number]) {
  const primaryBack = buildDailySuggestedFlashcardBack(seed.bodyMd, seed.explanationText);
  return [
    { backText: primaryBack, frontText: seed.japaneseText, reading: seed.readingText },
    { backText: seed.title, frontText: seed.japaneseText.split("。")[0], reading: seed.readingText }
  ];
}

async function main() {
  for (const locale of ["vi", "ja"] as const) {
    for (const [index, widgetKind] of widgetOrder.entries()) {
      await prisma.dailyWidgetConfig.upsert({
        create: {
          displayOrder: index,
          locale,
          settings: { provider: widgetKind === "weather" ? "local_fallback" : "curated_seed" },
          widgetKind
        },
        update: {
          enabled: true,
          settings: { provider: widgetKind === "weather" ? "local_fallback" : "curated_seed" }
        },
        where: { widgetKind_locale: { locale, widgetKind } }
      });
    }
  }

  for (const seed of contentSeeds) {
    for (const locale of ["vi", "ja"] as const) {
      const config = await prisma.dailyWidgetConfig.findUnique({
        where: { widgetKind_locale: { locale, widgetKind: seed.kind } }
      });
      const item = await prisma.dailyContentItem.upsert({
        create: {
          bodyMd: seed.bodyMd,
          contentDate: today,
          explanationText: seed.explanationText,
          japaneseText: seed.japaneseText,
          locale,
          payload: { seed: true, status: "dev_seed" } as Prisma.InputJsonValue,
          readingText: seed.readingText,
          sourceProvider: "local_seed",
          sourceRef: `${seed.kind}-${todayDateKey(today)}`,
          title: seed.title,
          widgetConfigId: config?.id,
          widgetKind: seed.kind
        },
        update: {
          bodyMd: seed.bodyMd,
          explanationText: seed.explanationText,
          japaneseText: seed.japaneseText,
          readingText: seed.readingText,
          title: seed.title
        },
        where: {
          widgetKind_contentDate_locale_sourceRef: {
            contentDate: today,
            locale,
            sourceRef: `${seed.kind}-${todayDateKey(today)}`,
            widgetKind: seed.kind
          }
        }
      });

      await prisma.dailyLearningExtraction.upsert({
        create: {
          dailyContentItemId: item.id,
          extractedEntries: [
            { text: seed.japaneseText, reading: seed.readingText }
          ] as Prisma.InputJsonValue,
          suggestedFlashcards: flashcardsFor(seed) as Prisma.InputJsonValue,
          suggestedQuiz: {
            answer: seed.japaneseText,
            options: [seed.japaneseText, "少々お待ちください。", "ありがとうございます。"],
            prompt: "この場面で最も自然な表現はどれですか。"
          } as Prisma.InputJsonValue
        },
        update: {
          suggestedFlashcards: flashcardsFor(seed) as Prisma.InputJsonValue
        },
        where: { dailyContentItemId: item.id }
      });
    }
  }

  console.log(`Seeded daily hub content for ${todayDateKey(today)}`);
}

main()
  .finally(() => prisma.$disconnect())
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
