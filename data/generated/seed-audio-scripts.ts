/**
 * Seed accurate audioScript for LC/LR questions.
 *
 * Each audioScript is derived from the question's own prompt, scenario,
 * and correct answer — not from a shared template.
 *
 * Section types and their audio content:
 *   LC_SCENE      — Short dialogue matching the scene described in scenario
 *   LC_STATEMENT  — A single speaker's statement that the examinee must interpret
 *   LC_INTEGRATED — A longer monologue/dialogue (meeting, announcement, etc.)
 *   LR_SITUATION  — Short audio clip + on-screen document/notice
 *   LR_DOCUMENT   — Audio explanation referencing a written document
 *   LR_INTEGRATED — Combined audio + reading comprehension
 */

import { createPrismaClient } from "../../packages/database/src/index.js";

const prisma = createPrismaClient();

/* ------------------------------------------------------------------ */
/*  Audio script generators per section type                          */
/* ------------------------------------------------------------------ */

interface QuestionData {
  prompt: string;
  scenario: string | null;
  correctAnswer: string;
  options: { optionKey: string; text: string; isCorrect: boolean }[];
}

/**
 * LC_SCENE: Two speakers in a business situation.
 * The audioScript must contain the FULL prompt content (the dialogue/scene
 * that the examinee hears) so each question has a unique script.
 */
function generateLcScene(q: QuestionData): string {
  const scene = q.scenario || extractSceneFromPrompt(q.prompt);
  const { speakerA, speakerB } = extractSpeakers(scene);

  // The prompt itself IS the content that gets spoken in the exam.
  // We wrap it with scene context and question framing.
  return [
    `【場面】${scene}`,
    "",
    `${speakerA}：`,
    q.prompt,
    "",
    `（質問：この場面で、${speakerB}はどう答えるのが最も適切ですか。）`,
    "",
    `A. ${q.options[0]?.text || ""}`,
    `B. ${q.options[1]?.text || ""}`,
    `C. ${q.options[2]?.text || ""}`,
    `D. ${q.options[3]?.text || ""}`,
  ].join("\n");
}

/**
 * LC_STATEMENT: A single speaker makes a statement.
 */
function generateLcStatement(q: QuestionData): string {
  const scene = q.scenario || "";
  const { speakerA } = extractSpeakers(scene);

  return [
    `【場面】${scene}`,
    "",
    `${speakerA}：`,
    q.prompt,
    "",
    `（質問：この発言について、最も適切なものを選んでください。）`,
    "",
    `A. ${q.options[0]?.text || ""}`,
    `B. ${q.options[1]?.text || ""}`,
    `C. ${q.options[2]?.text || ""}`,
    `D. ${q.options[3]?.text || ""}`,
  ].join("\n");
}

/**
 * LC_INTEGRATED: Longer audio — meeting, announcement, speech.
 * The prompt often contains 【音声】 with inline audio content.
 */
function generateLcIntegrated(q: QuestionData): string {
  const scene = q.scenario || "";

  // The prompt IS the audio content for integrated listening.
  return [
    `【場面】${scene}`,
    "",
    q.prompt,
    "",
    `（選択肢）`,
    `A. ${q.options[0]?.text || ""}`,
    `B. ${q.options[1]?.text || ""}`,
    `C. ${q.options[2]?.text || ""}`,
    `D. ${q.options[3]?.text || ""}`,
  ].join("\n");
}

/**
 * LR_SITUATION: Audio + on-screen visual (notice, sign, form).
 */
function generateLrSituation(q: QuestionData): string {
  const scene = q.scenario || "";

  return [
    `【場面】${scene}`,
    "",
    `（音声と画面の内容）`,
    q.prompt,
    "",
    `（選択肢）`,
    `A. ${q.options[0]?.text || ""}`,
    `B. ${q.options[1]?.text || ""}`,
    `C. ${q.options[2]?.text || ""}`,
    `D. ${q.options[3]?.text || ""}`,
  ].join("\n");
}

/**
 * LR_DOCUMENT: Audio explanation + printed document on screen.
 */
