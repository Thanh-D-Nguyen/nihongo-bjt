/**
 * Seed audioScript for LC (聴解) and LR (聴読解) questions.
 *
 * For LC questions: the audioScript is a dialogue/announcement that the learner
 * would "hear" in a real BJT exam. We derive it from scenario + prompt.
 *
 * For LR questions: the audioScript is a shorter audio cue that accompanies
 * a visual document (already shown via scenario/prompt).
 *
 * Strategy:
 * - LC_SCENE / LC_STATEMENT / LC_INTEGRATED → full dialogue script
 * - LR_SITUATION / LR_DOCUMENT / LR_INTEGRATED → narration/instruction script
 */
import { createPrismaClient } from "@nihongo-bjt/database";

const prisma = createPrismaClient();

// --- Dialogue templates for LC sections ---

const LC_SCENE_DIALOGUES = [
  (scenario: string) =>
    `【場面説明】${scenario}\n\n（効果音：オフィスの環境音）\n\n` +
    `男性：すみません、ちょっとお時間よろしいですか。\n` +
    `女性：はい、どうぞ。何でしょうか。\n` +
    `男性：先ほどの件について、少しご相談したいことがあるのですが。\n` +
    `女性：わかりました。では、会議室で話しましょう。`,
  (scenario: string) =>
    `【場面説明】${scenario}\n\n（効果音：電話の着信音）\n\n` +
    `女性：はい、お電話ありがとうございます。○○株式会社でございます。\n` +
    `男性：いつもお世話になっております。△△の山田と申します。\n` +
    `女性：山田様、いつもありがとうございます。`,
  (scenario: string) =>
    `【場面説明】${scenario}\n\n（効果音：会議室のドアが開く音）\n\n` +
    `部長：皆さん、お忙しいところ集まっていただきありがとうございます。\n` +
    `社員A：よろしくお願いいたします。\n` +
    `部長：早速ですが、今日の議題に入りたいと思います。`,
];

const LC_STATEMENT_DIALOGUES = [
  (scenario: string) =>
    `【アナウンス】\n\n` +
    `ただいまより、${scenario.replace(/。$/, "")}についてご案内いたします。\n` +
    `ご不明な点がございましたら、お気軽にお問い合わせください。`,
  (scenario: string) =>
    `【発言】\n\n` +
    `これから説明する内容をよく聞いてください。\n` +
    `${scenario}`,
  (scenario: string) =>
    `【報告】\n\n` +
    `本日の報告事項をお伝えします。\n` +
    `${scenario}\n` +
    `以上、ご確認をお願いいたします。`,
];

const LC_INTEGRATED_DIALOGUES = [
  (scenario: string) =>
    `【場面説明】${scenario}\n\n` +
    `（効果音：オフィスの環境音）\n\n` +
    `課長：では、次の議題に移ります。来月のスケジュールについてですが。\n` +
    `田中：はい、こちらの資料をご覧ください。\n` +
    `課長：なるほど。この点について、もう少し詳しく説明してもらえますか。\n` +
    `田中：はい、まず前提として……\n` +
    `課長：分かりました。では、この方針で進めましょう。`,
  (scenario: string) =>
    `【場面説明】${scenario}\n\n` +
    `（効果音：プレゼンのスライドが切り替わる音）\n\n` +
    `発表者：それでは、調査結果を報告いたします。\n` +
    `質問者：一点確認させてください。この数字は前年比でしょうか。\n` +
    `発表者：はい、前年同期比の数字でございます。\n` +
    `質問者：ありがとうございます。続けてください。`,
];

// --- Narration templates for LR sections ---

const LR_SITUATION_NARRATIONS = [
  (scenario: string) =>
    `【状況説明音声】\n\n` +
    `これから流れる音声を聞きながら、画面の資料を確認してください。\n\n` +
    `（ナレーション）${scenario}\n` +
    `資料の内容と合わせて、最も適切な答えを選んでください。`,
  (scenario: string) =>
    `【案内音声】\n\n` +
    `画面に表示されている情報をご覧ください。\n` +
    `${scenario}\n` +
    `以上の内容を踏まえて、質問に答えてください。`,
];

