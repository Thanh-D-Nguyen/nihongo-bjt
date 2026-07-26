/**
 * Original BJT-style full mock content.
 *
 * This dataset intentionally does not copy official BJT sample questions.
 * It produces three stable 80-question forms spanning the complete
 * 0-800 estimated-score range. Listening and listening-reading items always
 * include an authored transcript. Visual items always include accessible
 * Japanese alt text and an English image-generation brief.
 */

import { FORM_B_SIGNATURE_OVERRIDES, FORM_C_SECTION_DRAFTS } from "./official-mock-form-c-data.js";

export const OFFICIAL_MOCK_PROVENANCE = "nihongo-bjt-original-full-mock-v1";
export const OFFICIAL_MOCK_LICENSE = "original-internal-production-content";
export const OFFICIAL_BJT_FORMAT_REFERENCE = {
  purpose: "exam-structure-reference-only",
  sourceName: "BJT Business Japanese Proficiency Test",
  sourceUrl: "https://www.kanken.or.jp/bjt/english/about/feature.html"
} as const;

export const MOCK_FORM_COUNT = 3;
export const QUESTIONS_PER_MOCK = 80;
export const MOCK_TIME_LIMIT_SECONDS = 6_300;

export const OFFICIAL_SECTION_SPECS = [
  {
    code: "LC_SCENE",
    part: "listening",
    titleJa: "第1部 聴解・場面把握問題",
    titleVi: "Phần I · Nghe hiểu tình huống",
    questionCount: 5,
    timeLimitSec: 600,
    stimulusKind: "photo"
  },
  {
    code: "LC_STATEMENT",
    part: "listening",
    titleJa: "第1部 聴解・発言聴解問題",
    titleVi: "Phần I · Nghe hiểu phát ngôn",
    questionCount: 10,
    timeLimitSec: 900,
    stimulusKind: "audio"
  },
  {
    code: "LC_INTEGRATED",
    part: "listening",
    titleJa: "第1部 聴解・総合聴解問題",
    titleVi: "Phần I · Nghe hiểu tổng hợp",
    questionCount: 10,
    timeLimitSec: 1_200,
    stimulusKind: "illustration"
  },
  {
    code: "LR_SITUATION",
    part: "listening_reading",
    titleJa: "第2部 聴読解・状況把握問題",
    titleVi: "Phần II · Nghe-đọc tình huống",
    questionCount: 5,
    timeLimitSec: 600,
    stimulusKind: "photo"
  },
  {
    code: "LR_DOCUMENT",
    part: "listening_reading",
    titleJa: "第2部 聴読解・資料聴読解問題",
    titleVi: "Phần II · Nghe-đọc tài liệu",
    questionCount: 10,
    timeLimitSec: 600,
    stimulusKind: "chart"
  },
  {
    code: "LR_INTEGRATED",
    part: "listening_reading",
    titleJa: "第2部 聴読解・総合聴読解問題",
    titleVi: "Phần II · Nghe-đọc tổng hợp",
    questionCount: 10,
    timeLimitSec: 600,
    stimulusKind: "document"
  },
  {
    code: "RC_VOCAB_GRAMMAR",
    part: "reading",
    titleJa: "第3部 読解・語彙文法問題",
    titleVi: "Phần III · Từ vựng và ngữ pháp",
    questionCount: 10,
    timeLimitSec: 600,
    stimulusKind: "text"
  },
  {
    code: "RC_EXPRESSION",
    part: "reading",
    titleJa: "第3部 読解・表現読解問題",
    titleVi: "Phần III · Đọc hiểu biểu đạt",
    questionCount: 10,
    timeLimitSec: 600,
    stimulusKind: "text"
  },
  {
    code: "RC_INTEGRATED",
    part: "reading",
    titleJa: "第3部 読解・総合読解問題",
    titleVi: "Phần III · Đọc hiểu tổng hợp",
    questionCount: 10,
    timeLimitSec: 600,
    stimulusKind: "document"
  }
] as const;

type SectionCode = (typeof OFFICIAL_SECTION_SPECS)[number]["code"];
type Difficulty = "easy" | "standard" | "hard";
type OptionKey = "A" | "B" | "C" | "D";

export type OfficialMockOption = {
  key: OptionKey;
  text: string;
  isCorrect: boolean;
};

export type OfficialMockQuestion = {
  prompt: string;
  scenario: string | null;
  audioScript: string | null;
  imageAlt: string | null;
  imagePrompt: string | null;
  explanationVi: string;
  skillTag: string;
  difficulty: Difficulty;
  businessSituation: string;
  stimulusKind: string;
  tags: string[];
  options: [OfficialMockOption, OfficialMockOption, OfficialMockOption, OfficialMockOption];
};

export type OfficialMockSection = {
  code: SectionCode;
  titleJa: string;
  titleVi: string;
  displayOrder: number;
  questions: OfficialMockQuestion[];
};

export type OfficialMockForm = {
  slug: string;
  titleJa: string;
  titleVi: string;
  description: string;
  type: "official";
  status: "published";
  level: null;
  timeLimitSeconds: number;
  sections: OfficialMockSection[];
  blueprintMeta: {
    examFormat: "bjt-full-simulation";
    scoreLabel: "estimated";
    scoreRange: { min: 0; max: 800 };
    bandMapping: Array<{ band: string; min: number; max: number }>;
    totalQuestions: number;
    totalTimeSeconds: number;
    parts: Array<{
      code: string;
      questionCount: number;
      timeLimitSec: number;
      sections: string[];
    }>;
    contentVersion: string;
    reference: typeof OFFICIAL_BJT_FORMAT_REFERENCE;
  };
};

type ChoiceSet = {
  correct: string;
  distractors: readonly [string, string, string];
};

type QuestionDraft = Omit<OfficialMockQuestion, "difficulty" | "options" | "tags"> & {
  choices: ChoiceSet;
  tags?: string[];
};

const FORM_LABELS = ["A", "B", "C"] as const;
const COMPANY_NAMES = ["青葉商事", "みらい物流", "東都テクノ"] as const;
const PRODUCT_NAMES = ["在庫管理クラウド", "省電力センサー", "勤怠管理アプリ"] as const;
const PERSON_NAMES = ["田中", "佐藤", "鈴木"] as const;

function pick<T>(values: readonly [T, T, T], formIndex: number): T {
  return values[formIndex]!;
}

function rotateChoices(
  choices: ChoiceSet,
  correctIndex: number
): [OfficialMockOption, OfficialMockOption, OfficialMockOption, OfficialMockOption] {
  const keys: OptionKey[] = ["A", "B", "C", "D"];
  const texts = [...choices.distractors];
  texts.splice(correctIndex, 0, choices.correct);
  return keys.map((key, index) => ({
    key,
    text: texts[index]!,
    isCorrect: index === correctIndex
  })) as [OfficialMockOption, OfficialMockOption, OfficialMockOption, OfficialMockOption];
}

function difficultyFor(globalQuestionIndex: number): Difficulty {
  return (["easy", "standard", "standard", "hard"] as const)[globalQuestionIndex % 4]!;
}

const EXACT_VISUAL_DATA_PATTERN =
  /画面|表示|書かれ|札|カード|ボタン|温度|警告|標識|看板|ホワイトボード/u;

function visualStimulusKind(sectionCode: SectionCode, scenario: string, fallback: string): string {
  if (sectionCode === "LC_INTEGRATED" || sectionCode === "LR_SITUATION") return "diagram";
  if (sectionCode === "LC_SCENE" && EXACT_VISUAL_DATA_PATTERN.test(scenario)) return "diagram";
  return fallback;
}

function visualFields(
  sectionCode: SectionCode,
  scenario: string,
  stimulusKind: string,
  formIndex: number,
  questionNo: number
): Pick<OfficialMockQuestion, "imageAlt" | "imagePrompt"> {
  const visualSections = new Set<SectionCode>([
    "LC_SCENE",
    "LC_INTEGRATED",
    "LR_SITUATION",
    "LR_DOCUMENT",
    "LR_INTEGRATED"
  ]);
  if (!visualSections.has(sectionCode)) {
    return { imageAlt: null, imagePrompt: null };
  }

  const resolvedKind = visualStimulusKind(sectionCode, scenario, stimulusKind);
  const medium =
    resolvedKind === "photo"
      ? "photorealistic contemporary Japanese workplace scene"
      : resolvedKind === "diagram"
        ? "clean front-facing business diagram that preserves every stated relationship"
        : "clean front-facing Japanese business document or chart";
  return {
    imageAlt: `模擬試験${FORM_LABELS[formIndex]}・問${questionNo}：${scenario}`,
    imagePrompt:
      `Primary required content: ${scenario}. Medium: ${medium}. ` +
      "Do not invent, omit, or alter stated people, objects, values, spatial relationships, or sequence. " +
      "No visible answer cues, logos, or watermark. 16:9 composition, culturally accurate contemporary Japanese workplace, accessible contrast."
  };
}

function finalizeQuestion(
  draft: QuestionDraft,
  sectionCode: SectionCode,
  formIndex: number,
  globalQuestionIndex: number,
  sectionQuestionIndex: number
): OfficialMockQuestion {
  const options = rotateChoices(draft.choices, globalQuestionIndex % 4);
  const visuals = visualFields(
    sectionCode,
    draft.scenario ?? draft.prompt,
    draft.stimulusKind,
    formIndex,
    sectionQuestionIndex + 1
  );
  return {
    prompt:
      `【模擬試験${FORM_LABELS[formIndex]}・${sectionCode} ${sectionQuestionIndex + 1}】` +
      draft.prompt,
    scenario: draft.scenario,
    audioScript: draft.audioScript,
    imageAlt: visuals.imageAlt,
    imagePrompt: visuals.imagePrompt,
    explanationVi: draft.explanationVi,
    skillTag: draft.skillTag,
    difficulty: difficultyFor(globalQuestionIndex),
    businessSituation: draft.businessSituation,
    stimulusKind: visualStimulusKind(
      sectionCode,
      draft.scenario ?? draft.prompt,
      draft.stimulusKind
    ),
    tags: [
      "bjt",
      "full-mock",
      "estimated-score",
      OFFICIAL_MOCK_PROVENANCE,
      sectionCode.toLowerCase(),
      draft.businessSituation,
      draft.skillTag,
      ...(draft.tags ?? [])
    ],
    options
  };
}

function responseDraft(input: {
  prompt: string;
  scenario: string;
  audioScript: string;
  correct: string;
  distractors: readonly [string, string, string];
  explanationVi: string;
  skillTag: string;
  businessSituation: string;
  stimulusKind: string;
}): QuestionDraft {
  return {
    prompt: input.prompt,
    scenario: input.scenario,
    audioScript: input.audioScript,
    imageAlt: null,
    imagePrompt: null,
    explanationVi: input.explanationVi,
    skillTag: input.skillTag,
    businessSituation: input.businessSituation,
    stimulusKind: input.stimulusKind,
    choices: {
      correct: input.correct,
      distractors: input.distractors
    }
  };
}

