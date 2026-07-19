import {
  CHECKPOINT_ACTIVITY_COUNT,
  CONTENT_SCHEMA_VERSION,
  CONTENT_VERSION,
  CORE_ACTIVITY_COUNT,
  CORE_LESSONS_PER_WEEK,
  LEGACY_SLUG_SUFFIXES,
  REVIEW_ACTIVITY_COUNT,
  UNITS_PER_WEEK
} from "./constants.js";
import { answerKeyAt, placeCorrectOption, previousSeedKey, rotate } from "./helpers.js";
import { stableContentHash, stableUuid } from "./id-factory.js";
import type {
  ActivityType,
  FocusSeed,
  LessonActivity,
  LessonDocument,
  LevelBlueprint,
  ProductionLessonUnit,
  StimulusType,
  UnitType,
  WeekSeed
} from "../types.js";
import { ACTIVITY_TYPES } from "../types.js";

const REPLY_SETS: Record<LevelBlueprint["difficulty"], string[]> = {
  foundation: [
    "はい、わかりました。",
    "はい、確認します。",
    "はい、少し待ってください。",
    "すみません、もう一度お願いします。"
  ],
  elementary: [
    "承知しました。確認します。",
    "わかりました。後ほど連絡します。",
    "確認してから進めます。",
    "念のため、もう一度伺います。"
  ],
  intermediate: [
    "承知しました。確認のうえ、改めてご連絡します。",
    "かしこまりました。担当者にも共有します。",
    "内容を整理してから対応いたします。",
    "認識に相違がないか確認させてください。"
  ],
  "upper-intermediate": [
    "承知しました。影響範囲を確認したうえで対応方針をご連絡します。",
    "かしこまりました。優先順位を整理して関係者に共有します。",
    "現時点の前提を確認してから着手いたします。",
    "代替案も含めて検討し、改めてご相談します。"
  ],
  advanced: [
    "承知いたしました。論点とリスクを整理したうえで、判断材料をご提示します。",
    "かしこまりました。関係部門との合意形成を進め、結果をご報告します。",
    "前提条件を再確認し、実行可能性を精査いたします。",
    "影響を最小化する代替策を比較し、改めてご提案します。"
  ],
  executive: [
    "承知いたしました。利害関係者への影響と中長期的な含意を整理して付議します。",
    "かしこまりました。意思決定に必要な前提と不確実性を明示いたします。",
    "ガバナンス上の論点を精査し、実行責任を含めて再提案します。",
    "複数のシナリオを比較し、撤退基準も含めてご説明します。"
  ]
};

const UNIT_STAGES = [
  { ja: "表現の意味と場面を見分ける段階", vi: "nhận diện ý nghĩa và tình huống" },
  { ja: "相手の発言に応答する段階", vi: "phản hồi lời của đối phương" },
  { ja: "口頭表現を文書へ移す段階", vi: "chuyển biểu đạt nói sang văn viết" },
  { ja: "不自然な表現を修正する段階", vi: "sửa biểu đạt chưa tự nhiên" },
  { ja: "複数条件を含む実務ケースの段階", vi: "xử lý case thực tế có nhiều điều kiện" },
  { ja: "一週間の表現を比較して定着させる復習段階", vi: "so sánh và củng cố biểu đạt cả tuần" },
  {
    ja: "時間と役割を意識して判断するチェック段階",
    vi: "ra quyết định theo thời gian và vai trò trong checkpoint"
  }
] as const;

const STIMULUS_LABELS_JA: Record<StimulusType, string> = {
  dialogue: "会話",
  email: "メール",
  internal_chat: "社内チャット",
  memo: "業務メモ",
  telephone: "電話応対",
  meeting: "会議での発言",
  announcement: "社内通知",
  report: "業務報告",
  table: "業務表",
  policy: "社内規程",
  proposal: "提案書",
  complaint: "お客様からの申し出"
};

