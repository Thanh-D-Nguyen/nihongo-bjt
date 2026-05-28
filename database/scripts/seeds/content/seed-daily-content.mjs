/**
 * Seed production-quality Daily Japanese content for today.
 *
 * Run:  node scripts/seed-daily-content.mjs
 *
 * This inserts content items for every ja-locale widget config for today's date.
 * Also fixes the nhk_news widget kind to nhk_news_home so the NHK feed proxy works.
 */

import pg from "pg";
const { Client } = pg;

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:15432/nihongo_bjt";

const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
const locale = "ja";

// ─── Production-quality daily content ───

const contentByKind = {
  time_greeting: {
    title: "午後の挨拶",
    japaneseText: "お疲れさまです",
    readingText: "おつかれさまです",
    explanationText:
      "A polite greeting used in the workplace after noon. Literally means 'you must be tired' but functions as a versatile greeting among colleagues. Used when arriving, leaving, or passing someone at work.",
    bodyMd:
      "## お疲れさまです (Otsukaresama desu)\n\nOne of the most essential business Japanese phrases. Use it when:\n- Greeting colleagues after lunch\n- Acknowledging someone's hard work\n- As a farewell at the end of the workday\n\n> ⚠️ Don't confuse with ご苦労さま (gokurousama), which is used by superiors to subordinates.",
  },
  weather: {
    title: "今日の天気 — 五月晴れ",
    japaneseText: "五月晴れ",
    readingText: "さつきばれ",
    explanationText:
      "Clear blue skies typical of May in Japan. Originally referred to clear skies during the rainy season (旧暦五月), now commonly means beautiful May weather. A seasonal word (季語) used in haiku.",
    bodyMd:
      "## 五月晴れ (Satsuki-bare)\n\nA beautiful compound word:\n- 五月 (satsuki) — May (classical Japanese)\n- 晴れ (bare/hare) — clear weather\n\nPerfect for describing today's weather in conversation:\n「今日は五月晴れですね」(It's beautiful May weather today, isn't it?)",
  },
  seasonal_word: {
    title: "季節のことば — 薫風",
    japaneseText: "薫風",
    readingText: "くんぷう",
    explanationText:
      "A fragrant early-summer breeze carrying the scent of fresh green leaves. A refined literary word (文語) often used in formal writing and traditional poetry during May.",
    bodyMd:
      "## 薫風 (Kunpū)\n\n- 薫 (kun) — fragrant, aromatic\n- 風 (pū/kaze) — wind\n\nUsage example:\n「薫風が心地よい季節になりました」\n(The season of pleasant fragrant breezes has arrived.)\n\nOften appears in business letters as a seasonal greeting:\n「薫風の候、ますますご清栄のこととお喜び申し上げます」",
  },
  business_phrase: {
    title: "ビジネス表現 — 承知いたしました",
    japaneseText: "承知いたしました",
    readingText: "しょうちいたしました",
    explanationText:
      "The most polite way to say 'understood/acknowledged' in business Japanese. Combines 承知 (acknowledgment) with いたす (humble form of する). More formal than 分かりました or 了解しました.",
    bodyMd:
      "## 承知いたしました (Shōchi itashimashita)\n\nPoliteness levels of 'understood':\n1. 分かった (casual)\n2. 分かりました (polite)\n3. 了解しました (polite, sometimes seen as informal in strict business)\n4. **承知しました** (respectful)\n5. **承知いたしました** (most humble/formal)\n\nUse #4 or #5 with clients, superiors, and in email.",
  },
  life_situation: {
    title: "生活の日本語 — コンビニで",
    japaneseText: "温めますか？",
    readingText: "あたためますか？",
    explanationText:
      "You'll hear this at every convenience store when buying a bento or onigiri. The clerk asks if you want your food heated up in the microwave. Reply with はい、お願いします or 大丈夫です.",
    bodyMd:
      "## 温めますか？ (Atatamemasu ka?)\n\nConvenience store essential phrases:\n- 「温めますか？」→ Shall I heat this up?\n- 「袋いりますか？」→ Do you need a bag?\n- 「お箸つけますか？」→ Shall I include chopsticks?\n- 「ポイントカードはお持ちですか？」→ Do you have a point card?\n\nQuick replies:\n- はい、お願いします (Yes, please)\n- 大丈夫です / 結構です (No, thank you)",
  },
  life_housing: {
    title: "住まいの日本語 — ゴミの分別",
    japaneseText: "燃えるゴミ",
    readingText: "もえるゴミ",
    explanationText:
      "Burnable garbage — one of Japan's main waste categories. Trash sorting (分別) is mandatory. Categories vary by city but typically include: 燃えるゴミ, 燃えないゴミ (non-burnable), 資源ゴミ (recyclables), and 粗大ゴミ (oversized items).",
    bodyMd:
      "## 燃えるゴミ (Moeru gomi) — Burnable Trash\n\nJapan's garbage sorting categories:\n- 🔥 燃えるゴミ — burnable (food waste, paper, wood)\n- 🧊 燃えないゴミ — non-burnable (ceramics, glass, metals)\n- ♻️ 資源ゴミ — recyclables (PET bottles, cans, newspapers)\n- 📦 粗大ゴミ — oversized items (furniture, appliances)\n\n⚠️ Collection days vary by neighborhood. Check your local 分別カレンダー (sorting calendar).",
  },
  life_banking: {
    title: "銀行の日本語 — ATM操作",
    japaneseText: "お引き出し",
    readingText: "おひきだし",
    explanationText:
      "Withdrawal — the button you'll see on Japanese ATM screens. Other common ATM terms: お預け入れ (deposit), お振り込み (transfer), 残高照会 (balance inquiry). Many ATMs have English mode available.",
    bodyMd:
      "## お引き出し (Ohikidashi) — Withdrawal\n\nJapanese ATM screen vocabulary:\n- お引き出し — Withdrawal\n- お預け入れ — Deposit\n- お振り込み — Transfer\n- 残高照会 — Balance inquiry\n- 通帳記入 — Passbook update\n- 暗証番号 — PIN number\n\n💡 Tip: Most convenience store ATMs (セブン銀行, ローソン銀行) support international cards and have English menus.",
  },
  life_tax: {
    title: "税金の日本語 — 確定申告",
    japaneseText: "確定申告",
    readingText: "かくていしんこく",
    explanationText:
      "Annual tax return filing in Japan. Required for freelancers, those with multiple income sources, or claiming medical expense deductions. Filing period: Feb 16 – Mar 15. Can be done online via e-Tax.",
    bodyMd:
      "## 確定申告 (Kakutei shinkoku) — Tax Return\n\nKey tax vocabulary:\n- 確定申告 — annual tax return\n- 源泉徴収 (gensen chōshū) — tax withholding\n- 年末調整 (nenmatsu chōsei) — year-end adjustment (for employees)\n- 控除 (kōjo) — deduction\n- 医療費控除 — medical expense deduction\n- e-Tax — online filing system\n\n📅 Filing period: February 16 – March 15 each year.",
  },
};

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  try {
    // 1. Revert nhk_news_home → nhk_news if previously mis-renamed
    const nhkFixResult = await client.query(
      `UPDATE daily.daily_widget_config
       SET widget_kind = 'nhk_news'
       WHERE widget_kind = 'nhk_news_home' AND locale = $1
       RETURNING id, widget_kind`,
      [locale]
    );
    if (nhkFixResult.rowCount > 0) {
      console.log(
        `✅ Reverted NHK widget kind: nhk_news_home → nhk_news (${nhkFixResult.rows[0].id})`
      );
    } else {
      console.log("ℹ️  NHK widget kind already correct (nhk_news)");
    }

    // 2. Get all widget configs for ja locale
    const configsResult = await client.query(
      `SELECT id, widget_kind FROM daily.daily_widget_config
       WHERE locale = $1 AND enabled = true
       ORDER BY display_order`,
      [locale]
    );

    console.log(
      `\nFound ${configsResult.rowCount} widget configs for locale=${locale}`
    );

    // 3. Seed content items for today
    let inserted = 0;
    let skipped = 0;

    for (const config of configsResult.rows) {
      const content = contentByKind[config.widget_kind];
      if (!content) {
        console.log(`  ⏭  No seed content for kind: ${config.widget_kind}`);
        skipped++;
        continue;
      }

      // Check if already exists for today
      const existing = await client.query(
        `SELECT id FROM daily.daily_content_item
         WHERE widget_kind = $1 AND content_date = $2 AND locale = $3
         LIMIT 1`,
        [config.widget_kind, today, locale]
      );

      if (existing.rowCount > 0) {
        console.log(
          `  ⏭  Already exists: ${config.widget_kind} (${existing.rows[0].id})`
        );
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

    console.log(
      `\n🎉 Done! Inserted: ${inserted}, Skipped: ${skipped + (configsResult.rowCount - inserted - skipped)} (already exist or no content)`
    );
    console.log(`\nVerify: curl http://localhost:4000/api/daily/home?locale=ja`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