function buildLcScene(formIndex: number, index: number): QuestionDraft {
  const company = COMPANY_NAMES[formIndex]!;
  const person = PERSON_NAMES[formIndex]!;
  const product = PRODUCT_NAMES[formIndex]!;
  const cases = [
    () =>
      responseDraft({
        prompt: `${company}の定例会議です。部長の依頼に対する最も適切な応答はどれですか。`,
        scenario: `会議室で部長が${person}さんに翌週の進捗報告を依頼している。`,
        audioScript: `部長：${person}さん、来週火曜日の会議で新規案件の進捗を報告してもらえますか。`,
        correct: "承知しました。月曜日までに資料をまとめ、事前に共有いたします。",
        distractors: [
          "来週は忙しいので、ほかの人に頼んでください。",
          "進捗はまだ分かりません。",
          "会議が終わってから資料を作ります。"
        ],
        explanationVi:
          "Cần xác nhận nhiệm vụ, nêu thời hạn chuẩn bị và chủ động chia sẻ tài liệu trước cuộc họp.",
        skillTag: "meeting_assignment_response",
        businessSituation: "meeting",
        stimulusKind: "photo"
      }),
    () =>
      responseDraft({
        prompt: `${company}の受付で、来客への次の対応として最も適切なものはどれですか。`,
        scenario: `受付カウンターで予約客が${person}部長との面談を申し出ている。`,
        audioScript: `来客：本日14時に${person}部長とお約束しております、山本と申します。`,
        correct: "山本様でございますね。確認いたしますので、こちらで少々お待ちください。",
        distractors: [
          "部長は忙しいので会えないと思います。",
          "予約の証明を見せてください。",
          "そのまま部長室へお入りください。"
        ],
        explanationVi:
          "Lễ tân nên xác nhận tên, kiểm tra lịch hẹn và mời khách chờ; không được tự ý từ chối hay cho vào.",
        skillTag: "visitor_reception",
        businessSituation: "sales_customer",
        stimulusKind: "photo"
      }),
    () =>
      responseDraft({
        prompt: `${product}の納品について相談されています。担当者の最も適切な対応はどれですか。`,
        scenario: "営業担当と物流担当が、在庫不足による納期変更を相談している。",
        audioScript: `物流担当：申し訳ありません。${product}は部品不足で、予定より三日遅れる見込みです。`,
        correct: "影響する注文を確認し、代替案と新しい納期を本日中にお客様へ連絡しましょう。",
        distractors: [
          "三日程度なら連絡しなくても大丈夫です。",
          "物流部だけで判断してください。",
          "すべての注文をいったんキャンセルしましょう。"
        ],
        explanationVi:
          "Khi có nguy cơ trễ giao hàng, cần xác định đơn bị ảnh hưởng rồi chủ động thông báo thời hạn mới và phương án thay thế.",
        skillTag: "delivery_delay_coordination",
        businessSituation: "internal_coordination",
        stimulusKind: "photo"
      }),
    () =>
      responseDraft({
        prompt: `${person}課長が部下にフィードバックしています。部下の最も適切な返答はどれですか。`,
        scenario: "1on1で、報告書の根拠データが不足している点を指摘されている。",
        audioScript: `${person}課長：結論は分かりやすいですが、判断の根拠となるデータをもう少し示してください。`,
        correct: "ご指摘ありがとうございます。元データを確認し、比較表を加えて明日再提出します。",
        distractors: [
          "結論が合っているので、このままでいいと思います。",
          "データは別の部署が持っているので、私にはできません。",
          "次回から気をつけます。"
        ],
        explanationVi:
          "Phản hồi tốt cần tiếp nhận góp ý, nêu hành động sửa cụ thể và cam kết thời hạn.",
        skillTag: "constructive_feedback_response",
        businessSituation: "internal_coordination",
        stimulusKind: "photo"
      }),
    () =>
      responseDraft({
        prompt: `${company}のお客様相談窓口です。クレームへの最初の応答として最も適切なものはどれですか。`,
        scenario: `お客様が${product}の初期不良について窓口で説明している。`,
        audioScript: `お客様：昨日届いた${product}が起動しません。業務で今日から使う予定でした。`,
        correct: "ご迷惑をおかけし申し訳ございません。状況を確認し、至急交換手配を検討いたします。",
        distractors: [
          "説明書をもう一度読んでください。",
          "製造部の問題なので、こちらでは分かりません。",
          "交換には通常二週間かかります。"
        ],
        explanationVi:
          "Bước đầu cần xin lỗi, xác nhận tình trạng và thể hiện sẽ xử lý khẩn cấp; không đổ trách nhiệm.",
        skillTag: "complaint_first_response",
        businessSituation: "complaint",
        stimulusKind: "photo"
      }),
    () =>
      responseDraft({
        prompt: `${company}のプレゼン直前です。チームの対応として最も適切なものはどれですか。`,
        scenario: "会議室でプロジェクターに映像が出ず、開始時刻が近づいている。",
        audioScript: `${person}：接続を変えても画面が映りません。開始まであと五分です。`,
        correct: "予備のケーブルと共有用PDFを確認し、司会者にも状況を伝えましょう。",
        distractors: [
          "開始時刻を一時間遅らせましょう。",
          "原因が分かるまで黙って待ちましょう。",
          "参加者に各自で資料を探してもらいましょう。"
        ],
        explanationVi:
          "Cần dùng phương án dự phòng đồng thời báo người điều phối, tránh để người tham dự chờ mà không có thông tin.",
        skillTag: "presentation_contingency",
        businessSituation: "presentation",
        stimulusKind: "photo"
      }),
    () =>
      responseDraft({
        prompt: `${person}さんは出張先に到着しました。次に取るべき行動として最も適切なものはどれですか。`,
        scenario: "空港到着ロビーで、移動便が遅れた社員がスマートフォンを確認している。",
        audioScript: `${person}：到着が40分遅れました。先方との打ち合わせ開始まであと一時間です。`,
        correct: "先方と上司に到着状況を連絡し、移動時間を確認してすぐに向かう。",
        distractors: [
          "連絡せずにホテルへ向かう。",
          "打ち合わせを翌日に変更する。",
          "空港で報告書を書き終えてから移動する。"
        ],
        explanationVi:
          "Khi chuyến đi bị trễ, cần thông báo cho các bên và kiểm tra ngay thời gian di chuyển trước khi quyết định.",
        skillTag: "business_trip_recovery",
        businessSituation: "schedule",
        stimulusKind: "photo"
      }),
    () =>
      responseDraft({
        prompt: `${product}の注文確認です。営業担当の最も適切な返答はどれですか。`,
        scenario: "電話で数量と希望納期について顧客から変更依頼を受けている。",
        audioScript: `顧客：注文数を120台から150台に増やし、納期は今月末のままにできますか。`,
        correct: "在庫と生産予定を確認し、本日17時までに可否をご連絡いたします。",
        distractors: [
          "問題ありません。必ず間に合います。",
          "数量変更は一切できません。",
          "今月末になれば分かります。"
        ],
        explanationVi:
          "Không nên hứa khi chưa kiểm tra. Cần xác nhận tồn kho/năng lực sản xuất và hẹn giờ phản hồi rõ ràng.",
        skillTag: "order_change_confirmation",
        businessSituation: "sales_customer",
        stimulusKind: "photo"
      }),
    () =>
      responseDraft({
        prompt: `${company}の倉庫です。安全担当者の指示に対する最も適切な行動はどれですか。`,
        scenario: "倉庫の通路に荷物が置かれ、非常口への動線が狭くなっている。",
        audioScript: `安全担当：この荷物で避難経路がふさがれています。すぐに所定の保管場所へ移してください。`,
        correct: "作業を止めて荷物を移動し、通路が確保されたことを安全担当に報告する。",
        distractors: [
          "次の休憩時間までそのままにする。",
          "非常口の表示だけ見えれば問題ないと判断する。",
          "荷物の横に注意書きを置くだけにする。"
        ],
        explanationVi: "Lối thoát hiểm phải được giải phóng ngay; sau đó cần báo đã khắc phục.",
        skillTag: "workplace_safety_action",
        businessSituation: "internal_coordination",
        stimulusKind: "photo"
      }),
    () =>
      responseDraft({
        prompt: `${company}の採用面接です。応募者の質問への最も適切な回答はどれですか。`,
        scenario: "面接の終盤で、応募者が配属後の研修制度について尋ねている。",
        audioScript: "応募者：入社後の研修と、配属後のサポートについて教えていただけますか。",
        correct: "入社時研修の内容と、配属後三か月間のメンター制度をご説明します。",
        distractors: [
          "研修については入社してから聞いてください。",
          "部署によって違うので、何とも言えません。",
          "経験者にはサポートは必要ありません。"
        ],
        explanationVi:
          "Nhà tuyển dụng nên giải thích minh bạch chương trình đào tạo và hỗ trợ sau phân công.",
        skillTag: "interview_information",
        businessSituation: "hr_interview",
        stimulusKind: "photo"
      }),
    () =>
      responseDraft({
        prompt: `${company}と取引先の契約交渉です。担当者の最も適切な発言はどれですか。`,
        scenario: "商談室で、取引先から支払条件を60日から90日に延長してほしいと依頼されている。",
        audioScript: "取引先：初回契約だけ、支払期限を90日に延ばしていただくことは可能でしょうか。",
        correct: "社内規程と与信条件を確認した上で、代替案も含めて明日回答いたします。",
        distractors: [
          "今回だけなら、その場で90日に変更します。",
          "規程なので絶対に無理です。",
          "支払条件より価格を上げましょう。"
        ],
        explanationVi:
          "Điều kiện thanh toán liên quan quy định và tín dụng, vì vậy cần kiểm tra nội bộ và phản hồi có phương án.",
        skillTag: "contract_term_negotiation",
        businessSituation: "negotiation",
        stimulusKind: "photo"
      }),
    () =>
      responseDraft({
        prompt: `${company}でシステム障害が発生しました。チームの優先対応として最も適切なものはどれですか。`,
        scenario: "監視画面に障害警告が表示され、顧客向けサービスの一部が利用できない。",
        audioScript: `${person}：決済機能だけエラー率が上がっています。原因はまだ特定できていません。`,
        correct: "影響範囲を確認し、障害手順に沿って責任者への連絡と顧客告知の準備を進める。",
        distractors: [
          "原因が特定できるまで誰にも知らせない。",
          "すべてのサービスを停止する。",
          "明日の定例会議で報告する。"
        ],
        explanationVi:
          "Xử lý sự cố phải bắt đầu bằng xác định phạm vi, kích hoạt quy trình báo cáo và chuẩn bị thông tin cho khách hàng.",
        skillTag: "incident_initial_response",
        businessSituation: "internal_coordination",
        stimulusKind: "photo"
      })
  ];
  return cases[index]!();
}