function buildStimulusText(blueprint: LevelBlueprint, week: WeekSeed, focus: FocusSeed): string {
  const speakerLine = `${blueprint.speakerRoleJa}：${focus.phraseJa}`;
  const replyLine = `${blueprint.counterpartRoleJa}：${blueprint.acknowledgementJa}`;
  switch (week.stimulusType) {
    case "email":
      return `件名：${week.themeJa}の確認\n${blueprint.counterpartRoleJa}各位\n${week.scenarioJa}\n${focus.phraseJa}\n${blueprint.closingJa}`;
    case "internal_chat":
      return `10:15 ${speakerLine}\n10:18 ${replyLine}`;
    case "memo":
      return `【業務メモ】\n件名：${week.themeJa}\n状況：${week.scenarioJa}\n対応：${focus.phraseJa}`;
    case "telephone":
      return `（電話）\n${speakerLine}\n${replyLine}`;
    case "meeting":
      return `議題：${week.themeJa}\n司会：では、担当者から共有してください。\n${speakerLine}\n${replyLine}`;
    case "announcement":
      return `【社内通知】${week.themeJa}\n対象：関係者各位\n${week.scenarioJa}\n${focus.phraseJa}`;
    case "report":
      return `業務報告：${week.themeJa}\n現状：${week.scenarioJa}\n判断・対応：${focus.phraseJa}`;
    case "table":
      return `項目｜内容\n案件｜${week.themeJa}\n現状｜${week.scenarioJa}\n次の対応｜${focus.phraseJa}`;
    case "policy":
      return `社内規程：${week.themeJa}\n適用場面：${week.scenarioJa}\n確認事項：${focus.phraseJa}`;
    case "proposal":
      return `提案名：${week.themeJa}\n背景：${week.scenarioJa}\n提案要旨：${focus.phraseJa}`;
    case "complaint":
      return `お客様からの申し出：${week.scenarioJa}\n担当者：${focus.phraseJa}\n${replyLine}`;
    case "dialogue":
      return `${speakerLine}\n${replyLine}`;
  }
}

function activityOrdinal(week: number, unitOrder: number, activityIndex: number): number {
  const weekOffset = (week - 1) * 43;
  if (unitOrder <= CORE_LESSONS_PER_WEEK)
    return weekOffset + (unitOrder - 1) * CORE_ACTIVITY_COUNT + activityIndex;
  if (unitOrder === 6) return weekOffset + 25 + activityIndex;
  return weekOffset + 33 + activityIndex;
}

function unitTypeAt(unitOrder: number): UnitType {
  if (unitOrder <= CORE_LESSONS_PER_WEEK) return "lesson";
  return unitOrder === 6 ? "review" : "checkpoint";
}

function activityCount(type: UnitType): number {
  if (type === "lesson") return CORE_ACTIVITY_COUNT;
  return type === "review" ? REVIEW_ACTIVITY_COUNT : CHECKPOINT_ACTIVITY_COUNT;
}

function activityTypeAt(unitOrder: number, activityIndex: number): ActivityType {
  const offset =
    unitOrder <= CORE_LESSONS_PER_WEEK ? (unitOrder - 1) * CORE_ACTIVITY_COUNT : unitOrder * 2;
  return ACTIVITY_TYPES[(offset + activityIndex) % ACTIVITY_TYPES.length] ?? "best_expression";
}

