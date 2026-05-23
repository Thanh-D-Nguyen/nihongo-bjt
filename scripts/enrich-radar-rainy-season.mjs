/**
 * Enrich the "rainy-season-words" radar card with production-quality vocabulary data.
 * Run: node scripts/enrich-radar-rainy-season.mjs
 */
import pg from "pg";

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:15432/nihongo_bjt";

const enrichedMetadata = {
  seed: true,
  skills: ["seasonal_vocab", "small_talk", "weather_conversation"],
  comingSoon: false,
  contentGoal:
    "Nắm vững 6 từ vựng mùa mưa phổ biến nhất để giao tiếp small talk tự nhiên với đồng nghiệp người Nhật.",
  weatherType: "rain",
  disclaimerRequired: false,
  usageNote:
    "Mùa mưa (梅雨) kéo dài từ giữa tháng 6 đến giữa tháng 7. Đây là chủ đề small talk phổ biến nhất tại công sở Nhật trong giai đoạn này. Biết dùng đúng từ sẽ giúp bạn hoà nhập tự nhiên hơn.",
  japaneseExpressions: [
    {
      word: "梅雨",
      reading: "つゆ",
      meaning: "Mùa mưa (tháng 6–7 ở Nhật)",
      jlptLevel: "N3",
      example: "今年の梅雨は長いですね。",
      exampleReading: "ことしのつゆはながいですね。",
      exampleMeaning: "Năm nay mùa mưa dài nhỉ.",
      usageNote: "Dùng khi bắt chuyện về thời tiết. Rất tự nhiên khi nói với đồng nghiệp.",
    },
    {
      word: "湿気",
      reading: "しっけ",
      meaning: "Độ ẩm, hơi ẩm",
      jlptLevel: "N3",
      example: "湿気がすごくて、髪がまとまらない。",
      exampleReading: "しっけがすごくて、かみがまとまらない。",
      exampleMeaning: "Độ ẩm cao quá, tóc không vào nếp được.",
      usageNote: "Thường dùng kèm すごい hoặc ひどい để diễn tả mức độ.",
    },
    {
      word: "蒸し暑い",
      reading: "むしあつい",
      meaning: "Nóng oi, oi bức (nóng + ẩm)",
      jlptLevel: "N3",
      example: "今日は蒸し暑いから、半袖にしよう。",
      exampleReading: "きょうはむしあついから、はんそでにしよう。",
      exampleMeaning: "Hôm nay oi bức nên mặc áo ngắn tay thôi.",
      usageNote: "Khác với 暑い (nóng đơn thuần). 蒸し暑い nhấn mạnh cảm giác ẩm + nóng.",
    },
    {
      word: "傘を持っていく",
      reading: "かさをもっていく",
      meaning: "Mang theo ô/dù",
      jlptLevel: "N4",
      example: "午後から雨らしいよ。傘を持っていったほうがいいよ。",
      exampleReading: "ごごからあめらしいよ。かさをもっていったほうがいいよ。",
      exampleMeaning: "Nghe nói chiều sẽ mưa đó. Nên mang theo ô đi.",
      usageNote: "Câu gợi ý tự nhiên cho đồng nghiệp. Thể hiện sự quan tâm.",
    },
    {
      word: "天気予報",
      reading: "てんきよほう",
      meaning: "Dự báo thời tiết",
      jlptLevel: "N4",
      example: "天気予報で明日は晴れって言ってたよ。",
      exampleReading: "てんきよほうであしたははれっていってたよ。",
      exampleMeaning: "Dự báo thời tiết nói mai trời nắng đó.",
      usageNote: "Rất hay dùng trong câu chuyện nhỏ buổi sáng ở công ty.",
    },
    {
      word: "じめじめする",
      reading: "じめじめする",
      meaning: "Ẩm ướt, ẩm thấp (cảm giác khó chịu)",
      jlptLevel: "N3",
      example: "梅雨の時期はじめじめして嫌ですね。",
      exampleReading: "つゆのじきはじめじめしていやですね。",
      exampleMeaning: "Mùa mưa ẩm ướt khó chịu nhỉ.",
      usageNote: "Từ tượng thanh/tượng hình. Diễn tả cảm giác ẩm ướt bám trên da, quần áo.",
    },
  ],
};

async function main() {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();

  try {
    const result = await client.query(
      `UPDATE daily.daily_radar_card
       SET metadata = $1::jsonb,
           title_ja = '梅雨の日本語 — 雨の季節のことば',
           updated_at = NOW()
       WHERE slug = 'rainy-season-words'
       RETURNING id, slug`,
      [JSON.stringify(enrichedMetadata)]
    );

    if (result.rowCount === 0) {
      console.error("❌ Card 'rainy-season-words' not found in database.");
      process.exit(1);
    }

    console.log(`✅ Enriched card: ${result.rows[0].slug} (id: ${result.rows[0].id})`);
    console.log(`   → ${enrichedMetadata.japaneseExpressions.length} expressions with reading + meaning + examples`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