function buildLcStatement(formIndex: number, index: number): QuestionDraft {
  const company = COMPANY_NAMES[formIndex]!;
  const product = PRODUCT_NAMES[formIndex]!;
  const person = PERSON_NAMES[formIndex]!;
  const data = [
    {
      audio: `誠に申し訳ございません。${product}の発送は、検品工程の遅れにより明日の午後となる見込みです。`,
      question: "話し手は何を伝えていますか。",
      correct: "検品の遅れにより、発送が明日の午後になる。",
      wrong: ["商品が明日の午後に到着する。", "検品を明日始める。", "注文を取り消す。"],
      why: "Người nói thông báo thời điểm gửi hàng mới, không phải thời điểm giao đến.",
      skill: "delay_detail_comprehension",
      situation: "sales_customer"
    },
    {
      audio: `${person}さん、資料の数字は最新ですが、グラフの単位が「万円」ではなく「千円」になっています。提出前に直してください。`,
      question: `${person}さんが修正すべき点は何ですか。`,
      correct: "グラフの金額単位。",
      wrong: ["資料の数値。", "提出期限。", "グラフの色。"],
      why: "Số liệu đã mới; lỗi nằm ở đơn vị tiền tệ của biểu đồ.",
      skill: "spoken_correction_detail",
      situation: "internal_coordination"
    },
    {
      audio: `本日の説明会は10時開始ですが、受付は9時30分からです。資料は受付でお渡しします。`,
      question: "参加者は資料をどこで受け取りますか。",
      correct: "受付。",
      wrong: ["会議室の各席。", "会社のウェブサイト。", "説明会終了後。"],
      why: "Thông báo nói rõ tài liệu được phát tại quầy tiếp nhận.",
      skill: "event_instruction_detail",
      situation: "presentation"
    },
    {
      audio: `${company}では来月から経費申請を電子化します。ただし、海外出張の領収書原本は引き続き経理部へ提出してください。`,
      question: "電子化後も原本の提出が必要なのはどれですか。",
      correct: "海外出張の領収書。",
      wrong: ["国内交通費の領収書。", "会議費の領収書。", "すべての領収書。"],
      why: "Ngoại lệ duy nhất được nêu là hóa đơn gốc của công tác nước ngoài.",
      skill: "policy_exception_listening",
      situation: "report_document"
    },
    {
      audio: `先方は価格には納得されていますが、保守対応を平日だけでなく土曜日にも広げてほしいとのことです。`,
      question: "先方が変更を求めているのは何ですか。",
      correct: "保守対応日。",
      wrong: ["製品価格。", "支払方法。", "契約期間。"],
      why: "Khách hàng chấp nhận giá, nhưng muốn mở rộng ngày hỗ trợ sang thứ Bảy.",
      skill: "client_requirement_listening",
      situation: "negotiation"
    },
    {
      audio: `明日の面接は対面からオンラインに変更します。開始時刻は13時のままです。接続先は後ほどメールします。`,
      question: "変更されないものは何ですか。",
      correct: "開始時刻。",
      wrong: ["面接形式。", "接続先。", "面接日。"],
      why: "Hình thức đổi sang trực tuyến, nhưng giờ bắt đầu vẫn là 13:00.",
      skill: "change_vs_constant",
      situation: "hr_interview"
    },
    {
      audio: `新しい広告案は若年層への反応が良好でした。一方、既存顧客には商品の特徴が伝わりにくいという結果です。`,
      question: "調査で明らかになった課題は何ですか。",
      correct: "既存顧客に商品の特徴が伝わりにくい。",
      wrong: ["若年層の反応が悪い。", "広告費が高すぎる。", "商品名が覚えにくい。"],
      why: "Vấn đề được nêu rõ là khách hàng hiện tại khó hiểu đặc điểm sản phẩm.",
      skill: "survey_finding_listening",
      situation: "presentation"
    },
    {
      audio: `${person}部長は出張で不在です。緊急の決裁は副部長が代行しますが、契約金額が一千万円を超える案件は来週まで保留してください。`,
      question: "来週まで保留する案件はどれですか。",
      correct: "契約金額が一千万円を超える案件。",
      wrong: ["すべての緊急案件。", "副部長が担当する案件。", "出張に関する申請。"],
      why: "Chỉ hợp đồng vượt 10 triệu yên phải chờ tới tuần sau.",
      skill: "authorization_threshold",
      situation: "internal_coordination"
    },
    {
      audio: `工場見学では、撮影可能な場所に青い表示があります。それ以外の場所ではカメラをバッグにしまってください。`,
      question: "見学者はどこで撮影できますか。",
      correct: "青い表示がある場所。",
      wrong: ["工場内のすべての場所。", "案内員がいない場所。", "休憩時間だけ。"],
      why: "Chỉ khu vực có biển màu xanh mới được phép chụp ảnh.",
      skill: "facility_rule_listening",
      situation: "internal_coordination"
    },
    {
      audio: `${product}の無料試用期間は30日です。継続利用を希望しない場合は、期間終了の三日前までに管理画面から解約してください。`,
      question: "継続しない場合、いつまでに解約しますか。",
      correct: "試用期間終了の三日前まで。",
      wrong: ["試用開始から三日以内。", "試用期間の最終日。", "請求書が届いてから。"],
      why: "Điều kiện là hủy trước ba ngày tính đến khi kết thúc dùng thử.",
      skill: "deadline_listening",
      situation: "sales_customer"
    }
  ] as const;
  const item = data[index]!;
  return responseDraft({
    prompt: `${company}の業務連絡を聞いてください。${item.question}`,
    scenario: `${company}における${item.situation}の音声連絡。`,
    audioScript: item.audio,
    correct: item.correct,
    distractors: item.wrong,
    explanationVi: item.why,
    skillTag: item.skill,
    businessSituation: item.situation,
    stimulusKind: "audio"
  });
}

function buildLcIntegrated(formIndex: number, index: number): QuestionDraft {
  const company = COMPANY_NAMES[formIndex]!;
  const person = PERSON_NAMES[formIndex]!;
  const sales = pick([128, 146, 173], formIndex);
  const target = pick([150, 165, 190], formIndex);
  const remaining = target - sales;
  const data = [
    {
      scenario: `${company}の月次会議。画面には「売上実績${sales}百万円、目標${target}百万円」と表示されている。`,
      audio: `現在の売上は${sales}百万円です。目標達成には残り${remaining}百万円必要です。重点顧客への追加提案を進めます。`,
      question: "目標達成までに必要な売上はいくらですか。",
      correct: `${remaining}百万円。`,
      wrong: [`${sales}百万円。`, `${target}百万円。`, `${remaining + 10}百万円。`],
      why: `Mục tiêu ${target} trừ thực tế ${sales} bằng ${remaining} triệu yên.`,
      skill: "sales_gap_calculation",
      situation: "meeting"
    },
    {
      scenario: `研修予定表には「基礎：月曜、実務：水曜、評価：金曜」と表示されている。`,
      audio: `${person}さんは水曜日の実務研修に出席できません。木曜日に補講を受け、金曜日の評価には予定どおり参加してください。`,
      question: `${person}さんが木曜日にすることは何ですか。`,
      correct: "実務研修の補講を受ける。",
      wrong: ["基礎研修を受ける。", "評価試験を受ける。", "研修を欠席する。"],
      why: "Lịch bù vào thứ Năm là cho phần đào tạo thực hành bị lỡ vào thứ Tư.",
      skill: "schedule_integration",
      situation: "hr_interview"
    },
    {
      scenario: `在庫表に「東京倉庫80台、大阪倉庫45台、予約済み100台」と表示されている。`,
      audio:
        "新規注文は20台です。二つの倉庫の在庫を合わせれば、予約済み分を確保した後でも対応できます。",
      question: "新規注文に対応した後、在庫は何台残りますか。",
      correct: "5台。",
      wrong: ["20台。", "25台。", "45台。"],
      why: "Tồn tổng 125, trừ 100 đã đặt và 20 đơn mới, còn 5.",
      skill: "inventory_integration",
      situation: "report_document"
    },
    {
      scenario: "プロジェクト工程図に「設計完了→顧客確認→開発開始」と表示されている。",
      audio:
        "設計は完了しましたが、お客様から確認回答がまだ届いていません。開発着手は回答後になります。",
      question: "現在プロジェクトが止まっている理由は何ですか。",
      correct: "顧客の確認回答を待っているため。",
      wrong: [
        "設計が終わっていないため。",
        "開発担当が不足しているため。",
        "予算が承認されていないため。"
      ],
      why: "Thiết kế đã xong; bước chặn hiện tại là phản hồi xác nhận của khách.",
      skill: "process_dependency",
      situation: "internal_coordination"
    },
    {
      scenario: "顧客満足度グラフに「品質92%、価格71%、サポート64%」と表示されている。",
      audio:
        "品質評価は高い一方、問い合わせへの初回回答が遅いという声が増えています。来期はサポート体制を優先的に改善します。",
      question: "来期に最も優先する改善領域はどれですか。",
      correct: "問い合わせ対応のサポート体制。",
      wrong: ["製品品質。", "販売価格。", "広告デザイン。"],
      why: "Điểm hỗ trợ thấp nhất và phản hồi đầu tiên chậm, nên đây là ưu tiên.",
      skill: "chart_and_comment_integration",
      situation: "sales_customer"
    },
    {
      scenario: "会議室の座席図に、顧客4名、営業3名、技術2名の席が表示されている。",
      audio:
        "技術説明を円滑にするため、技術担当は顧客側の開発責任者の向かいに座ってください。営業は入口側を使います。",
      question: "技術担当はどこに座りますか。",
      correct: "顧客側の開発責任者の向かい。",
      wrong: ["入口のすぐ横。", "営業担当の後ろ。", "会議室の外。"],
      why: "Chỉ dẫn âm thanh yêu cầu kỹ thuật ngồi đối diện người phụ trách phát triển phía khách.",
      skill: "spatial_instruction",
      situation: "meeting"
    },
    {
      scenario:
        "配送図に「通常便：翌々日、速達便：翌日午前、当日便：同一市内のみ」と表示されている。",
      audio: "納品先は隣県で、明日の午後までに必要です。費用より納期を優先してください。",
      question: "選ぶべき配送方法はどれですか。",
      correct: "速達便。",
      wrong: ["通常便。", "当日便。", "どの方法でもよい。"],
      why: "Ngoài thành phố nên không dùng giao trong ngày; cần tới trước chiều mai nên chọn chuyển phát nhanh.",
      skill: "constraint_based_choice",
      situation: "schedule"
    },
    {
      scenario:
        "損益図に「A案：利益率18%、初期費用高」「B案：利益率12%、初期費用低」と表示されている。",
      audio: "今回は短期利益より、初年度の資金負担を抑えることを最優先にします。",
      question: "方針に合う案はどれですか。",
      correct: "初期費用の低いB案。",
      wrong: ["利益率の高いA案。", "両案を同時に実施する。", "どちらも方針に合わない。"],
      why: "Tiêu chí ưu tiên là giảm gánh nặng vốn năm đầu, phù hợp phương án B.",
      skill: "decision_criterion_integration",
      situation: "negotiation"
    },
    {
      scenario: "人員配置図に「受付2名、相談窓口3名、電話対応1名」と表示されている。",
      audio:
        "午後は電話が増える見込みです。相談窓口から一名を電話対応へ移し、受付人数は変えません。",
      question: "変更後、電話対応は何名になりますか。",
      correct: "2名。",
      wrong: ["1名。", "3名。", "4名。"],
      why: "Bộ phận điện thoại đang có 1 người, chuyển thêm 1 từ quầy tư vấn nên thành 2.",
      skill: "staffing_change_integration",
      situation: "internal_coordination"
    },
    {
      scenario:
        "販売計画図に「法人向け60%、個人向け40%」と表示され、次期目標は総数500件となっている。",
      audio: "次期も構成比を維持します。法人向けは既存顧客の更新を中心に進めます。",
      question: "次期の法人向け目標件数は何件ですか。",
      correct: "300件。",
      wrong: ["200件。", "400件。", "500件。"],
      why: "60% của tổng 500 là 300 hợp đồng doanh nghiệp.",
      skill: "ratio_target_integration",
      situation: "sales_customer"
    }
  ] as const;
  const item = data[index]!;
  return responseDraft({
    prompt: `${item.question}`,
    scenario: item.scenario,
    audioScript: item.audio,
    correct: item.correct,
    distractors: item.wrong,
    explanationVi: item.why,
    skillTag: item.skill,
    businessSituation: item.situation,
    stimulusKind: "illustration"
  });
}