function generateLrDocument(q: QuestionData): string {
  const scene = q.scenario || "";

  return [
    `【場面】${scene}`,
    "",
    `（資料と音声）`,
    q.prompt,
    "",
    `（選択肢）`,
    `A. ${q.options[0]?.text || ""}`,
    `B. ${q.options[1]?.text || ""}`,
    `C. ${q.options[2]?.text || ""}`,
    `D. ${q.options[3]?.text || ""}`,
  ].join("\n");
}

/**
 * LR_INTEGRATED: Combined listening + reading with multiple sources.
 */
function generateLrIntegrated(q: QuestionData): string {
  const scene = q.scenario || "";

  return [
    `【場面】${scene}`,
    "",
    `（音声と資料の内容）`,
    q.prompt,
    "",
    `（選択肢）`,
    `A. ${q.options[0]?.text || ""}`,
    `B. ${q.options[1]?.text || ""}`,
    `C. ${q.options[2]?.text || ""}`,
    `D. ${q.options[3]?.text || ""}`,
  ].join("\n");
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function extractSceneFromPrompt(prompt: string): string {
  const match = prompt.match(/^([^。]+。)/);
  return match ? match[1] : prompt.slice(0, 60);
}

function extractSpeakers(
  scene: string
): { speakerA: string; speakerB: string } {
  if (scene.includes("上司") && scene.includes("部下"))
    return { speakerA: "上司", speakerB: "部下" };
  if (scene.includes("取引先"))
    return { speakerA: "取引先", speakerB: "社員" };
  if (scene.includes("受付") && scene.includes("来客"))
    return { speakerA: "来客", speakerB: "受付" };
  if (scene.includes("客") || scene.includes("お客"))
    return { speakerA: "お客様", speakerB: "社員" };
  if (scene.includes("先輩"))
    return { speakerA: "先輩", speakerB: "後輩" };
  if (scene.includes("社長"))
    return { speakerA: "社長", speakerB: "社員" };
  if (scene.includes("同僚"))
    return { speakerA: "同僚A", speakerB: "同僚B" };
  if (scene.includes("電話"))
    return { speakerA: "相手", speakerB: "自分" };
  return { speakerA: "話者A", speakerB: "話者B" };
}

/* ------------------------------------------------------------------ */
/*  Router                                                             */
/* ------------------------------------------------------------------ */

const generators: Record<string, (q: QuestionData) => string> = {
  LC_SCENE: generateLcScene,
  LC_STATEMENT: generateLcStatement,
  LC_INTEGRATED: generateLcIntegrated,
  LR_SITUATION: generateLrSituation,
  LR_DOCUMENT: generateLrDocument,
  LR_INTEGRATED: generateLrIntegrated,
};

/* ------------------------------------------------------------------ */
/*  Main                                                               */
/* ------------------------------------------------------------------ */

async function main() {
  console.log("Loading LC/LR questions...");

  const questions = await prisma.bjtQuestion.findMany({
    where: {
      section: { code: { in: Object.keys(generators) } },
    },
    select: {
      id: true,
      prompt: true,
      scenario: true,
      section: { select: { code: true } },
      options: {
        select: { optionKey: true, text: true, isCorrect: true },
        orderBy: { optionKey: "asc" },
      },
    },
  });

  console.log(`Found ${questions.length} questions to update.`);

  let updated = 0;
  let errors = 0;

  for (const q of questions) {
    const gen = generators[q.section.code];
    if (!gen) continue;

    const correctOption = q.options.find((o) => o.isCorrect);
    const data: QuestionData = {
      prompt: q.prompt,
      scenario: q.scenario,
      correctAnswer: correctOption?.text || "",
      options: q.options,
    };

    try {
      const audioScript = gen(data);

      await prisma.bjtQuestion.update({
        where: { id: q.id },
        data: { audioScript },
      });
      updated++;
    } catch (e) {
      errors++;
      console.error(`Error updating ${q.id}:`, e);
    }
  }

  console.log(`\nDone: ${updated} updated, ${errors} errors`);

  // Verify uniqueness
  const all = await prisma.bjtQuestion.findMany({
    where: { audioScript: { not: null } },
    select: { audioScript: true },
  });
  const unique = new Set(all.map((a) => a.audioScript));
  console.log(`Unique audioScripts: ${unique.size} / ${all.length}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