function buildActivity(
  blueprint: LevelBlueprint,
  week: WeekSeed,
  unitOrder: number,
  activityIndex: number
): LessonActivity {
  const focusIndex =
    unitOrder <= CORE_LESSONS_PER_WEEK
      ? (unitOrder - 1 + activityIndex) % week.focuses.length
      : activityIndex % week.focuses.length;
  const focus = week.focuses[focusIndex] as FocusSeed;
  const rotatedFocuses = rotate(week.focuses, focusIndex + 1);
  const type = activityTypeAt(unitOrder, activityIndex);
  const ordinal = activityOrdinal(week.week, unitOrder, activityIndex);
  const answer = answerKeyAt(ordinal);
  const replies = REPLY_SETS[blueprint.difficulty];
  const stage = UNIT_STAGES[unitOrder - 1] ?? UNIT_STAGES[0];
  const isListening =
    type === "speaker_intent" || type === "role_response" || week.stimulusType === "telephone";

  let correctText = focus.phraseJa;
  let distractors = rotatedFocuses.slice(0, 3).map((item) => item.phraseJa);
  let prompt = `${stage.ja}です。「${week.scenarioJa}」で、目的を明確に伝えるために最も適切な表現はどれですか。`;
  let promptVi = `Đây là bước ${stage.vi}. Trong tình huống “${week.scenarioVi}”, cách nói nào phù hợp nhất để ${focus.intentVi}?`;

  if (type === "role_response") {
    correctText = blueprint.acknowledgementJa;
    distractors = replies.filter((reply) => reply !== correctText).slice(0, 3);
    prompt = `${stage.ja}で、${blueprint.counterpartRoleJa}から「${focus.phraseJa}」と言われました。最も適切な応答を選んでください。`;
    promptVi = `Ở bước ${stage.vi}, ${blueprint.counterpartRoleJa} nói “${focus.phraseJa}”. Hãy chọn phản hồi phù hợp nhất với vai trò.`;
  } else if (type === "mini_case_inference" || type === "speaker_intent") {
    correctText = focus.intentVi;
    distractors = rotatedFocuses.slice(0, 3).map((item) => item.intentVi);
    prompt = `${stage.ja}です。発言「${focus.phraseJa}」で、話し手が最も達成したいことは何ですか。`;
    promptVi = `Ở bước ${stage.vi}, với phát ngôn “${focus.phraseJa}”, mục đích chính của người nói là gì?`;
  } else if (type === "fill_phrase") {
    prompt = `${stage.ja}です。${week.themeJa}の場面で必要な表現を完成させます。「＿＿＿＿」に入る最も自然な表現を選んでください。`;
    promptVi = `Ở bước ${stage.vi} trong ${week.themeVi}, cần ${focus.intentVi}. Hãy chọn biểu đạt tự nhiên nhất cho chỗ trống.`;
  } else if (type === "politeness_check" || type === "error_correction") {
    prompt = `${stage.ja}です。相手との立場の違いを踏まえ、失礼にならず意図を明確に伝えられる表現を選んでください。`;
    promptVi = `Ở bước ${stage.vi} với quan hệ ${week.relationship}, chọn cách nói vừa rõ ý vừa không thất lễ khi cần ${focus.intentVi}.`;
  } else if (type === "reading_comprehension" || type === "context_match") {
    prompt = `${stage.ja}です。次の${STIMULUS_LABELS_JA[week.stimulusType]}で「${focus.phraseJa}」を確認した後、取るべき行動として最も適切なものを選んでください。`;
    promptVi = `Ở bước ${stage.vi}, sau khi thấy “${focus.phraseJa}” trong ${week.stimulusType}, hãy chọn hành động phù hợp nhất.`;
  } else if (type === "sentence_order") {
    correctText = focus.phraseJa;
    prompt = `${stage.ja}です。意図を正確に伝えるため、語順と敬意の向きが自然になる完成文を選んでください。`;
    promptVi = `Ở bước ${stage.vi}, để ${focus.intentVi}, chọn câu hoàn chỉnh có trật tự từ và hướng kính ngữ tự nhiên.`;
  }

  const options = placeCorrectOption(
    correctText,
    distractors,
    answer,
    `Đúng vì biểu đạt này thực hiện chính xác mục đích “${focus.intentVi}” và phù hợp quan hệ ${week.relationship}.`,
    [
      "Có thể đúng ngữ pháp nhưng lệch mục đích giao tiếp cần đạt trong tình huống.",
      "Mức độ lịch sự hoặc phạm vi trách nhiệm không phù hợp với quan hệ giữa hai bên.",
      "Phản hồi chưa xử lý vấn đề hiện tại hoặc dễ tạo cách hiểu khác cho đối phương."
    ]
  );

  const stimulusText = buildStimulusText(blueprint, week, focus);
  return {
    id: `act-${blueprint.level.toLowerCase().replace("+", "plus")}-w${String(week.week).padStart(2, "0")}-u${unitOrder}-${String(activityIndex + 1).padStart(2, "0")}`,
    questionType: type,
    stimulusType: isListening ? "telephone" : week.stimulusType,
    scenarioJa: `${week.scenarioJa} ${stage.ja}として「${focus.phraseJa}」の使い方を判断します。`,
    scenarioVi: `${week.scenarioVi} Ở bước ${stage.vi}, câu này yêu cầu xử lý mục đích “${focus.intentVi}”.`,
    stimulusText,
    audioScript: isListening ? stimulusText : null,
    audioAssetStatus: isListening ? "tts_ready" : "not_required",
    audioUrl: null,
    audioProvider: isListening ? "browser_tts" : null,
    audioVoice: isListening ? "ja-JP-default" : null,
    audioVersion: isListening ? "tts-v1" : null,
    prompt,
    promptVi,
    options,
    answer,
    explanationJa: `この場面では「${focus.phraseJa}」が、相手との関係を保ちながら目的を明確に伝える表現です。`,
    explanationVi: `“${focus.phraseJa}” phù hợp nhất vì ${focus.nuanceVi}. Các lựa chọn khác không sai trong mọi hoàn cảnh, nhưng lệch vai trò, sắc thái hoặc hành động cần thiết ở đây.`,
    skillTag: week.skillTags[activityIndex % week.skillTags.length] ?? "business-communication",
    difficulty: blueprint.difficulty,
    businessTopic: week.businessTopic,
    relationship: week.relationship
  };
}