function buildLrSituation(formIndex: number, index: number): QuestionDraft {
  const company = COMPANY_NAMES[formIndex]!;
  const person = PERSON_NAMES[formIndex]!;
  const data = [
    {
      scenario:
        "受付画面に「予約なしの来訪者は担当部署へ確認」と表示され、来訪者が名刺を差し出している。",
      audio: "本日こちらの近くに来ましたので、ご挨拶だけでもと思い伺いました。",
      question: "受付担当者はまず何をしますか。",
      correct: "担当部署に面会可能か確認する。",
      wrong: [
        "すぐ会議室へ案内する。",
        "名刺を返して帰ってもらう。",
        "新しい予約を一週間後に入れる。"
      ],
      why: "Khách không đặt trước, nên phải liên hệ bộ phận phụ trách trước khi cho gặp.",
      skill: "visual_rule_application",
      situation: "sales_customer"
    },
    {
      scenario:
        "ホワイトボードに「本日：仕様確定、明日：見積提出、金曜：顧客回答」と書かれている。",
      audio: `${person}さん、仕様変更が一件入りました。見積提出は木曜日に延ばし、顧客にも連絡してください。`,
      question: "変更後、見積書を提出するのはいつですか。",
      correct: "木曜日。",
      wrong: ["今日。", "明日。", "金曜日。"],
      why: "Âm thanh cập nhật lịch: nộp báo giá được dời sang thứ Năm.",
      skill: "schedule_update_integration",
      situation: "schedule"
    },
    {
      scenario: "倉庫入口に「安全靴・ヘルメット必須」と表示され、訪問者が革靴のまま立っている。",
      audio: "見学前に、こちらの貸出用安全靴とヘルメットをご使用ください。",
      question: "訪問者は見学前に何をしますか。",
      correct: "貸出用の安全靴とヘルメットを着用する。",
      wrong: ["革靴のまま入る。", "ヘルメットだけ着用する。", "見学を中止する。"],
      why: "Biển báo và hướng dẫn đều yêu cầu mang cả giày bảo hộ lẫn mũ.",
      skill: "safety_sign_comprehension",
      situation: "internal_coordination"
    },
    {
      scenario: `オンライン会議画面で、${company}側のマイク表示だけがミュートになっている。`,
      audio: "こちらには声が届いていないようです。画面左下のマイクをご確認いただけますか。",
      question: `${company}側が最初に確認するものは何ですか。`,
      correct: "マイクのミュート設定。",
      wrong: ["カメラの明るさ。", "共有資料のページ。", "会議の終了時刻。"],
      why: "Biểu tượng cho thấy micro đang tắt và đối tác không nghe được tiếng.",
      skill: "remote_meeting_troubleshooting",
      situation: "meeting"
    },
    {
      scenario:
        "商品棚に「展示品」「予約済み」「販売可」の三つの札があり、顧客が展示品を指している。",
      audio: "同じ型の在庫がございますので、新品を倉庫からお持ちします。",
      question: "店員は次に何をしますか。",
      correct: "倉庫から同じ型の新品を持ってくる。",
      wrong: ["展示品をそのまま販売する。", "予約済みの商品を渡す。", "別の商品を注文する。"],
      why: "Nhân viên nói rõ sẽ lấy hàng mới cùng mẫu từ kho.",
      skill: "service_action_prediction",
      situation: "sales_customer"
    }
  ] as const;
  const item = data[index]!;
  return responseDraft({
    prompt: item.question,
    scenario: item.scenario,
    audioScript: item.audio,
    correct: item.correct,
    distractors: item.wrong,
    explanationVi: item.why,
    skillTag: item.skill,
    businessSituation: item.situation,
    stimulusKind: "photo"
  });
}

function buildLrDocument(formIndex: number, index: number): QuestionDraft {
  const company = COMPANY_NAMES[formIndex]!;
  const product = PRODUCT_NAMES[formIndex]!;
  const monthly = pick([48, 56, 64], formIndex);
  const data = [
    {
      scenario: `売上表：4月${monthly}百万円、5月${monthly + 6}百万円、6月${monthly + 3}百万円。`,
      audio: "新規キャンペーンを開始した月に売上が最も高くなりましたが、翌月は少し落ち着きました。",
      question: "売上が最も高かったのは何月ですか。",
      correct: "5月。",
      wrong: ["4月。", "6月。", "三か月とも同じ。"],
      why: `Tháng 5 đạt ${monthly + 6}, cao nhất trong ba tháng.`,
      skill: "chart_peak_identification",
      situation: "report_document"
    },
    {
      scenario: "会議室予約表：A室10時〜12時、B室9時〜11時、C室13時〜17時が予約済み。",
      audio:
        "11時から一時間、6人で打ち合わせをしたいです。A室は8人、B室は4人、C室は10人まで利用できます。",
      question: "条件に合う会議室はどれですか。",
      correct: "A室。",
      wrong: ["B室。", "C室。", "利用できる部屋はない。"],
      why: "11–12 giờ, phòng A còn trong khung đã đặt và đủ 6 người; B chỉ 4 chỗ, C bắt đầu 13 giờ.",
      skill: "table_constraint_matching",
      situation: "schedule"
    },
    {
      scenario: `${product}料金表：基本プラン月額3万円・5ユーザー、追加ユーザー1名4千円。`,
      audio: `${company}では8人で利用する予定です。初期費用はかかりません。`,
      question: "一か月の利用料はいくらですか。",
      correct: "4万2千円。",
      wrong: ["3万2千円。", "3万8千円。", "5万4千円。"],
      why: "Gói cơ bản 30.000 yên + 3 người thêm × 4.000 = 42.000 yên.",
      skill: "pricing_table_calculation",
      situation: "sales_customer"
    },
    {
      scenario: "研修評価表：説明力4.5、時間管理3.1、資料構成4.2、質疑応答3.8（5点満点）。",
      audio: "次回は、内容を削らずに予定時間内へ収める練習を重点的に行いましょう。",
      question: "最も優先して改善する項目はどれですか。",
      correct: "時間管理。",
      wrong: ["説明力。", "資料構成。", "質疑応答。"],
      why: "Điểm thấp nhất là quản lý thời gian và lời nhận xét cũng nhấn mạnh đúng mục này.",
      skill: "evaluation_table_interpretation",
      situation: "presentation"
    },
    {
      scenario: "配送比較表：通常便2日・900円、翌日便1日・1,500円、時間指定便2日・1,300円。",
      audio: "到着日は二日後で構いませんが、午前中に受け取れることが条件です。",
      question: "選ぶべき配送方法はどれですか。",
      correct: "時間指定便。",
      wrong: ["通常便。", "翌日便。", "どの便でも条件を満たす。"],
      why: "Không cần nhanh hơn hai ngày nhưng bắt buộc nhận buổi sáng, nên chọn loại chỉ định giờ.",
      skill: "service_table_decision",
      situation: "schedule"
    },
    {
      scenario: "勤務表：田中9〜17時、佐藤10〜18時、鈴木12〜20時。窓口は10〜19時に常時2名必要。",
      audio: "17時以降の人員が不足します。別チームから応援を一名依頼してください。",
      question: "応援が必要な時間帯はいつですか。",
      correct: "18時から19時。",
      wrong: ["9時から10時。", "10時から12時。", "17時から18時。"],
      why: "Từ 18–19 giờ chỉ còn Suzuki; trước 18 giờ vẫn có Sato và Suzuki.",
      skill: "staff_schedule_analysis",
      situation: "internal_coordination"
    },
    {
      scenario: "予算表：広告80万円、展示会120万円、調査50万円。削減目標は合計30万円。",
      audio: "展示会費は契約済みで変更できません。広告を20万円、調査を10万円削減しましょう。",
      question: "変更後の広告費はいくらですか。",
      correct: "60万円。",
      wrong: ["50万円。", "70万円。", "80万円。"],
      why: "Ngân sách quảng cáo 80 vạn giảm 20 vạn, còn 60 vạn.",
      skill: "budget_adjustment_calculation",
      situation: "report_document"
    },
    {
      scenario: "在庫推移：月曜90、火曜70、水曜55、木曜40。安全在庫は50個。",
      audio: "安全在庫を下回る前に追加発注します。納品には二日かかります。",
      question: "遅くともいつ発注判断が必要ですか。",
      correct: "火曜日。",
      wrong: ["月曜日。", "水曜日。", "木曜日。"],
      why: "Cần đặt thứ Ba để hai ngày sau hàng về trước/khi tồn xuống dưới mức an toàn vào thứ Năm.",
      skill: "inventory_reorder_timing",
      situation: "schedule"
    },
    {
      scenario: "応募経路表：紹介40名・採用8名、求人サイト100名・採用10名、説明会30名・採用9名。",
      audio: "応募数ではなく、採用につながる割合が最も高い経路を強化します。",
      question: "強化する経路はどれですか。",
      correct: "説明会。",
      wrong: ["紹介。", "求人サイト。", "三つとも同じ。"],
      why: "Tỷ lệ tuyển: giới thiệu 20%, website 10%, hội thảo 30%; cao nhất là hội thảo.",
      skill: "conversion_rate_analysis",
      situation: "hr_interview"
    },
    {
      scenario:
        "問い合わせ表：電話120件・解決率85%、メール200件・解決率92%、チャット160件・解決率88%。",
      audio: "件数の多さではなく、解決率が最も低い窓口の研修を優先します。",
      question: "研修を優先する窓口はどれですか。",
      correct: "電話。",
      wrong: ["メール。", "チャット。", "すべて同じ。"],
      why: "Tỷ lệ giải quyết thấp nhất là điện thoại 85%.",
      skill: "service_metric_analysis",
      situation: "sales_customer"
    }
  ] as const;
  const item = data[index]!;
  return responseDraft({
    prompt: item.question,
    scenario: item.scenario,
    audioScript: item.audio,
    correct: item.correct,
    distractors: item.wrong,
    explanationVi: item.why,
    skillTag: item.skill,
    businessSituation: item.situation,
    stimulusKind: "chart"
  });
}