const LR_DOCUMENT_NARRATIONS = [
  (scenario: string) =>
    `【資料説明音声】\n\n` +
    `ただいまから、画面に表示されている文書について説明いたします。\n` +
    `${scenario}\n` +
    `この資料の内容に基づいて、質問に答えてください。`,
  (scenario: string) =>
    `【音声ガイド】\n\n` +
    `次の資料について音声で補足説明します。\n` +
    `${scenario}\n` +
    `画面の情報と合わせて判断してください。`,
];

const LR_INTEGRATED_NARRATIONS = [
  (scenario: string) =>
    `【総合問題音声】\n\n` +
    `これから流れる音声と、画面に表示される複数の資料を組み合わせて答えてください。\n\n` +
    `（ナレーション）${scenario}\n\n` +
    `上司：この件について、どう思いますか。\n` +
    `部下：資料を拝見しましたが、いくつか確認したい点があります。`,
  (scenario: string) =>
    `【総合聴読解】\n\n` +
    `画面の資料を見ながら、以下の音声を聞いてください。\n\n` +
    `${scenario}\n\n` +
    `担当者：それでは、この方針でよろしいでしょうか。\n` +
    `クライアント：もう一度確認させてください。`,
];

function pickTemplate(templates: Array<(s: string) => string>, seed: number): (s: string) => string {
  return templates[seed % templates.length]!;
}

function generateAudioScript(sectionCode: string, scenario: string | null, _prompt: string, index: number): string {
  const scn = scenario || "ビジネスの場面";

  switch (sectionCode) {
    case "LC_SCENE":
      return pickTemplate(LC_SCENE_DIALOGUES, index)(scn);
    case "LC_STATEMENT":
      return pickTemplate(LC_STATEMENT_DIALOGUES, index)(scn);
    case "LC_INTEGRATED":
      return pickTemplate(LC_INTEGRATED_DIALOGUES, index)(scn);
    case "LR_SITUATION":
      return pickTemplate(LR_SITUATION_NARRATIONS, index)(scn);
    case "LR_DOCUMENT":
      return pickTemplate(LR_DOCUMENT_NARRATIONS, index)(scn);
    case "LR_INTEGRATED":
      return pickTemplate(LR_INTEGRATED_NARRATIONS, index)(scn);
    default:
      return `【音声】\n${scn}`;
  }
}

async function main() {
  // Get all LC and LR questions that don't have audioScript yet
  const sections = await prisma.bjtTestSection.findMany({
    where: {
      OR: [
        { code: { startsWith: "LC" } },
        { code: { startsWith: "LR" } },
      ],
    },
    include: {
      questions: {
        where: { audioScript: null },
        select: { id: true, prompt: true, scenario: true },
      },
    },
  });

  let updated = 0;
  for (const section of sections) {
    for (let i = 0; i < section.questions.length; i++) {
      const q = section.questions[i]!;
      const audioScript = generateAudioScript(section.code, q.scenario, q.prompt, i);

      await prisma.bjtQuestion.update({
        where: { id: q.id },
        data: { audioScript },
      });
      updated++;
    }
  }

  console.log(`✅ Updated ${updated} questions with audioScript across ${sections.length} sections`);

  // Verify
  const counts = await prisma.$queryRawUnsafe<Array<{ code: string; total: bigint; has_audio: bigint }>>(
    `SELECT s.code,
            COUNT(*) AS total,
            COUNT(q.audio_script) AS has_audio
     FROM assessment.bjt_test_section s
     JOIN assessment.bjt_question q ON q.section_id = s.id
     WHERE s.code LIKE 'LC%' OR s.code LIKE 'LR%'
     GROUP BY s.code
     ORDER BY s.code`
  );
  console.log("\nAudio coverage:");
  for (const row of counts) {
    console.log(`  ${row.code}: ${row.has_audio}/${row.total} questions have audioScript`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
