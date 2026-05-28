/**
 * Radar Seed: Last 3 cards to hit 200
 * Run: node scripts/seed-radar-last-3.mjs
 */
import { createClient, runBatch, MODULES } from "./radar-seed-helpers.mjs";

const cards = [
  {
    slug: "karaoke-etiquette-japan",
    moduleConfigId: MODULES.japan_today,
    titleVi: "カラオケ — Văn hóa karaoke Nhật",
    titleJa: "カラオケのマナーと楽しみ方",
    descriptionVi: "Quy tắc karaoke Nhật — giá, cách đặt bài, social etiquette.",
    recommendationReasonVi: "Karaoke = social skill #1 ở Nhật. Nomikai xong = karaoke. Biết = hòa nhập.",
    category: "entertainment",
    visualTheme: "green_life",
    levelLabel: "N4-N3",
    estimatedMinutes: 3,
    priority: 155,
    metadata: {
      seed: true,
      skills: ["karaoke", "social", "entertainment"],
      contentGoal: "Biết etiquette + từ vựng karaoke Nhật.",
      usageNote: "Giá: 30分 100-300¥/人 (ngày), 500¥+ (đêm). フリータイム: unlimited 1000-2000¥. Quy tắc: pass mic, đừng hát quá dài, vỗ tay sau bài. Máy: DAM/JOYSOUND.",
      japaneseExpressions: [
        {
          word: "フリータイム",
          reading: "フリータイム",
          meaning: "Hát thoải mái không giới hạn (unlimited time)",
          jlptLevel: "N4",
          example: "平日のフリータイムは1000円でお得です。",
          exampleReading: "へいじつのフリータイムはせんえんでおとくです。",
          exampleMeaning: "Ngày thường free time 1000 yên, rẻ.",
          usageNote: "Thường 3-6h. Kèm drink bar. 平日昼 = rẻ nhất.",
        },
        {
          word: "十八番",
          reading: "おはこ",
          meaning: "Bài sở trường (go-to karaoke song)",
          jlptLevel: "N2",
          example: "彼の十八番は「残酷な天使のテーゼ」です。",
          exampleReading: "かれのおはこは「ざんこくなてんしのテーゼ」です。",
          exampleMeaning: "Bài ruột anh ấy là Cruel Angel's Thesis.",
          usageNote: "Nên có 1-2 bài 十八番. Safe picks: YOASOBI, back number, Official髭男dism.",
        },
        {
          word: "採点機能",
          reading: "さいてんきのう",
          meaning: "Chức năng chấm điểm (scoring mode)",
          jlptLevel: "N3",
          example: "採点機能で90点以上取れたら嬉しいです。",
          exampleReading: "さいてんきのうできゅうじゅってんいじょうとれたらうれしいです。",
          exampleMeaning: "Được 90+ điểm chấm thì vui.",
          usageNote: "DAM: 精密採点. JOYSOUND: 分析採点. 90+ = giỏi.",
        },
      ],
    },
  },
  {
    slug: "home-insurance-kasai-hoken",
    moduleConfigId: MODULES.market_watch,
    titleVi: "火災保険 — Bảo hiểm nhà/phòng trọ",
    titleJa: "火災保険の基礎知識",
    descriptionVi: "Bảo hiểm nhà ở — thuê phòng PHẢI có. Loại, phí, cách claim.",
    recommendationReasonVi: "Thuê nhà Nhật = bắt buộc có 火災保険. Hiểu = không mất tiền oan.",
    category: "money",
    visualTheme: "emerald_money",
    levelLabel: "N3-N2",
    estimatedMinutes: 3,
    priority: 170,
    metadata: {
      seed: true,
      skills: ["insurance", "housing", "money_management"],
      contentGoal: "Biết bảo hiểm nhà bắt buộc + cách chọn rẻ.",
      usageNote: "Thuê: 火災保険 BẮT BUỘC. Phí: 4000-20,000¥/năm. Cover: 火災, 水害, 盗難, 個人賠償. Gia hạn: 2年ごと.",
      japaneseExpressions: [
        {
          word: "火災保険",
          reading: "かさいほけん",
          meaning: "Bảo hiểm hỏa hoạn/nhà ở (fire insurance)",
          jlptLevel: "N3",
          example: "賃貸契約には火災保険への加入が必要です。",
          exampleReading: "ちんたいけいやくにはかさいほけんへのかにゅうがひつようです。",
          exampleMeaning: "Hợp đồng thuê nhà cần có bảo hiểm cháy.",
          usageNote: "不動産屋 recommend đắt → so sánh online rẻ hơn.",
        },
        {
          word: "個人賠償責任",
          reading: "こじんばいしょうせきにん",
          meaning: "Bồi thường trách nhiệm cá nhân (liability)",
          jlptLevel: "N2",
          example: "自転車で人にぶつかった場合、個人賠償責任で補償されます。",
          exampleReading: "じてんしゃでひとにぶつかったばあい、こじんばいしょうせきにんでほしょうされます。",
          exampleMeaning: "Đạp xe đụng người, bảo hiểm bồi thường.",
          usageNote: "Phần QUAN TRỌNG NHẤT. Cover xe đạp đụng người, hỏng đồ thuê.",
        },
        {
          word: "借家人賠償",
          reading: "しゃっかにんばいしょう",
          meaning: "Bồi thường cho chủ nhà (tenant liability)",
          jlptLevel: "N2",
          example: "退去時に壁を傷つけた分は借家人賠償でカバーされます。",
          exampleReading: "たいきょじにかべをきずつけたぶんはしゃっかにんばいしょうでカバーされます。",
          exampleMeaning: "Trả phòng hỏng tường, bảo hiểm cover.",
          usageNote: "Cover hư hại phòng ngoài 敷金.",
        },
      ],
    },
  },
  {
    slug: "parent-teacher-association-pta",
    moduleConfigId: MODULES.family_school,
    titleVi: "PTA — Hội phụ huynh trường",
    titleJa: "PTAの活動と参加方法",
    descriptionVi: "PTA ở Nhật — vai trò, hoạt động, từ vựng. Tham gia hay từ chối?",
    recommendationReasonVi: "Con đi học = PTA unavoidable. Biết quy tắc = không bị bỡ ngỡ.",
    category: "family",
    visualTheme: "rose_family",
    levelLabel: "N3-N2",
    estimatedMinutes: 3,
    priority: 165,
    metadata: {
      seed: true,
      skills: ["school", "parenting", "community"],
      contentGoal: "Biết PTA là gì + cách tham gia hoặc từ chối lịch sự.",
      usageNote: "PTA = Parent-Teacher Association. Mỗi trường có. Hoạt động: イベント企画, パトロール, 広報, バザー. Tham gia: 任意 nhưng áp lực xã hội mạnh.",
      japaneseExpressions: [
        {
          word: "役員",
          reading: "やくいん",
          meaning: "Ban điều hành (PTA committee member)",
          jlptLevel: "N3",
          example: "今年はPTAの役員を引き受けることになりました。",
          exampleReading: "ことしはPTAのやくいんをひきうけることになりました。",
          exampleMeaning: "Năm nay nhận làm ban điều hành PTA.",
          usageNote: "会長, 副会長, 書記, 会計. くじ引き chọn nếu không ai xung phong.",
        },
        {
          word: "参観日",
          reading: "さんかんび",
          meaning: "Ngày dự giờ (school open day)",
          jlptLevel: "N3",
          example: "来週の参観日に行く予定です。",
          exampleReading: "らいしゅうのさんかんびにいくよていです。",
          exampleMeaning: "Tuần sau dự định đi dự giờ.",
          usageNote: "学期 1-2回. Sau: 懇談会 (họp phụ huynh). Mặc lịch sự casual.",
        },
        {
          word: "連絡帳",
          reading: "れんらくちょう",
          meaning: "Sổ liên lạc nhà trường (communication notebook)",
          jlptLevel: "N3",
          example: "連絡帳に明日の持ち物が書いてあります。",
          exampleReading: "れんらくちょうにあしたのもちものがかいてあります。",
          exampleMeaning: "Sổ liên lạc ghi đồ mang ngày mai.",
          usageNote: "Mỗi ngày check. Nghỉ: viết lý do vào. App thay thế dần (2024~).",
        },
      ],
    },
  },
];

async function main() {
  const client = createClient();
  await client.connect();
  console.log("🎯 Last 3 to hit 200...");
  try {
    const result = await runBatch(client, cards, "Last 3");
    console.log(`✅ Done: ${result.success} inserted.`);
  } finally {
    await client.end();
  }
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