function buildLrIntegrated(formIndex: number, index: number): QuestionDraft {
  const company = COMPANY_NAMES[formIndex]!;
  const person = PERSON_NAMES[formIndex]!;
  const data = [
    {
      scenario:
        "メール：顧客は火曜午後か木曜午前を希望。予定表：技術担当は火曜午後不在、木曜10時以降は参加可能。",
      audio: "製品デモには技術担当の同席が必要です。所要時間は一時間です。",
      question: "打ち合わせを設定する最も適切な日時はいつですか。",
      correct: "木曜日の10時以降。",
      wrong: ["火曜日の午後。", "木曜日の9時。", "金曜日の午後。"],
      why: "Khách chấp nhận sáng thứ Năm và kỹ thuật chỉ tham gia từ 10 giờ; thời lượng một giờ.",
      skill: "multi_source_scheduling",
      situation: "schedule"
    },
    {
      scenario: `品質報告：不良率は1.2%から0.8%へ低下。顧客メール：${company}向け納品分で同じ傷が2件発生。`,
      audio: "全体の不良率は改善しましたが、特定工程の傷について原因分析を続けます。",
      question: "最も適切な判断はどれですか。",
      correct: "全体品質は改善したが、特定の傷への対策は継続が必要。",
      wrong: [
        "品質問題は完全に解決した。",
        "不良率は悪化している。",
        "顧客メールは分析対象にしなくてよい。"
      ],
      why: "Tỷ lệ lỗi chung giảm nhưng lỗi trầy cụ thể vẫn xuất hiện, nên cần tiếp tục xử lý.",
      skill: "quality_evidence_synthesis",
      situation: "complaint"
    },
    {
      scenario:
        "予算書：研修費120万円。見積書：対面研修150万円、オンライン研修95万円、教材追加15万円。",
      audio: "全員が同じ教材を使えることを条件に、予算内で実施してください。",
      question: "条件を満たす組み合わせはどれですか。",
      correct: "オンライン研修と教材追加。",
      wrong: ["対面研修だけ。", "対面研修と教材追加。", "オンライン研修だけで教材は用意しない。"],
      why: "Đào tạo trực tuyến 95 + tài liệu 15 = 110 vạn yên, nằm trong ngân sách 120.",
      skill: "budget_document_integration",
      situation: "hr_interview"
    },
    {
      scenario: "社内規程：50万円超の発注は部長承認。申請書：見積額48万円、追加送料4万円。",
      audio: `${person}さん、送料を含む総額で承認区分を判断してください。`,
      question: "この発注に必要な対応はどれですか。",
      correct: "総額52万円として部長承認を得る。",
      wrong: [
        "見積額48万円なので承認不要。",
        "送料だけ別申請にする。",
        "担当者の口頭確認だけで発注する。"
      ],
      why: "Tổng số tiền gồm vận chuyển là 52 vạn, vượt ngưỡng 50 vạn nên cần trưởng phòng duyệt.",
      skill: "policy_threshold_integration",
      situation: "report_document"
    },
    {
      scenario: "プロジェクト表：公開日は30日。テスト完了予定は27日。修正には通常3営業日必要。",
      audio: "重大な不具合が一件残っています。品質を優先し、公開判断を見直してください。",
      question: "最も適切な対応はどれですか。",
      correct: "修正と再確認に必要な期間を踏まえ、公開延期を関係者と調整する。",
      wrong: [
        "予定どおり公開し、後で修正する。",
        "テストを中止する。",
        "不具合を記録から削除する。"
      ],
      why: "Không đủ thời gian sửa và kiểm tra lại trước ngày phát hành; cần điều chỉnh lùi lịch.",
      skill: "release_risk_judgment",
      situation: "internal_coordination"
    },
    {
      scenario:
        "顧客一覧：A社は契約更新まで10日・利用率90%、B社は45日・利用率55%、C社は90日・利用率70%。",
      audio: "今週は更新期限が近く、利用率も高い顧客から更新提案を始めてください。",
      question: "最初に連絡する顧客はどこですか。",
      correct: "A社。",
      wrong: ["B社。", "C社。", "三社へ同時に連絡する。"],
      why: "A vừa gần hạn gia hạn nhất vừa có tỷ lệ sử dụng cao nhất.",
      skill: "customer_priority_synthesis",
      situation: "sales_customer"
    },
    {
      scenario: "設備点検表：1号機は点検済み、2号機は異音あり、3号機は来週点検予定。",
      audio: "異音が確認された設備は使用を止め、保全担当の確認が終わるまで再開しないでください。",
      question: "直ちに停止する設備はどれですか。",
      correct: "2号機。",
      wrong: ["1号機。", "3号機。", "すべての設備。"],
      why: "Thiết bị số 2 có tiếng bất thường, thuộc điều kiện phải dừng ngay.",
      skill: "maintenance_record_action",
      situation: "internal_coordination"
    },
    {
      scenario:
        "研修案内：基礎コースは全員必須、応用コースは管理者のみ、個人情報コースは顧客データ取扱者必須。",
      audio: "新入社員の山田さんは顧客サポート担当ですが、管理職ではありません。",
      question: "山田さんが受講するコースはどれですか。",
      correct: "基礎コースと個人情報コース。",
      wrong: ["基礎コースだけ。", "応用コースだけ。", "三つすべて。"],
      why: "Nhân viên mới phải học cơ bản; xử lý dữ liệu khách nên phải học bảo mật; không phải quản lý.",
      skill: "role_based_requirement",
      situation: "hr_interview"
    },
    {
      scenario: "納品記録：注文100個、初回納品96個、破損2個。顧客受領確認は94個。",
      audio: "不足分と破損分を合わせて、良品を追加発送してください。",
      question: "追加発送する良品は何個ですか。",
      correct: "6個。",
      wrong: ["2個。", "4個。", "8個。"],
      why: "Thiếu 4 so với đơn 100 và hỏng 2, nên cần gửi bổ sung 6 hàng tốt.",
      skill: "delivery_reconciliation",
      situation: "complaint"
    },
    {
      scenario:
        "候補案：Aは費用90万円・期間2か月、Bは費用70万円・期間4か月、Cは費用110万円・期間1か月。",
      audio: "予算は100万円以内で、三か月以内の完了が必須です。",
      question: "両方の条件を満たす案はどれですか。",
      correct: "A案。",
      wrong: ["B案。", "C案。", "条件を満たす案はない。"],
      why: "A dưới 100 vạn và hoàn thành trong 2 tháng; B quá chậm, C vượt ngân sách.",
      skill: "multi_constraint_selection",
      situation: "negotiation"
    }
  ] as const;
  const item = data[index]!;
  return responseDraft({
    prompt: item.question,
    scenario: item.scenario,
    audioScript: item.audio,
    correct: item.correct,
    distractors: item.wrong,
    explanationVi: item.why,
    skillTag: item.skill,
    businessSituation: item.situation,
    stimulusKind: "document"
  });
}

const VOCAB_ITEMS = [
  {
    sentences: [
      "先方の要望を（　）した上で、提案書を修正してください。",
      "利用者の意見を（　）し、画面設計を見直しました。",
      "現場の実情を（　）した計画でなければなりません。"
    ],
    correct: "考慮",
    wrong: ["遠慮", "配慮", "思慮"],
    why: "考慮する nghĩa là cân nhắc một yếu tố khi đưa ra quyết định.",
    skill: "business_vocabulary_consideration"
  },
  {
    sentences: [
      "納期の遅れが全体工程に（　）を及ぼす可能性があります。",
      "為替変動が仕入れ価格に（　）を与えています。",
      "制度変更による業務への（　）を調査します。"
    ],
    correct: "影響",
    wrong: ["印象", "反響", "傾向"],
    why: "影響を及ぼす／与える là kết hợp từ tự nhiên khi nói về tác động.",
    skill: "business_collocation_impact"
  },
  {
    sentences: [
      "今回の障害について原因を（　）し、再発防止策を講じます。",
      "売上減少の要因を（　）するため、追加調査を行います。",
      "顧客離脱の理由を（　）することが最優先です。"
    ],
    correct: "究明",
    wrong: ["証明", "説明", "発明"],
    why: "原因を究明する nghĩa là điều tra làm rõ tận gốc nguyên nhân.",
    skill: "root_cause_vocabulary"
  },
  {
    sentences: [
      "本契約は双方の合意に（　）締結されました。",
      "調査結果に（　）、改善計画を策定します。",
      "社内規程に（　）処理を進めてください。"
    ],
    correct: "基づき",
    wrong: ["伴い", "わたり", "限り"],
    why: "〜に基づき nghĩa là dựa trên căn cứ/quy định đã nêu.",
    skill: "formal_grammar_based_on"
  },
  {
    sentences: [
      "人員不足とは（　）、品質基準を下げることはできません。",
      "緊急対応とは（　）、承認記録は残す必要があります。",
      "小規模な変更とは（　）、利用者への周知は必要です。"
    ],
    correct: "いえ",
    wrong: ["いって", "いうと", "いえば"],
    why: "〜とはいえ nghĩa là dù là/cho dù trong hoàn cảnh đó thì vẫn...",
    skill: "contrast_grammar_tohaie"
  },
  {
    sentences: [
      "市場の変化を（　）に捉え、商品戦略を更新します。",
      "顧客の反応を（　）に把握する仕組みが必要です。",
      "在庫状況を（　）に確認できる画面を導入しました。"
    ],
    correct: "迅速",
    wrong: ["敏感", "簡潔", "順調"],
    why: "迅速に nghĩa là nhanh chóng, phù hợp với hành động nắm bắt/xác nhận.",
    skill: "business_adverb_speed"
  },
  {
    sentences: [
      "担当者間の認識に（　）があり、作業が重複しました。",
      "契約書と説明内容に（　）がないか確認してください。",
      "在庫数の記録に（　）が見つかりました。"
    ],
    correct: "相違",
    wrong: ["相互", "相当", "相場"],
    why: "相違 nghĩa là sự khác biệt/không khớp giữa thông tin hay nhận thức.",
    skill: "discrepancy_vocabulary"
  },
  {
    sentences: [
      "新制度への移行は段階的に（　）する予定です。",
      "来月から新しい審査基準を（　）します。",
      "本人確認の追加手順を全店舗で（　）しました。"
    ],
    correct: "実施",
    wrong: ["実在", "実感", "実用"],
    why: "制度・基準・thủ tục được 実施する, tức triển khai/thực hiện.",
    skill: "implementation_vocabulary"
  },
  {
    sentences: [
      "ご期待に（　）ず、誠に申し訳ございません。",
      "今回はご要望に（　）ない結果となりました。",
      "すべての条件には（　）かねます。"
    ],
    correct: "添え",
    wrong: ["沿え", "応え", "従え"],
    why: "ご期待・ご要望に添う là đáp lại kỳ vọng/yêu cầu; dạng phủ định là 添えず/添えない.",
    skill: "formal_apology_collocation"
  },
  {
    sentences: [
      "設備投資の妥当性を（　）するため、費用対効果を算出します。",
      "申請内容を（　）した結果、承認することにしました。",
      "複数案を（　）し、最終案を選定します。"
    ],
    correct: "検証",
    wrong: ["検問", "検索", "検品"],
    why: "検証する nghĩa là kiểm chứng/đánh giá căn cứ và tính hợp lý.",
    skill: "validation_vocabulary"
  },
  {
    sentences: [
      "売上は増加した（　）、利益率は低下しています。",
      "作業時間は短縮した（　）、確認漏れが増えました。",
      "応募者数は増えた（　）、採用率は変わりません。"
    ],
    correct: "一方で",
    wrong: ["それゆえ", "したがって", "のみならず"],
    why: "一方で dùng để đối chiếu hai xu hướng trái chiều.",
    skill: "contrast_connector"
  },
  {
    sentences: [
      "情報漏えいを（　）ため、アクセス権を見直します。",
      "入力ミスを（　）ため、確認画面を追加しました。",
      "事故の再発を（　）ため、手順を標準化します。"
    ],
    correct: "防ぐ",
    wrong: ["省く", "避ける", "除く"],
    why: "Rủi ro/sự cố được 防ぐ, tức phòng ngừa không để xảy ra.",
    skill: "risk_prevention_verb"
  },
  {
    sentences: [
      "予算には（　）があるため、優先順位を決めましょう。",
      "保管スペースに（　）があり、すべては残せません。",
      "対応できる件数には（　）があります。"
    ],
    correct: "限り",
    wrong: ["終わり", "区切り", "不足"],
    why: "〜には限りがある là cách nói cố định: có giới hạn.",
    skill: "capacity_limit_expression"
  },
  {
    sentences: [
      "急なお願いで（　）が、明日までにご確認いただけますか。",
      "ご多忙のところ（　）が、ご回答をお願いいたします。",
      "重ねてのお願いで（　）が、資料をご再送ください。"
    ],
    correct: "恐縮ですが",
    wrong: ["残念ですが", "当然ですが", "結構ですが"],
    why: "恐縮ですが làm mềm lời nhờ vả gây phiền trong giao tiếp công việc.",
    skill: "polite_request_preface"
  },
  {
    sentences: [
      "顧客情報は業務上必要な範囲に（　）利用してください。",
      "この割引は初回契約に（　）適用されます。",
      "閲覧権限は管理職に（　）付与します。"
    ],
    correct: "限って",
    wrong: ["向けて", "よって", "沿って"],
    why: "〜に限って nghĩa là chỉ giới hạn trong đối tượng/trường hợp đã nêu.",
    skill: "scope_limitation_grammar"
  }
] as const;

