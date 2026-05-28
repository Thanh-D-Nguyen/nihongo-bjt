// Seed BJT lessons — distributes existing vocab + grammar into themed lessons per level.
// Usage: node scripts/seed-bjt-lessons.mjs

import pg from 'pg';

const DB = 'postgresql://postgres:postgres@127.0.0.1:15432/nihongo_bjt';

// Lesson themes per level (applicable to all levels)
const LESSON_THEMES = [
  { order: 1, slug: 'greetings-intro',    titleVi: 'Chào hỏi & Tự giới thiệu',       titleJa: '挨拶と自己紹介',             descVi: 'Các cụm từ chào hỏi và tự giới thiệu trong môi trường công sở.' },
  { order: 2, slug: 'office-daily',       titleVi: 'Giao tiếp văn phòng hàng ngày',   titleJa: 'オフィスの日常会話',          descVi: 'Từ vựng và mẫu câu dùng hàng ngày tại văn phòng.' },
  { order: 3, slug: 'email-writing',      titleVi: 'Viết email công việc',             titleJa: 'ビジネスメール',             descVi: 'Cách viết email tiếng Nhật trong công việc: mở đầu, thân, kết thúc.' },
  { order: 4, slug: 'meeting-discussion', titleVi: 'Họp & Thảo luận',                 titleJa: '会議とディスカッション',      descVi: 'Từ vựng và ngữ pháp dùng trong cuộc họp, báo cáo, thảo luận.' },
  { order: 5, slug: 'numbers-data',       titleVi: 'Số liệu & Báo cáo',              titleJa: '数字とレポート',             descVi: 'Cách đọc số, trình bày dữ liệu, mô tả xu hướng trong báo cáo.' },
];

// BJT levels → JLPT mapping
const LEVEL_JLPT = {
  'J5': 'N5', 'J4': 'N4', 'J3': 'N3', 'J2': 'N2', 'J1': 'N1', 'J1+': 'N1',
};

const LEVEL_KANJI = {
  'J5': 5, 'J4': 4, 'J3': 3, 'J2': 2, 'J1': 1, 'J1+': 1,
};

const LESSON_ITEM_CAPS = {
  vocabulary: 28,
  kanji: 14,
  grammar: 10,
};

function slugLevelCode(levelCode) {
  return levelCode.toLowerCase().replace('+', 'plus');
}

async function insertLessonItem(client, lessonId, contentType, contentId, sortOrder) {
  const result = await client.query(
    `INSERT INTO curriculum.bjt_lesson_item (lesson_id, content_type, content_id, sort_order)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (lesson_id, content_type, content_id) DO NOTHING`,
    [lessonId, contentType, contentId, sortOrder]
  );
  return result.rowCount;
}

async function main() {
  const client = new pg.Client(DB);
  await client.connect();

  let totalLessons = 0;
  let totalItems = 0;

  for (const [levelCode, jlptLevel] of Object.entries(LEVEL_JLPT)) {
    console.log(`\n── ${levelCode} (${jlptLevel}) ──`);

    // Fetch vocab for this level
    const vocabRes = await client.query(
      `SELECT id FROM content.lexeme WHERE status='active' AND jlpt_level=$1 ORDER BY headword`,
      [jlptLevel]
    );
    const vocabIds = vocabRes.rows.map(r => r.id);

    // Fetch grammar for this level
    const grammarRes = await client.query(
      `SELECT id FROM content.grammar_point WHERE status='active' AND jlpt_level=$1 ORDER BY pattern`,
      [jlptLevel]
    );
    const grammarIds = grammarRes.rows.map(r => r.id);

    const kanjiRes = await client.query(
      `SELECT id FROM content.kanji WHERE status='active' AND level=$1 ORDER BY frequency NULLS LAST, character`,
      [LEVEL_KANJI[levelCode]]
    );
    const kanjiIds = kanjiRes.rows.map(r => r.id);

    console.log(`  Found: ${vocabIds.length} vocab, ${kanjiIds.length} kanji, ${grammarIds.length} grammar`);

    const lessonCount = LESSON_THEMES.length;
    const vocabPerLesson = Math.ceil(vocabIds.length / lessonCount);
    const kanjiPerLesson = Math.ceil(kanjiIds.length / lessonCount);
    const grammarPerLesson = Math.ceil(grammarIds.length / lessonCount);

    for (let i = 0; i < LESSON_THEMES.length; i++) {
      const theme = LESSON_THEMES[i];
      const slug = `${slugLevelCode(levelCode)}-${String(theme.order).padStart(2, '0')}-${theme.slug}`;

      // Check if lesson exists
      const existing = await client.query(
        `SELECT id FROM curriculum.bjt_lesson WHERE slug=$1`,
        [slug]
      );

      let lessonId;
      let insertedLesson = false;

      if (existing.rows.length > 0) {
        lessonId = existing.rows[0].id;
      } else {
        const lessonRes = await client.query(
          `INSERT INTO curriculum.bjt_lesson (level_code, sort_order, slug, title_vi, title_ja, description_vi, description_ja, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING id`,
          [levelCode, theme.order, slug, theme.titleVi, theme.titleJa, theme.descVi, theme.titleJa]
        );
        lessonId = lessonRes.rows[0].id;
        insertedLesson = true;
        totalLessons++;
      }

      // Lessons are guided modules, not encyclopedic dumps. Keep them learnable;
      // the full level catalog remains available through /levels/:code tabs.
      await client.query(`DELETE FROM curriculum.bjt_lesson_item WHERE lesson_id=$1`, [lessonId]);

      const lessonVocab = vocabIds
        .slice(i * vocabPerLesson, (i + 1) * vocabPerLesson)
        .slice(0, LESSON_ITEM_CAPS.vocabulary);
      const lessonKanji = kanjiIds
        .slice(i * kanjiPerLesson, (i + 1) * kanjiPerLesson)
        .slice(0, LESSON_ITEM_CAPS.kanji);
      const lessonGrammar = grammarIds
        .slice(i * grammarPerLesson, (i + 1) * grammarPerLesson)
        .slice(0, LESSON_ITEM_CAPS.grammar);
      let insertedItems = 0;
      let sortOrder = 1;

      for (let j = 0; j < lessonVocab.length; j++) {
        insertedItems += await insertLessonItem(client, lessonId, 'vocabulary', lessonVocab[j], sortOrder++);
      }

      for (let h = 0; h < lessonKanji.length; h++) {
        insertedItems += await insertLessonItem(client, lessonId, 'kanji', lessonKanji[h], sortOrder++);
      }

      for (let k = 0; k < lessonGrammar.length; k++) {
        insertedItems += await insertLessonItem(client, lessonId, 'grammar', lessonGrammar[k], sortOrder++);
      }
      totalItems += insertedItems;

      console.log(
        `  ${insertedLesson ? '✅' : '↻'} ${slug}: ${insertedItems} new items (${lessonVocab.length} vocab + ${lessonKanji.length} kanji + ${lessonGrammar.length} grammar)`
      );
    }
  }

  console.log(`\n✅ Done! ${totalLessons} lessons, ${totalItems} items seeded.`);
  await client.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