function buildDocument(
  blueprint: LevelBlueprint,
  week: WeekSeed,
  unitOrder: number,
  type: UnitType
): LessonDocument {
  const focus = week.focuses[Math.min(unitOrder - 1, week.focuses.length - 1)] as FocusSeed;
  const activities = Array.from({ length: activityCount(type) }, (_, index) =>
    buildActivity(blueprint, week, unitOrder, index)
  );
  const mode = type === "lesson" ? "guided" : type;
  const duration = type === "lesson" ? 25 : type === "review" ? 30 : 35;
  const selectedVocabulary =
    type === "lesson" ? rotate(week.vocabulary, unitOrder - 1).slice(0, 6) : week.vocabulary;
  const selectedGrammar =
    type === "lesson" ? rotate(week.grammar, unitOrder - 1).slice(0, 2) : week.grammar;

  return {
    schemaVersion: CONTENT_SCHEMA_VERSION,
    learningObjectives: [
      week.objectiveVi,
      `Nhận biết và sử dụng “${focus.phraseJa}” đúng vai trò, kênh giao tiếp và mức độ lịch sự.`,
      type === "lesson"
        ? "Hoàn thành hoạt động lựa chọn, phản hồi, sửa lỗi và suy luận trong một phiên học độc lập."
        : `Tổng hợp kiến thức tuần ${week.week} dưới áp lực ngữ cảnh gần với BJT.`
    ],
    workplaceScenario: {
      who: blueprint.speakerRoleJa,
      counterpart: blueprint.counterpartRoleJa,
      relationship: week.relationship,
      goalVi: focus.intentVi,
      problemVi: week.problemVi,
      desiredOutcomeVi: week.desiredOutcomeVi,
      contextJa: `${week.scenarioJa} 本時の焦点は「${focus.phraseJa}」です。`,
      contextVi: `${week.scenarioVi} Trọng tâm của đơn vị là “${focus.meaningVi}”.`
    },
    knowledgePoints: [
      `Trọng tâm: ${focus.phraseJa} — ${focus.meaningVi}.`,
      `Kênh giao tiếp: ${week.stimulusType}; quan hệ: ${week.relationship}.`,
      `Register mục tiêu của ${blueprint.level}: ${blueprint.register}.`
    ],
    vocabulary: selectedVocabulary,
    grammar: selectedGrammar,
    businessUsageVi: `Dùng trong ${week.themeVi} khi ${week.problemVi.toLowerCase()} Người học cần nêu hành động hoặc trách nhiệm đủ rõ, đồng thời giữ khoảng cách phù hợp với ${week.relationship}.`,
    examples: [
      {
        japanese: `${blueprint.speakerRoleJa}：${focus.phraseJa}`,
        vietnamese: `${blueprint.speakerRoleJa}: ${focus.meaningVi}.`,
        noteVi: focus.nuanceVi
      },
      {
        japanese: `${blueprint.counterpartRoleJa}：${blueprint.acknowledgementJa}`,
        vietnamese: `${blueprint.counterpartRoleJa}: Đã hiểu; sẽ xác nhận và phản hồi theo đúng trách nhiệm.`,
        noteVi: "Phản hồi không chỉ xác nhận đã nghe mà còn cho biết hành động tiếp theo."
      },
      {
        japanese: `${week.themeJa}の件、${focus.phraseJa}\n${blueprint.closingJa}`,
        vietnamese: `Về việc ${week.themeVi}: ${focus.meaningVi}.`,
        noteVi:
          "Khi chuyển sang văn viết, cần nêu rõ chủ đề trước rồi mới đưa yêu cầu hoặc kết luận."
      }
    ],
    nuanceNotesVi: [
      focus.nuanceVi,
      "Cùng một câu có thể thay đổi mức độ phù hợp tùy người nghe, thời điểm và trách nhiệm của người nói.",
      "Trong môi trường Nhật, nói giảm nhẹ không đồng nghĩa với né tránh: hành động tiếp theo vẫn phải cụ thể."
    ],
    politenessHierarchyVi: `Với quan hệ ${week.relationship}, ưu tiên ${blueprint.register}. Tránh dùng kính ngữ hướng sai chủ thể hoặc lịch sự quá mức khiến trách nhiệm trở nên mơ hồ.`,
    vietnameseLearnerPitfalls: [
      "Dịch từng chữ từ tiếng Việt và đặt chủ ngữ quá nhiều làm câu cứng, thiếu tự nhiên.",
      "Chỉ nói 「はい」 nhưng không xác nhận phạm vi, thời hạn hoặc bước tiếp theo.",
      `Dùng “${focus.phraseJa}” ở sai quan hệ quyền lực hoặc sai kênh giao tiếp.`
    ],
    activities,
    summaryVi: [
      `Nắm được mục đích và sắc thái của “${focus.phraseJa}”.`,
      `Phân biệt lựa chọn phù hợp trong chủ đề ${week.themeVi}.`,
      "Có thể xác nhận trách nhiệm và bước tiếp theo mà không làm mất thể diện của đối phương."
    ],
    analytics: {
      recommendationTopics: [week.businessTopic, week.stimulusType, week.relationship],
      skillTags: week.skillTags,
      expectedMinutes: duration,
      assessmentMode: mode
    }
  };
}