function buildRcVocabGrammar(formIndex: number, index: number): QuestionDraft {
  const item = VOCAB_ITEMS[index]!;
  const prompt = item.sentences[formIndex]!;
  return {
    prompt: `${prompt} 空欄に入る最も適切な表現を選んでください。`,
    scenario: "業務文書または職場で使われる表現。",
    audioScript: null,
    imageAlt: null,
    imagePrompt: null,
    explanationVi: item.why,
    skillTag: item.skill,
    businessSituation: "report_document",
    stimulusKind: "text",
    choices: {
      correct: item.correct,
      distractors: item.wrong
    }
  };
}

const EXPRESSION_ITEMS = [
  {
    texts: [
      "資料を拝見しました。方向性には賛成ですが、費用の算定根拠についてもう少し詳しくご説明いただけますでしょうか。",
      "ご提案の趣旨は理解いたしました。一点、運用開始後の支援体制について確認させてください。",
      "全体像はよく分かりました。導入時期だけ、社内計画との調整が必要だと考えております。"
    ],
    question: "話し手の意図として最も適切なものはどれですか。",
    correct: "基本的には前向きだが、一部の条件を確認したい。",
    wrong: [
      "提案を全面的に拒否したい。",
      "すでに契約を決定している。",
      "説明を聞く必要はないと考えている。"
    ],
    why: "Cụm từ đồng thuận/đã hiểu đi kèm yêu cầu xác nhận một điểm cho thấy thái độ tích cực có điều kiện.",
    skill: "nuanced_intent_reading",
    situation: "negotiation"
  },
  {
    texts: [
      "勝手ながら、8月13日から16日まで休業とさせていただきます。期間中のお問い合わせは17日以降、順次対応いたします。",
      "システム保守のため、日曜日0時から4時まで一部機能をご利用いただけません。作業終了後、自動的に再開します。",
      "棚卸しに伴い、金曜日の出荷受付は15時で終了いたします。15時以降のご依頼は翌営業日の扱いとなります。"
    ],
    question: "通知の内容として正しいものはどれですか。",
    correct: [
      "休業中の問い合わせは17日以降に対応される。",
      "保守時間中は一部機能が停止する。",
      "金曜日15時以降の出荷依頼は翌営業日扱いになる。"
    ],
    wrong: [
      "通常どおりすべて対応される。",
      "通知期間中は会社との契約が終了する。",
      "利用者が事前申請すれば制限はなくなる。"
    ],
    why: "Cần đọc đúng điều kiện thời gian và phạm vi hạn chế trong thông báo.",
    skill: "business_notice_comprehension",
    situation: "report_document"
  },
  {
    texts: [
      "先般ご提示いただいた条件では、現時点での採用は難しい状況です。条件面を再検討いただける場合は、改めて協議させてください。",
      "社内で慎重に検討いたしましたが、今回は導入を見送ることとなりました。今後、状況が変わりましたらご相談申し上げます。",
      "ご提案内容は大変魅力的ですが、今期予算の都合上、契約時期を来年度以降に変更できればと存じます。"
    ],
    question: "この文面の意味として最も適切なものはどれですか。",
    correct: [
      "現在の条件では受け入れられないが、再交渉の余地はある。",
      "今回は採用しないが、将来の可能性までは否定していない。",
      "提案自体ではなく、契約時期の延期を求めている。"
    ],
    wrong: [
      "無条件で承諾している。",
      "相手との関係を直ちに終了する。",
      "すでに支払い手続きへ進んでいる。"
    ],
    why: "Business Japanese often conveys rejection/deferral indirectly; pay attention to conditions and future possibility.",
    skill: "indirect_business_message",
    situation: "negotiation"
  },
  {
    texts: [
      "今回の数値は速報値ですので、確定値との差が生じる可能性があります。意思決定に使用する際はご留意ください。",
      "本資料は現時点の仮定に基づく試算であり、将来の成果を保証するものではありません。",
      "調査結果は回答者の自己申告に基づいており、市場全体を代表するとは限りません。"
    ],
    question: "この注意書きが伝えていることは何ですか。",
    correct: "資料の数値や結論には不確実性があり、扱いに注意が必要である。",
    wrong: [
      "資料は誤りなので利用してはいけない。",
      "数値はすべて確定している。",
      "作成者は内容に責任を持たない。"
    ],
    why: "Đây là cảnh báo về giới hạn và độ bất định, không phải phủ nhận hoàn toàn giá trị tài liệu.",
    skill: "caveat_interpretation",
    situation: "report_document"
  },
  {
    texts: [
      "業務効率化の観点から申請手順を簡素化します。ただし、承認権限と証跡保存の要件は変更しません。",
      "在宅勤務の日数上限を撤廃します。ただし、顧客対応日は所属長の指示に従い出社してください。",
      "服装規定を緩和します。ただし、安全区域では指定された保護具の着用が必要です。"
    ],
    question: "変更後も維持される条件はどれですか。",
    correct: [
      "承認権限と証跡保存。",
      "顧客対応日における所属長の出社指示。",
      "安全区域での保護具着用。"
    ],
    wrong: ["すべての従来ルール。", "変更された制度そのもの。", "個人が自由に決めること。"],
    why: "Sau ただし là điều kiện ngoại lệ vẫn được duy trì.",
    skill: "exception_clause_reading",
    situation: "internal_coordination"
  },
  {
    texts: [
      "恐れ入りますが、添付ファイルが開けないようです。お手数をおかけしますが、形式をご確認の上、再送いただけますでしょうか。",
      "先ほどのご案内に日付の誤りがございました。訂正版を添付いたしますので、差し替えをお願いいたします。",
      "注文番号が記載されていないため、処理を進められません。番号をご確認の上、ご返信ください。"
    ],
    question: "受信者に求められている行動はどれですか。",
    correct: [
      "ファイル形式を確認して再送する。",
      "誤った案内を訂正版に差し替える。",
      "注文番号を確認して返信する。"
    ],
    wrong: ["連絡を無視する。", "新しい契約書を作成する。", "電話だけで謝罪する。"],
    why: "Động từ cuối câu cho biết hành động cụ thể người nhận cần thực hiện.",
    skill: "requested_action_extraction",
    situation: "email_chat"
  },
  {
    texts: [
      "A案は初期費用を抑えられる一方、運用負荷が高い。B案は費用が高いものの、保守を外部委託できる。",
      "内製化は知見を蓄積できる反面、人材確保に時間がかかる。外注は早いが、仕様変更の自由度が下がる。",
      "一括導入は効果が早く出るが、現場負担が大きい。段階導入は時間がかかるものの、修正しやすい。"
    ],
    question: "文章の構成として最も適切な説明はどれですか。",
    correct: "二つの案の利点と欠点を対比している。",
    wrong: [
      "一つの案だけを強く推奨している。",
      "過去の失敗原因だけを説明している。",
      "決定済みの手順を通知している。"
    ],
    why: "Mẫu 一方／ものの／反面 đối chiếu ưu và nhược điểm của hai phương án.",
    skill: "comparative_structure",
    situation: "meeting"
  },
  {
    texts: [
      "まず対象顧客を絞り、小規模な試験提供を行います。その結果を踏まえ、機能と価格を調整して本格展開します。",
      "初月は二部署で新手順を試し、問題点を修正します。翌月から対象部署を順次拡大します。",
      "一店舗で陳列方法を検証し、売上への効果が確認できた場合に全店舗へ導入します。"
    ],
    question: "共通する進め方はどれですか。",
    correct: "限定的に試して検証した後、範囲を広げる。",
    wrong: [
      "最初から全社規模で実施する。",
      "検証せずに計画を中止する。",
      "他社の結果だけで判断する。"
    ],
    why: "Cả ba đều mô tả pilot nhỏ → đánh giá → mở rộng.",
    skill: "phased_rollout_reading",
    situation: "internal_coordination"
  },
  {
    texts: [
      "売上目標は達成したものの、値引き率の上昇により粗利益は計画を下回りました。",
      "問い合わせ件数は減少しましたが、一件当たりの解決時間は長くなっています。",
      "採用人数は増えた一方、入社三か月以内の離職率も上昇しました。"
    ],
    question: "文章から分かることは何ですか。",
    correct: "一つの指標は改善したが、別の重要指標に課題が残っている。",
    wrong: [
      "すべての指標が改善している。",
      "改善施策は完全に失敗した。",
      "数値を比較する必要はない。"
    ],
    why: "Kết quả có mặt tích cực nhưng chỉ số chất lượng/hiệu quả khác lại xấu đi.",
    skill: "mixed_result_interpretation",
    situation: "report_document"
  },
  {
    texts: [
      "当社としては品質基準を維持したいと考えておりますので、数量を調整することでご予算に近づける案はいかがでしょうか。",
      "納期を一週間延長いただければ、追加費用なしでご指定の仕様に対応可能です。",
      "月額料金の変更は難しいのですが、初期設定費用を半額にすることは可能です。"
    ],
    question: "話し手が行っていることは何ですか。",
    correct: "守るべき条件を維持しながら代替案を提示している。",
    wrong: [
      "相手の要望をすべて拒否している。",
      "条件を確認せず承諾している。",
      "交渉を一方的に終了している。"
    ],
    why: "Người nói giữ một điều kiện không thể nhượng nhưng đưa ra phương án khác để đạt mục tiêu.",
    skill: "alternative_proposal_reading",
    situation: "negotiation"
  }
] as const;

function buildRcExpression(formIndex: number, index: number): QuestionDraft {
  const item = EXPRESSION_ITEMS[index]!;
  const correct = typeof item.correct === "string" ? item.correct : item.correct[formIndex]!;
  return {
    prompt: `${item.texts[formIndex]}\n\n${item.question}`,
    scenario: "ビジネス文書の意図・条件・論理関係を読み取る問題。",
    audioScript: null,
    imageAlt: null,
    imagePrompt: null,
    explanationVi: item.why,
    skillTag: item.skill,
    businessSituation: item.situation,
    stimulusKind: "text",
    choices: {
      correct,
      distractors: item.wrong
    }
  };
}

