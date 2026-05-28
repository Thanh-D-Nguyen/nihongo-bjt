/**
 * Seed Daily Japanese content for Vietnamese locale (vi).
 *
 * Run:  node scripts/seed-daily-content-vi.mjs
 *
 * Inserts vi-locale content items for every widget config,
 * so DailyRadar shows widget cards for Vietnamese learners too.
 */

import pg from "pg";
const { Client } = pg;

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:15432/nihongo_bjt";

const today = new Date().toISOString().slice(0, 10);
const locale = "vi";

const contentByKind = {
  time_greeting: {
    title: "Lời chào buổi chiều",
    japaneseText: "お疲れさまです",
    readingText: "おつかれさまです",
    explanationText:
      "Câu chào lịch sự dùng ở công ty sau buổi trưa. Nghĩa đen là 'bạn chắc mệt rồi' nhưng là lời chào đa năng giữa đồng nghiệp. Dùng khi đến, về hoặc gặp nhau ở công ty.",
    bodyMd:
      "## お疲れさまです (Otsukaresama desu)\n\nMột trong những cụm từ business Japanese quan trọng nhất:\n- Chào đồng nghiệp sau giờ trưa\n- Ghi nhận công sức của ai đó\n- Lời chào khi về cuối ngày\n\n> ⚠️ Đừng nhầm với ご苦労さま (gokurousama) — chỉ cấp trên dùng cho cấp dưới.",
  },
  weather: {
    title: "Thời tiết hôm nay — Trời tháng Năm",
    japaneseText: "五月晴れ",
    readingText: "さつきばれ",
    explanationText:
      "Bầu trời xanh trong đặc trưng tháng 5 ở Nhật. Ban đầu chỉ trời đẹp giữa mùa mưa (暦の五月), nay là thời tiết đẹp tháng 5. Là quý ngữ (季語) dùng trong haiku.",
    bodyMd:
      "## 五月晴れ (Satsuki-bare)\n\nTừ ghép đẹp:\n- 五月 (satsuki) — tháng 5 (cổ ngữ)\n- 晴れ (bare/hare) — trời đẹp\n\nDùng trong hội thoại:\n「今日は五月晴れですね」(Hôm nay trời tháng 5 đẹp quá nhỉ?)",
  },
  seasonal_word: {
    title: "Từ theo mùa — Gió thơm",
    japaneseText: "薫風",
    readingText: "くんぷう",
    explanationText:
      "Gió nhẹ đầu hè mang hương lá non. Từ văn chương (文語) thường dùng trong văn viết trang trọng và thơ truyền thống tháng 5.",
    bodyMd:
      "## 薫風 (Kunpū)\n\n- 薫 (kun) — thơm\n- 風 (pū/kaze) — gió\n\nVí dụ:\n「薫風が心地よい季節になりました」\n(Đã đến mùa gió thơm dễ chịu rồi.)\n\nThường dùng trong email business mở đầu theo mùa:\n「薫風の候、ますますご清栄のこととお喜び申し上げます」",
  },
  business_phrase: {
    title: "Cụm từ công sở — Đã hiểu ạ",
    japaneseText: "承知いたしました",
    readingText: "しょうちいたしました",
    explanationText:
      "Cách nói 'đã hiểu/rõ rồi' lịch sự nhất trong business Japanese. Kết hợp 承知 (xác nhận) + いたす (khiêm nhường). Trang trọng hơn 分かりました hay 了解しました.",
    bodyMd:
      "## 承知いたしました (Shōchi itashimashita)\n\nCác cấp độ lịch sự của 'đã hiểu':\n1. 分かった (thân mật)\n2. 分かりました (lịch sự)\n3. 了解しました (lịch sự, đôi khi bị coi là informal trong business)\n4. **承知しました** (tôn kính)\n5. **承知いたしました** (khiêm nhường nhất)\n\nDùng #4 hoặc #5 với khách hàng, cấp trên, và trong email.",
  },
  life_situation: {
    title: "Tiếng Nhật đời sống — Ở cửa hàng tiện lợi",
    japaneseText: "温めますか？",
    readingText: "あたためますか？",
    explanationText:
      "Bạn sẽ nghe câu này ở mọi konbini khi mua bento hoặc onigiri. Nhân viên hỏi có muốn hâm nóng không. Trả lời: はい、お願いします hoặc 大丈夫です.",
    bodyMd:
      "## 温めますか？ (Atatamemasu ka?)\n\nCác câu hay gặp ở konbini:\n- 「温めますか？」→ Hâm nóng nhé?\n- 「袋いりますか？」→ Cần túi không?\n- 「お箸つけますか？」→ Cho đũa nhé?\n- 「ポイントカードはお持ちですか？」→ Có thẻ point không?\n\nTrả lời nhanh:\n- はい、お願いします (Vâng, phiền anh/chị)\n- 大丈夫です / 結構です (Không cần ạ)",
  },
  life_housing: {
    title: "Tiếng Nhật nhà ở — Phân loại rác",
    japaneseText: "燃えるゴミ",
    readingText: "もえるゴミ",
    explanationText:
      "Rác đốt được — một trong các loại rác chính ở Nhật. Phân loại rác (分別) là bắt buộc. Thường có: 燃えるゴミ, 燃えないゴミ (không đốt được), 資源ゴミ (tái chế), 粗大ゴミ (đồ cồng kềnh).",
    bodyMd:
      "## 燃えるゴミ (Moeru gomi) — Rác đốt được\n\nCác loại rác ở Nhật:\n- 🔥 燃えるゴミ — đốt được (thức ăn thừa, giấy, gỗ)\n- 🧊 燃えないゴミ — không đốt được (gốm, thuỷ tinh, kim loại)\n- ♻️ 資源ゴミ — tái chế (chai PET, lon, báo)\n- 📦 粗大ゴミ — đồ cồng kềnh (nội thất, đồ điện)\n\n⚠️ Ngày thu gom khác nhau tuỳ khu. Kiểm tra 分別カレンダー (lịch phân loại) của khu bạn.",
  },
  life_banking: {
    title: "Tiếng Nhật ngân hàng — ATM",
    japaneseText: "お引き出し",
    readingText: "おひきだし",
    explanationText:
      "Rút tiền — nút bạn sẽ thấy trên màn hình ATM Nhật. Các từ ATM khác: お預け入れ (nạp tiền), お振り込み (chuyển khoản), 残高照会 (xem số dư). Nhiều ATM có chế độ tiếng Anh.",
    bodyMd:
      "## お引き出し (Ohikidashi) — Rút tiền\n\nTừ vựng trên màn hình ATM Nhật:\n- お引き出し — Rút tiền\n- お預け入れ — Nạp tiền\n- お振り込み — Chuyển khoản\n- 残高照会 — Xem số dư\n- 通帳記入 — Cập nhật sổ\n- 暗証番号 — Mã PIN\n\n💡 ATM konbini (セブン銀行, ローソン銀行) hỗ trợ thẻ quốc tế và có menu tiếng Anh.",
  },
  life_tax: {
    title: "Tiếng Nhật thuế — Khai thuế",
    japaneseText: "確定申告",
    readingText: "かくていしんこく",
    explanationText:
      "Khai thuế thu nhập hàng năm ở Nhật. Bắt buộc với freelancer, người có nhiều nguồn thu, hoặc muốn khấu trừ chi phí y tế. Thời gian: 16/2 – 15/3. Có thể khai online qua e-Tax.",
    bodyMd:
      "## 確定申告 (Kakutei shinkoku) — Khai thuế\n\nTừ vựng thuế quan trọng:\n- 確定申告 — khai thuế hàng năm\n- 源泉徴収 (gensen chōshū) — khấu trừ tại nguồn\n- 年末調整 (nenmatsu chōsei) — quyết toán cuối năm (nhân viên)\n- 控除 (kōjo) — khấu trừ\n- 医療費控除 — khấu trừ chi phí y tế\n- e-Tax — hệ thống khai thuế online\n\n📅 Thời hạn: 16 tháng 2 – 15 tháng 3 hàng năm.",
  },
};

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  try {
    // Ensure vi-locale widget configs exist (clone from ja if needed)
    const existingVi = await client.query(
      `SELECT widget_kind FROM daily.daily_widget_config WHERE locale = $1`,
      [locale]
    );
    const existingKinds = new Set(existingVi.rows.map((r) => r.widget_kind));

    for (const kind of Object.keys(contentByKind)) {
      if (!existingKinds.has(kind)) {
        // Clone config from ja locale
        const jaConfig = await client.query(
          `SELECT display_order, min_level, max_level, settings
           FROM daily.daily_widget_config WHERE widget_kind = $1 AND locale = 'ja' LIMIT 1`,
          [kind]
        );
        const ref = jaConfig.rows[0] ?? { display_order: 0, min_level: null, max_level: null, settings: "{}" };
        await client.query(
          `INSERT INTO daily.daily_widget_config
           (id, widget_kind, enabled, display_order, min_level, max_level, locale, settings, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, true, $2, $3, $4, $5, $6, NOW(), NOW())`,
          [kind, ref.display_order, ref.min_level, ref.max_level, locale, JSON.stringify(ref.settings)]
        );
        console.log(`  ✅ Created vi widget config: ${kind}`);
      }
    }

    // Get all vi-locale widget configs
    const configsResult = await client.query(
      `SELECT id, widget_kind FROM daily.daily_widget_config
       WHERE locale = $1 AND enabled = true ORDER BY display_order`,
      [locale]
    );
    console.log(`\nFound ${configsResult.rowCount} widget configs for locale=${locale}`);

    let inserted = 0;
    let skipped = 0;

    for (const config of configsResult.rows) {
      const content = contentByKind[config.widget_kind];
      if (!content) {
        console.log(`  ⏭  No content for: ${config.widget_kind}`);
        skipped++;
        continue;
      }

      const existing = await client.query(
        `SELECT id FROM daily.daily_content_item
         WHERE widget_kind = $1 AND content_date = $2 AND locale = $3 LIMIT 1`,
        [config.widget_kind, today, locale]
      );

      if (existing.rowCount > 0) {
        console.log(`  ⏭  Already exists: ${config.widget_kind}`);
        skipped++;
        continue;
      }

      await client.query(
        `INSERT INTO daily.daily_content_item
         (id, widget_config_id, widget_kind, content_date, locale, title,
          body_md, japanese_text, reading_text, explanation_text,
          source_provider, source_ref, payload, status, created_at, updated_at)
         VALUES (
           gen_random_uuid(), $1, $2, $3, $4, $5,
           $6, $7, $8, $9,
           'curated_seed', $10, '{}', 'published', NOW(), NOW()
         )`,
        [
          config.id,
          config.widget_kind,
          today,
          locale,
          content.title,
          content.bodyMd,
          content.japaneseText,
          content.readingText,
          content.explanationText,
          `seed-${config.widget_kind}-${today}`,
        ]
      );
      console.log(`  ✅ Inserted: ${config.widget_kind} — "${content.title}"`);
      inserted++;
    }

    console.log(`\n🎉 Done! Inserted: ${inserted}, Skipped: ${skipped}`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
