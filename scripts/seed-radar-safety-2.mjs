/**
 * Radar Seed: Safety & Emergency Expansion (15+ cards)
 * Covers: earthquake, crime prevention, workplace safety, first aid, natural disasters
 * Run: node scripts/seed-radar-safety-2.mjs
 */
import { createClient, runBatch, MODULES } from "./radar-seed-helpers.mjs";

const M_SAFETY = MODULES.safety_emergency;
const M_WORK = MODULES.workplace_mission;

const cards = [
  {
    slug: "earthquake-immediate-actions",
    moduleConfigId: M_SAFETY,
    titleVi: "地震発生時 — Khi động đất xảy ra",
    titleJa: "地震が来たらやること",
    descriptionVi: "6 hành động + từ vựng cần biết khi động đất xảy ra.",
    recommendationReasonVi: "Nhật = nước động đất nhiều nhất. Biết cách phản ứng = sống sót.",
    category: "safety",
    visualTheme: "red_emergency",
    levelLabel: "N4-N3",
    estimatedMinutes: 4,
    priority: 200,
    metadata: {
      seed: true,
      skills: ["earthquake_response", "emergency_actions", "survival"],
      contentGoal: "Biết phải làm gì + từ vựng cần thiết khi động đất xảy ra.",
      usageNote: "Nhật có động đất mỗi ngày (phần lớn nhẹ). Mạnh (震度5+): mỗi năm vài lần. Chuẩn bị: 非常持ち出し袋 (túi khẩn cấp), biết nơi sơ tán, bật NHK.",
      japaneseExpressions: [
        {
          word: "緊急地震速報",
          reading: "きんきゅうじしんそくほう",
          meaning: "Cảnh báo động đất khẩn cấp (alert trên ĐT)",
          jlptLevel: "N2",
          example: "緊急地震速報です。強い揺れに警戒してください。",
          exampleReading: "きんきゅうじしんそくほうです。つよいゆれにけいかいしてください。",
          exampleMeaning: "Cảnh báo động đất khẩn cấp. Cảnh giác rung mạnh.",
          usageNote: "ĐT kêu lớn + rung 5-30 giây TRƯỚC khi động đất đến. Nghe thấy → chui xuống bàn.",
        },
        {
          word: "机の下に隠れて",
          reading: "つくえのしたにかくれて",
          meaning: "Chui xuống bàn (để tránh vật rơi)",
          jlptLevel: "N4",
          example: "地震です！机の下に隠れてください！頭を守って！",
          exampleReading: "じしんです！つくえのしたにかくれてください！あたまをまもって！",
          exampleMeaning: "Động đất! Chui xuống bàn! Bảo vệ đầu!",
          usageNote: "Rule #1: 身を守る (bảo vệ bản thân). Không chạy ra ngoài ngay. Chờ hết rung.",
        },
        {
          word: "震度",
          reading: "しんど",
          meaning: "Cường độ rung (thang Nhật 1-7)",
          jlptLevel: "N3",
          example: "東京で震度4の地震がありました。",
          exampleReading: "とうきょうでしんどよんのじしんがありました。",
          exampleMeaning: "Tokyo có động đất cường độ 4.",
          usageNote: "Thang Nhật khác Richter! 震度1-2 = nhẹ. 震度5+ = mạnh. 震度7 = catastrophic.",
        },
        {
          word: "津波注意報",
          reading: "つなみちゅういほう",
          meaning: "Lưu ý sóng thần",
          jlptLevel: "N3",
          example: "津波注意報が出ています。海岸に近づかないでください。",
          exampleReading: "つなみちゅういほうがでています。かいがんにちかづかないでください。",
          exampleMeaning: "Có lưu ý sóng thần. Đừng đến gần bờ biển.",
          usageNote: "注意報 < 警報 < 大津波警報. Nghe thấy → chạy lên cao NGAY. Không chờ.",
        },
        {
          word: "余震に注意",
          reading: "よしんにちゅうい",
          meaning: "Cẩn thận dư chấn",
          jlptLevel: "N3",
          example: "余震に注意してください。数日間は揺れが続く可能性があります。",
          exampleReading: "よしんにちゅういしてください。すうじつかんはゆれがつづくかのうせいがあります。",
          exampleMeaning: "Cẩn thận dư chấn. Có thể rung tiếp vài ngày.",
          usageNote: "余震 = aftershock. Đôi khi mạnh hơn trận đầu. Không chủ quan.",
        },
        {
          word: "非常持ち出し袋",
          reading: "ひじょうもちだしぶくろ",
          meaning: "Túi khẩn cấp (emergency bag)",
          jlptLevel: "N3",
          example: "非常持ち出し袋を玄関に置いておきましょう。",
          exampleReading: "ひじょうもちだしぶくろをげんかんにおいておきましょう。",
          exampleMeaning: "Để túi khẩn cấp ở lối vào nhé.",
          usageNote: "Bên trong: 水(3L), 食料(3日分), 懐中電灯, ラジオ, 充電器, 薬, 現金. Mua ở Amazon/Don Quijote.",
        },
      ],
    },
  },
  {
    slug: "crime-prevention-vocabulary",
    moduleConfigId: M_SAFETY,
    titleVi: "防犯 — Phòng chống tội phạm",
    titleJa: "防犯の基本用語",
    descriptionVi: "Từ vựng phòng tránh tội phạm + cách gọi cảnh sát ở Nhật.",
    recommendationReasonVi: "Nhật an toàn nhưng KHÔNG phải 100%. Biết cách bảo vệ mình.",
    category: "safety",
    visualTheme: "red_emergency",
    levelLabel: "N4-N3",
    estimatedMinutes: 4,
    priority: 188,
    metadata: {
      seed: true,
      skills: ["crime_prevention", "police_contact", "personal_safety"],
      contentGoal: "Biết cách phòng tránh tội phạm + liên hệ cảnh sát bằng tiếng Nhật.",
      usageNote: "Nhật an toàn hàng top nhưng vẫn có: 痴漢 (sàm sỡ trên tàu), 振り込め詐欺 (lừa chuyển khoản), ひったくり (giật đồ), 不審者 (người đáng nghi gần trường). Biết từ = tự bảo vệ.",
      japaneseExpressions: [
        {
          word: "110番に電話して",
          reading: "ひゃくとうばんにでんわして",
          meaning: "Gọi 110 (cảnh sát)",
          jlptLevel: "N4",
          example: "危ない！110番に電話して！",
          exampleReading: "あぶない！ひゃくとうばんにでんわして！",
          exampleMeaning: "Nguy hiểm! Gọi 110!",
          usageNote: "110 = cảnh sát. 119 = cứu thương + cứu hoả. Nói: 場所, 何が起きた, 自分の名前.",
        },
        {
          word: "不審者",
          reading: "ふしんしゃ",
          meaning: "Người đáng nghi",
          jlptLevel: "N3",
          example: "不審者を見かけたら、すぐに110番してください。",
          exampleReading: "ふしんしゃをみかけたら、すぐにひゃくとうばんしてください。",
          exampleMeaning: "Thấy người đáng nghi, gọi 110 ngay.",
          usageNote: "Trường học gửi mail 不審者情報 (info kẻ lạ gần trường). Chú ý khi có con nhỏ.",
        },
        {
          word: "詐欺に注意",
          reading: "さぎにちゅうい",
          meaning: "Cẩn thận lừa đảo",
          jlptLevel: "N3",
          example: "還付金詐欺に注意！ATMで操作しないでください。",
          exampleReading: "かんぷきんさぎにちゅうい！ATMでそうさしないでください。",
          exampleMeaning: "Cẩn thận lừa hoàn tiền! Đừng thao tác ATM theo hướng dẫn.",
          usageNote: "還付金詐欺 = giả danh quận nói 'được hoàn tiền, ra ATM thao tác'. Scam phổ biến #1.",
        },
        {
          word: "痴漢です！",
          reading: "ちかんです！",
          meaning: "Đồ biến thái! (hô khi bị sàm sỡ trên tàu)",
          jlptLevel: "N3",
          example: "痴漢です！誰か助けてください！",
          exampleReading: "ちかんです！だれかたすけてください！",
          exampleMeaning: "Biến thái! Ai đó giúp tôi!",
          usageNote: "Hô to + bấm nút 非常ボタン trên tàu. Xung quanh sẽ giúp. Không im lặng.",
        },
        {
          word: "交番",
          reading: "こうばん",
          meaning: "Đồn cảnh sát nhỏ (ở góc phố)",
          jlptLevel: "N4",
          example: "道に迷ったら交番で聞いてください。",
          exampleReading: "みちにまよったらこうばんできいてください。",
          exampleMeaning: "Lạc đường thì hỏi ở koban.",
          usageNote: "Koban = mini police box, khắp nơi. Hỏi đường, mất đồ, report đều OK. 24/7.",
        },
      ],
    },
  },
  {
    slug: "workplace-safety-vocabulary",
    moduleConfigId: M_WORK,
    titleVi: "労働安全 — An toàn lao động",
    titleJa: "職場の安全用語",
    descriptionVi: "Từ vựng an toàn lao động — bắt buộc biết nếu làm nhà máy/xây dựng.",
    recommendationReasonVi: "Làm nhà máy/工場/建設 phải biết từ an toàn. Không biết = tai nạn.",
    category: "safety",
    visualTheme: "red_emergency",
    levelLabel: "N4-N3",
    estimatedMinutes: 4,
    priority: 185,
    metadata: {
      seed: true,
      skills: ["workplace_safety", "factory_vocab", "industrial_terms"],
      contentGoal: "Biết 5 từ an toàn lao động bắt buộc — phòng tai nạn trong nhà máy.",
      usageNote: "Nhà máy Nhật coi trọng 安全 (an toàn) #1. Mỗi sáng có 朝礼 (chào sáng) + 安全確認. Tai nạn 0 = mục tiêu. Biết từ = tuân thủ = được đánh giá cao.",
      japaneseExpressions: [
        {
          word: "ヘルメット着用",
          reading: "ヘルメットちゃくよう",
          meaning: "Đội mũ bảo hộ (bắt buộc)",
          jlptLevel: "N3",
          example: "現場ではヘルメット着用が義務です。",
          exampleReading: "げんばではヘルメットちゃくようがぎむです。",
          exampleMeaning: "Tại công trường bắt buộc đội mũ bảo hộ.",
          usageNote: "着用 = mặc/đội. 義務 = bắt buộc. 安全靴 (あんぜんぐつ) = giày bảo hộ cũng bắt buộc.",
        },
        {
          word: "指差し確認",
          reading: "ゆびさしかくにん",
          meaning: "Xác nhận bằng chỉ tay + hô (kiểu Nhật)",
          jlptLevel: "N3",
          example: "よし！（指差し確認）安全確認！",
          exampleReading: "よし！（ゆびさしかくにん）あんぜんかくにん！",
          exampleMeaning: "OK! (chỉ tay xác nhận) An toàn OK!",
          usageNote: "Chỉ tay + nói to = giảm 80% lỗi. Nhà ga, nhà máy, xây dựng đều dùng. Very Japanese.",
        },
        {
          word: "ヒヤリハット",
          reading: "ヒヤリハット",
          meaning: "Suýt tai nạn (near-miss report)",
          jlptLevel: "N3",
          example: "ヒヤリハットを見つけたら報告してください。",
          exampleReading: "ヒヤリハットをみつけたらほうこくしてください。",
          exampleMeaning: "Phát hiện near-miss thì báo cáo.",
          usageNote: "ヒヤリ = giật mình. ハット = hốt hoảng. Báo cáo near-miss = ngăn tai nạn thật.",
        },
        {
          word: "安全第一",
          reading: "あんぜんだいいち",
          meaning: "An toàn là trên hết (Safety First)",
          jlptLevel: "N4",
          example: "当社は安全第一をモットーにしています。",
          exampleReading: "とうしゃはあんぜんだいいちをモットーにしています。",
          exampleMeaning: "Công ty chúng tôi lấy an toàn làm đầu.",
          usageNote: "Khẩu hiệu ở MỌI nhà máy/công trường. 安全第一, 品質第二, 生産第三.",
        },
        {
          word: "労災",
          reading: "ろうさい",
          meaning: "Tai nạn lao động / Bảo hiểm tai nạn LĐ",
          jlptLevel: "N2",
          example: "労災が認められれば、治療費は全額会社負担です。",
          exampleReading: "ろうさいがみとめられれば、ちりょうひはぜんがくかいしゃふたんです。",
          exampleMeaning: "Nếu được công nhận tai nạn LĐ, chi phí điều trị công ty chịu hết.",
          usageNote: "労災保険 = bảo hiểm tai nạn LĐ. Cover: điều trị, nghỉ việc, khuyết tật. BẮT BUỘC.",
        },
      ],
    },
  },
];

async function main() {
  const client = createClient();
  await client.connect();
  console.log("🚨 Seeding Safety & Emergency Expansion...");
  try {
    const result = await runBatch(client, cards, "Safety Expansion");
    console.log(`\n✅ Done. Total: ${result.success + result.failed} cards processed.`);
  } finally {
    await client.end();
  }
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