const RC_DOCUMENT_ITEMS = [
  {
    docs: [
      "出張申請：東京→大阪、11月12日〜13日。目的：顧客テスト立会い。承認欄：部長承認済み。備考：宿泊は総務手配。",
      "出張申請：東京→福岡、12月4日〜6日。目的：代理店研修。承認欄：課長承認済み。備考：航空券は本人手配。",
      "出張申請：名古屋→仙台、1月18日〜19日。目的：設備点検。承認欄：部長承認待ち。備考：現地移動は社用車。"
    ],
    question: "申請者が自分で手配するものは何ですか。",
    correct: ["手配するものはない。", "航空券。", "本人手配と記載されたものはない。"],
    wrong: ["顧客との契約書。", "部長の承認。", "出張先の会議室だけ。"],
    why: "Cần đối chiếu đúng dòng ghi chú của từng phiếu công tác.",
    skill: "form_detail_extraction",
    situation: "schedule"
  },
  {
    docs: [
      "月次実績：売上1,200万円（計画1,100万円）、粗利280万円（計画300万円）。値引き販売の増加が粗利率低下の主因。",
      "月次実績：問い合わせ820件（前月760件）、平均初回回答2.1時間（目標2時間以内）。新製品公開後に件数増。",
      "月次実績：応募者140名（目標120名）、内定承諾率52%（目標65%）。他社との条件競争が激化。"
    ],
    question: "目標を達成していない指標はどれですか。",
    correct: ["粗利。", "平均初回回答時間。", "内定承諾率。"],
    wrong: [
      "記載されているすべての指標。",
      "最初に書かれた数量指標。",
      "比較対象がないため判断できない。"
    ],
    why: "So sánh thực tế với kế hoạch/mục tiêu để xác định chỉ số chưa đạt.",
    skill: "kpi_document_analysis",
    situation: "report_document"
  },
  {
    docs: [
      "情報管理規程：機密資料の社外持出しは原則禁止。業務上必要な場合は部長承認と暗号化を必須とする。",
      "購買規程：30万円未満は課長決裁、30万円以上100万円未満は部長決裁、100万円以上は役員決裁。",
      "在宅勤務規程：週3日まで利用可。試用期間中は対象外。顧客情報を紙で自宅へ持ち帰ることは禁止。"
    ],
    question: [
      "機密資料を例外的に社外へ持ち出す条件は何ですか。",
      "80万円の発注に必要な決裁は何ですか。",
      "在宅勤務で禁止されていることは何ですか。"
    ],
    correct: ["部長承認を得て暗号化する。", "部長決裁。", "顧客情報を紙で自宅へ持ち帰ること。"],
    wrong: ["担当者だけで判断する。", "口頭で連絡すればよい。", "条件は特に定められていない。"],
    why: "Đáp án lấy trực tiếp từ điều kiện/khung phê duyệt được nêu trong quy định.",
    skill: "policy_document_application",
    situation: "report_document"
  },
  {
    docs: [
      "顧客メール：10月20日納品希望。生産回答：通常10営業日、特急対応なら7営業日。注文確定予定：10月9日。",
      "顧客メール：火曜15時にデモ希望。技術予定：火曜13〜16時は障害対応、木曜午前は空き。営業：日程変更を顧客へ相談可。",
      "顧客メール：予算上限90万円。見積：標準版82万円、追加分析機能15万円。営業メモ：分析機能は次期でも追加可。"
    ],
    question: "資料から判断した最も適切な対応はどれですか。",
    correct: [
      "休日を確認した上で、必要なら特急対応の費用と可否を顧客に提示する。",
      "木曜午前への変更を顧客に相談する。",
      "今回は標準版を提案し、分析機能は次期追加案として説明する。"
    ],
    wrong: [
      "条件を確認せず即座に約束する。",
      "顧客の希望を理由なく拒否する。",
      "社内資料をそのまま顧客へ転送する。"
    ],
    why: "Cần tổng hợp yêu cầu khách, giới hạn nội bộ và phương án khả thi.",
    skill: "customer_constraint_synthesis",
    situation: "sales_customer"
  },
  {
    docs: [
      "障害報告：9:10検知、9:18影響範囲特定、9:25暫定復旧、10:40恒久対応完了。原因：設定変更時の確認不足。",
      "クレーム記録：商品20個中2個破損。11:00謝罪、11:20交換品手配、15:00発送、翌日午前到着予定。",
      "監査指摘：権限棚卸し未実施。期限6月末。担当：情報システム部。5月15日時点の進捗40%。"
    ],
    question: [
      "恒久対応が完了したのはいつですか。",
      "交換品はいつ到着する予定ですか。",
      "期限までに完了すべき作業は何ですか。"
    ],
    correct: ["10時40分。", "翌日の午前。", "権限の棚卸し。"],
    wrong: ["記録の最初の時刻・日付。", "担当部署の変更。", "資料からは判断できない。"],
    why: "Câu hỏi yêu cầu trích đúng mốc thời gian hoặc đầu việc từ hồ sơ.",
    skill: "operational_record_reading",
    situation: "report_document"
  },
  {
    docs: [
      "アンケート（200名）：満足72%、普通18%、不満10%。不満理由：検索しにくい55%、表示が遅い30%、その他15%。",
      "研修評価（80名）：内容4.3、講師4.6、演習3.2。要望：実務に近いケースを増やしてほしい。",
      "店舗調査（120件）：接客4.4、品揃え3.6、待ち時間2.9。自由記述ではレジ混雑への指摘が最多。"
    ],
    question: "最優先の改善点は何ですか。",
    correct: ["検索のしやすさ。", "実務に近い演習。", "レジの待ち時間。"],
    wrong: ["最も評価が高い項目。", "回答者数を減らすこと。", "調査を公表しないこと。"],
    why: "Ưu tiên dựa trên điểm thấp nhất hoặc lý do bất mãn được nhắc nhiều nhất.",
    skill: "survey_priority_analysis",
    situation: "report_document"
  },
  {
    docs: [
      "採用要項：法人営業3年以上必須。IT経験歓迎。選考は書類→一次→最終。提出物は履歴書・職務経歴書。",
      "社内公募：海外事業経験2年以上、英語会議対応必須。応募には上長推薦不要。締切9月30日。",
      "研修募集：管理職候補向け。事前課題提出必須。定員20名、応募多数の場合は抽選。"
    ],
    question: "必須条件として正しいものはどれですか。",
    correct: ["法人営業経験3年以上。", "英語で会議に対応できること。", "事前課題を提出すること。"],
    wrong: [
      "歓迎条件だけを満たすこと。",
      "上長の推薦を必ず得ること。",
      "応募すれば必ず参加できること。"
    ],
    why: "Phân biệt điều kiện bắt buộc với điều kiện ưu tiên hoặc quy trình tuyển chọn.",
    skill: "requirement_distinction",
    situation: "hr_interview"
  },
  {
    docs: [
      "見積比較：A社120万円・納期4週・保守1年、B社135万円・納期3週・保守3年。方針：長期保守を優先。",
      "物件比較：X駅徒歩3分・月25万円・20席、Y駅徒歩8分・月20万円・28席。条件：24席以上。",
      "サーバー比較：P案99.9%・月18万円、Q案99.95%・月24万円。要件：99.95%以上。"
    ],
    question: "条件に最も合う選択肢はどれですか。",
    correct: ["B社。", "Yの物件。", "Q案。"],
    wrong: ["価格が最も低い選択肢だけ。", "条件を満たさない選択肢。", "資料だけでは比較できない。"],
    why: "Không chỉ nhìn giá; phải áp dụng tiêu chí ưu tiên hoặc yêu cầu tối thiểu.",
    skill: "vendor_comparison",
    situation: "negotiation"
  },
  {
    docs: [
      "議事録：新機能は7月公開を目標。法務確認は5月末、顧客テストは6月第2週。担当：開発＝鈴木、法務連携＝田中。",
      "議事録：展示会テーマは省エネ。デモ機2台を準備。営業資料初稿は8月10日、リハーサルは8月25日。",
      "議事録：在庫精度改善のため週次棚卸しを試行。対象は東京倉庫、期間は10月の一か月、責任者は物流課長。"
    ],
    question: [
      "田中さんの担当は何ですか。",
      "8月25日に行うことは何ですか。",
      "週次棚卸しを試す場所はどこですか。"
    ],
    correct: ["法務確認の連携。", "展示会のリハーサル。", "東京倉庫。"],
    wrong: ["別の担当者の業務。", "期限後に新しく決めること。", "資料に記載されていない場所。"],
    why: "Biên bản ghi rõ người phụ trách, mốc thời gian và phạm vi thử nghiệm.",
    skill: "meeting_minutes_action",
    situation: "meeting"
  },
  {
    docs: [
      "中期計画：国内売上は横ばい、海外売上を3年で20%増。課題：現地サポート人材と法規対応。",
      "改善計画：返品率を2.4%から1.5%へ。対策：梱包見直し、出荷前写真記録、月次レビュー。",
      "人材計画：管理職候補30名を選抜。半年間の研修と部門横断プロジェクトで評価。"
    ],
    question: "計画の達成に直接必要な取り組みはどれですか。",
    correct: [
      "現地サポート人材の確保と法規対応。",
      "梱包改善と出荷前記録を実施して月次で確認する。",
      "候補者に研修と部門横断プロジェクトを経験させる。"
    ],
    wrong: [
      "計画と関係のない費用削減だけを行う。",
      "目標値を記録から削除する。",
      "現状維持で結果を待つ。"
    ],
    why: "Hành động đúng phải trực tiếp xử lý các vấn đề và biện pháp được nêu trong kế hoạch.",
    skill: "strategy_action_mapping",
    situation: "report_document"
  }
] as const;

function buildRcIntegrated(formIndex: number, index: number): QuestionDraft {
  const item = RC_DOCUMENT_ITEMS[index]!;
  const question = typeof item.question === "string" ? item.question : item.question[formIndex]!;
  const correct = typeof item.correct === "string" ? item.correct : item.correct[formIndex]!;
  return {
    prompt: `${item.docs[formIndex]}\n\n${question}`,
    scenario: "業務文書・表・記録を読んで判断する問題。",
    audioScript: null,
    imageAlt: null,
    imagePrompt: null,
    explanationVi: item.why,
    skillTag: item.skill,
    businessSituation: item.situation,
    stimulusKind: "document",
    choices: {
      correct,
      distractors: item.wrong
    }
  };
}

const BUILDERS: Record<SectionCode, (formIndex: number, index: number) => QuestionDraft> = {
  LC_SCENE: buildLcScene,
  LC_STATEMENT: buildLcStatement,
  LC_INTEGRATED: buildLcIntegrated,
  LR_SITUATION: buildLrSituation,
  LR_DOCUMENT: buildLrDocument,
  LR_INTEGRATED: buildLrIntegrated,
  RC_VOCAB_GRAMMAR: buildRcVocabGrammar,
  RC_EXPRESSION: buildRcExpression,
  RC_INTEGRATED: buildRcIntegrated
};

function buildBlueprintMeta(): OfficialMockForm["blueprintMeta"] {
  return {
    examFormat: "bjt-full-simulation",
    scoreLabel: "estimated",
    scoreRange: { min: 0, max: 800 },
    bandMapping: [
      { band: "J5", min: 0, max: 199 },
      { band: "J4", min: 200, max: 319 },
      { band: "J3", min: 320, max: 419 },
      { band: "J2", min: 420, max: 529 },
      { band: "J1", min: 530, max: 599 },
      { band: "J1+", min: 600, max: 800 }
    ],
    totalQuestions: QUESTIONS_PER_MOCK,
    totalTimeSeconds: MOCK_TIME_LIMIT_SECONDS,
    parts: [
      {
        code: "listening",
        questionCount: 25,
        timeLimitSec: 2_700,
        sections: ["LC_SCENE", "LC_STATEMENT", "LC_INTEGRATED"]
      },
      {
        code: "listening_reading",
        questionCount: 25,
        timeLimitSec: 1_800,
        sections: ["LR_SITUATION", "LR_DOCUMENT", "LR_INTEGRATED"]
      },
      {
        code: "reading",
        questionCount: 30,
        timeLimitSec: 1_800,
        sections: ["RC_VOCAB_GRAMMAR", "RC_EXPRESSION", "RC_INTEGRATED"]
      }
    ],
    contentVersion: OFFICIAL_MOCK_PROVENANCE,
    reference: OFFICIAL_BJT_FORMAT_REFERENCE
  };
}