function slugFor(
  blueprint: LevelBlueprint,
  week: number,
  unitOrder: number,
  type: UnitType
): string {
  const level = blueprint.level.toLowerCase().replace("+", "plus");
  if (week === 1 && unitOrder <= CORE_LESSONS_PER_WEEK) {
    const suffix = LEGACY_SLUG_SUFFIXES[unitOrder - 1];
    return `${level}-${String(unitOrder).padStart(2, "0")}-${suffix}`;
  }
  const kind =
    type === "lesson"
      ? `l${String(unitOrder).padStart(2, "0")}`
      : type === "review"
        ? "review"
        : "checkpoint";
  return `${level}-w${String(week).padStart(2, "0")}-${kind}`;
}

function titleFor(week: WeekSeed, unitOrder: number, type: UnitType) {
  if (type === "review")
    return { ja: `${week.themeJa}：週間復習`, vi: `${week.themeVi}: Ôn tập tuần` };
  if (type === "checkpoint")
    return { ja: `${week.themeJa}：実務チェック`, vi: `${week.themeVi}: Checkpoint thực hành` };
  const focus = week.focuses[unitOrder - 1] as FocusSeed;
  return { ja: `${week.themeJa}：${focus.phraseJa}`, vi: `${week.themeVi}: ${focus.meaningVi}` };
}

export function buildLevelCurriculum(blueprint: LevelBlueprint): ProductionLessonUnit[] {
  return blueprint.weeks.flatMap((week) =>
    Array.from({ length: UNITS_PER_WEEK }, (_, offset) => {
      const unitOrder = offset + 1;
      const unitType = unitTypeAt(unitOrder);
      const seedKey = `bjt-lessons:v1:${blueprint.level}:w${String(week.week).padStart(2, "0")}:u${unitOrder}`;
      const title = titleFor(week, unitOrder, unitType);
      const lessonContent = buildDocument(blueprint, week, unitOrder, unitType);
      const estimatedDurationMin = lessonContent.analytics.expectedMinutes;
      const base = {
        id: stableUuid(seedKey),
        seedKey,
        levelCode: blueprint.level,
        weekNumber: week.week,
        unitType,
        unitOrder,
        sortOrder: (week.week - 1) * UNITS_PER_WEEK + unitOrder,
        slug: slugFor(blueprint, week.week, unitOrder, unitType),
        titleVi: title.vi,
        titleJa: title.ja,
        descriptionVi: `${week.scenarioVi} Trọng tâm là ${unitType === "lesson" ? week.focuses[unitOrder - 1]?.meaningVi : `tổng hợp ${week.themeVi}`}.`,
        descriptionJa: `${week.scenarioJa} ${unitType === "lesson" ? week.focuses[unitOrder - 1]?.phraseJa : `${week.themeJa}の内容を総合的に確認します。`}`,
        estimatedDurationMin,
        difficulty: blueprint.difficulty,
        skillTags: Array.from(new Set(week.skillTags)),
        businessTopics: [week.businessTopic],
        prerequisiteKeys: previousSeedKey(blueprint.level, week.week, unitOrder),
        lessonContent,
        contentVersion: CONTENT_VERSION,
        status: "active" as const
      };
      return { ...base, contentHash: stableContentHash(base) };
    })
  );
}