function buildMockForm(formIndex: number): OfficialMockForm {
  let globalQuestionIndex = formIndex * QUESTIONS_PER_MOCK;
  const sections = OFFICIAL_SECTION_SPECS.map((spec, sectionIndex) => {
    const builder = BUILDERS[spec.code];
    const questions = Array.from({ length: spec.questionCount }, (_, questionIndex) => {
      const draft =
        formIndex === 2
          ? FORM_C_SECTION_DRAFTS[spec.code][questionIndex]!
          : formIndex === 1 && FORM_B_SIGNATURE_OVERRIDES[spec.code]?.[questionIndex]
            ? FORM_B_SIGNATURE_OVERRIDES[spec.code]![questionIndex]!
            : builder(formIndex, questionIndex);
      const question = finalizeQuestion(
        draft,
        spec.code,
        formIndex,
        globalQuestionIndex,
        questionIndex
      );
      globalQuestionIndex += 1;
      return question;
    });
    return {
      code: spec.code,
      titleJa: spec.titleJa,
      titleVi: spec.titleVi,
      displayOrder: sectionIndex + 1,
      questions
    };
  });

  const formLabel = FORM_LABELS[formIndex]!;
  return {
    slug: `bjt-full-simulation-${formLabel.toLowerCase()}-v1`,
    titleJa: `BJT総合模擬試験 ${formLabel}`,
    titleVi: `Đề thi thử BJT toàn diện ${formLabel}`,
    description:
      "Đề mô phỏng BJT toàn diện 80 câu trong 105 phút, đánh giá trên toàn thang điểm ước tính 0–800; không giới hạn theo mục tiêu J.",
    type: "official",
    status: "published",
    level: null,
    timeLimitSeconds: MOCK_TIME_LIMIT_SECONDS,
    sections,
    blueprintMeta: buildBlueprintMeta()
  };
}

export const OFFICIAL_MOCK_FORMS: OfficialMockForm[] = Array.from(
  { length: MOCK_FORM_COUNT },
  (_, formIndex) => buildMockForm(formIndex)
);

export type OfficialMockValidationReport = {
  mockCount: number;
  totalQuestions: number;
  sectionCounts: Record<SectionCode, number>;
  partCounts: Record<string, number>;
  correctAnswerCounts: Record<OptionKey, number>;
  difficultyCounts: Record<Difficulty, number>;
  normalizedSignatureCount: number;
  normalizedDuplicateCount: number;
  normalizedFormSignatureCounts: Record<string, number>;
  normalizedFormOverlaps: Record<string, number>;
};

const NORMALIZED_ENTITY_PATTERN =
  /青葉商事|みらい物流|東都テクノ|田中|佐藤|鈴木|在庫管理クラウド|省電力センサー|勤怠管理アプリ/g;
const NORMALIZED_NUMBER_PATTERN = /[0-9０-９一二三四五六七八九十百千万億]+/g;
const NORMALIZED_DATE_UNIT_PATTERN =
  /月|日|時|分|秒|年|円|個|件|名|台|%|％|キロ|トン|ドル|万円|百万円/g;

function normalizeSignatureText(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/【模擬試験[^】]+】/g, "")
    .replace(NORMALIZED_ENTITY_PATTERN, "<entity>")
    .replace(NORMALIZED_NUMBER_PATTERN, "#")
    .replace(NORMALIZED_DATE_UNIT_PATTERN, "<unit>")
    .replace(/\s+/g, "")
    .toLowerCase();
}

export function normalizedContentSignature(question: OfficialMockQuestion): string {
  const normalizedOptions = question.options
    .map((option) => normalizeSignatureText(option.text))
    .sort()
    .join("|");
  return [
    normalizeSignatureText(question.prompt),
    normalizeSignatureText(question.scenario ?? ""),
    normalizeSignatureText(question.audioScript ?? ""),
    normalizedOptions
  ].join("::");
}

export function validateOfficialMockForms(
  forms: readonly OfficialMockForm[] = OFFICIAL_MOCK_FORMS
): OfficialMockValidationReport {
  const expectedSectionCounts = Object.fromEntries(
    OFFICIAL_SECTION_SPECS.map((spec) => [spec.code, spec.questionCount * forms.length])
  ) as Record<SectionCode, number>;
  const sectionCounts = Object.fromEntries(
    OFFICIAL_SECTION_SPECS.map((spec) => [spec.code, 0])
  ) as Record<SectionCode, number>;
  const partCounts: Record<string, number> = {
    listening: 0,
    listening_reading: 0,
    reading: 0
  };
  const correctAnswerCounts: Record<OptionKey, number> = {
    A: 0,
    B: 0,
    C: 0,
    D: 0
  };
  const difficultyCounts: Record<Difficulty, number> = {
    easy: 0,
    standard: 0,
    hard: 0
  };
  const prompts = new Set<string>();
  let totalQuestions = 0;

  if (forms.length < 2) {
    throw new Error(`Expected at least 2 full mock forms, got ${forms.length}`);
  }

  for (const form of forms) {
    if (form.type !== "official") {
      throw new Error(`${form.slug}: type must be official`);
    }
    if (form.level !== null) {
      throw new Error(`${form.slug}: full simulation must not target one J level`);
    }
    if (form.timeLimitSeconds !== MOCK_TIME_LIMIT_SECONDS) {
      throw new Error(
        `${form.slug}: expected ${MOCK_TIME_LIMIT_SECONDS}s, got ${form.timeLimitSeconds}s`
      );
    }
    if (form.blueprintMeta.scoreLabel !== "estimated") {
      throw new Error(`${form.slug}: score label must remain estimated`);
    }
    const expectedBlueprintParts = [
      {
        code: "listening",
        questionCount: 25,
        timeLimitSec: 2_700,
        sections: ["LC_SCENE", "LC_STATEMENT", "LC_INTEGRATED"]
      },
      {
        code: "listening_reading",
        questionCount: 25,
        timeLimitSec: 1_800,
        sections: ["LR_SITUATION", "LR_DOCUMENT", "LR_INTEGRATED"]
      },
      {
        code: "reading",
        questionCount: 30,
        timeLimitSec: 1_800,
        sections: ["RC_VOCAB_GRAMMAR", "RC_EXPRESSION", "RC_INTEGRATED"]
      }
    ];
    if (JSON.stringify(form.blueprintMeta.parts) !== JSON.stringify(expectedBlueprintParts)) {
      throw new Error(`${form.slug}: blueprint must be 25/25/30 questions and 45/30/30 minutes`);
    }
    if (
      form.blueprintMeta.parts.reduce((seconds, part) => seconds + part.timeLimitSec, 0) !==
      MOCK_TIME_LIMIT_SECONDS
    ) {
      throw new Error(`${form.slug}: blueprint part timing must total 105 min`);
    }
    if (form.sections.length !== OFFICIAL_SECTION_SPECS.length) {
      throw new Error(`${form.slug}: expected 9 sections`);
    }

    let formQuestionCount = 0;
    for (const spec of OFFICIAL_SECTION_SPECS) {
      const section = form.sections.find((item) => item.code === spec.code);
      if (!section) {
        throw new Error(`${form.slug}: missing section ${spec.code}`);
      }
      if (section.questions.length !== spec.questionCount) {
        throw new Error(
          `${form.slug}/${spec.code}: expected ${spec.questionCount}, got ${section.questions.length}`
        );
      }

      for (const question of section.questions) {
        if (prompts.has(question.prompt)) {
          throw new Error(`Duplicate prompt: ${question.prompt.slice(0, 90)}`);
        }
        prompts.add(question.prompt);
        if (!question.explanationVi.trim() || !question.skillTag.trim()) {
          throw new Error(`${form.slug}/${spec.code}: missing explanationVi or skillTag`);
        }
        if (question.options.length !== 4) {
          throw new Error(`${form.slug}/${spec.code}: expected 4 options`);
        }
        const correctOptions = question.options.filter((option) => option.isCorrect);
        if (correctOptions.length !== 1) {
          throw new Error(`${form.slug}/${spec.code}: expected exactly one correct option`);
        }
        const optionKeys = question.options.map((option) => option.key);
        if (new Set(optionKeys).size !== 4) {
          throw new Error(`${form.slug}/${spec.code}: duplicate option key`);
        }
        correctAnswerCounts[correctOptions[0]!.key] += 1;
        difficultyCounts[question.difficulty] += 1;

        const requiresAudio = spec.part === "listening" || spec.part === "listening_reading";
        if (requiresAudio && !question.audioScript?.trim()) {
          throw new Error(`${form.slug}/${spec.code}: audioScript is required`);
        }
        const requiresVisual = [
          "LC_SCENE",
          "LC_INTEGRATED",
          "LR_SITUATION",
          "LR_DOCUMENT",
          "LR_INTEGRATED"
        ].includes(spec.code);
        if (requiresVisual && (!question.imageAlt?.trim() || !question.imagePrompt?.trim())) {
          throw new Error(`${form.slug}/${spec.code}: imageAlt and imagePrompt are required`);
        }
      }

      sectionCounts[spec.code] += section.questions.length;
      partCounts[spec.part] += section.questions.length;
      formQuestionCount += section.questions.length;
    }
    if (formQuestionCount !== QUESTIONS_PER_MOCK) {
      throw new Error(
        `${form.slug}: expected ${QUESTIONS_PER_MOCK} questions, got ${formQuestionCount}`
      );
    }
    totalQuestions += formQuestionCount;
  }

  if (totalQuestions < 200) {
    throw new Error(`Expected at least 200 new questions, got ${totalQuestions}`);
  }
  for (const spec of OFFICIAL_SECTION_SPECS) {
    if (sectionCounts[spec.code] !== expectedSectionCounts[spec.code]) {
      throw new Error(
        `${spec.code}: expected aggregate ${expectedSectionCounts[spec.code]}, got ${sectionCounts[spec.code]}`
      );
    }
  }
  const answerCounts = Object.values(correctAnswerCounts);
  if (Math.max(...answerCounts) - Math.min(...answerCounts) > 1) {
    throw new Error(
      `Correct answer distribution is imbalanced: ${JSON.stringify(correctAnswerCounts)}`
    );
  }
  const expectedPartCounts = {
    listening: 25 * forms.length,
    listening_reading: 25 * forms.length,
    reading: 30 * forms.length
  };
  for (const [part, expected] of Object.entries(expectedPartCounts)) {
    if (partCounts[part] !== expected) {
      throw new Error(`${part}: expected aggregate ${expected}, got ${partCounts[part]}`);
    }
  }

  const formSignatureSets = Object.fromEntries(
    forms.map((form) => [
      form.slug,
      new Set(
        form.sections.flatMap((section) =>
          section.questions.map((question) => normalizedContentSignature(question))
        )
      )
    ])
  ) as Record<string, Set<string>>;
  const allNormalizedSignatures = new Set(
    Object.values(formSignatureSets).flatMap((signatures) => [...signatures])
  );
  const normalizedFormOverlaps: Record<string, number> = {};
  for (let leftIndex = 0; leftIndex < forms.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < forms.length; rightIndex += 1) {
      const leftForm = forms[leftIndex]!;
      const rightForm = forms[rightIndex]!;
      const rightSignatures = formSignatureSets[rightForm.slug]!;
      normalizedFormOverlaps[`${leftForm.slug}::${rightForm.slug}`] = [
        ...formSignatureSets[leftForm.slug]!
      ].filter((signature) => rightSignatures.has(signature)).length;
    }
  }
  if (allNormalizedSignatures.size < 200) {
    throw new Error(
      `Expected at least 200 normalized content signatures after removing form/entity/number variants, got ${allNormalizedSignatures.size}`
    );
  }

  return {
    mockCount: forms.length,
    totalQuestions,
    sectionCounts,
    partCounts,
    correctAnswerCounts,
    difficultyCounts,
    normalizedSignatureCount: allNormalizedSignatures.size,
    normalizedDuplicateCount: totalQuestions - allNormalizedSignatures.size,
    normalizedFormSignatureCounts: Object.fromEntries(
      Object.entries(formSignatureSets).map(([slug, signatures]) => [slug, signatures.size])
    ),
    normalizedFormOverlaps
  };
}
