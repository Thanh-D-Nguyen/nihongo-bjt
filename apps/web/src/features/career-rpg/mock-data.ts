/**
 * Career RPG mock data — UI-first vertical slice.
 *
 * Replace with real API calls later; the exported shapes match types.ts which
 * already mirrors the planned Prisma schema. See README.md.
 */
import type {
  CareerRank,
  CareerRpgMockBundle,
  ChapterResult,
  ContextMemo,
  MissionArc,
  MissionChapter,
  NpcRelation,
  StoryNpc,
  UserCareerState
} from "./types";

export const mockCareerRanks: CareerRank[] = [
  {
    rankCode: "R1",
    titleJa: "内定者",
    titleVi: "Nhân viên dự bị",
    bjtBandTarget: "pre-J5",
    minSkillFloor: 0,
    unlockedSceneTypes: ["email"],
    displayOrder: 1
  },
  {
    rankCode: "R2",
    titleJa: "新入社員",
    titleVi: "Nhân viên mới",
    bjtBandTarget: "J5",
    minSkillFloor: 30,
    unlockedSceneTypes: ["email", "chat"],
    displayOrder: 2
  },
  {
    rankCode: "R3",
    titleJa: "一般社員",
    titleVi: "Nhân viên chính thức",
    bjtBandTarget: "J4",
    minSkillFloor: 45,
    unlockedSceneTypes: ["email", "chat", "deadline"],
    displayOrder: 3
  },
  {
    rankCode: "R4",
    titleJa: "主任",
    titleVi: "Chuyên viên",
    bjtBandTarget: "J3",
    minSkillFloor: 60,
    unlockedSceneTypes: ["email", "chat", "deadline", "meeting", "complaint"],
    displayOrder: 4
  },
  {
    rankCode: "R5",
    titleJa: "係長",
    titleVi: "Trưởng nhóm",
    bjtBandTarget: "J3+",
    minSkillFloor: 70,
    unlockedSceneTypes: ["email", "chat", "deadline", "meeting", "complaint", "report_chart"],
    displayOrder: 5
  },
  {
    rankCode: "R6",
    titleJa: "課長",
    titleVi: "Trưởng phòng",
    bjtBandTarget: "J2",
    minSkillFloor: 78,
    unlockedSceneTypes: ["email", "chat", "deadline", "meeting", "complaint", "report_chart"],
    displayOrder: 6
  },
  {
    rankCode: "R7",
    titleJa: "部長",
    titleVi: "Giám đốc bộ phận",
    bjtBandTarget: "J2+",
    minSkillFloor: 85,
    unlockedSceneTypes: ["email", "chat", "deadline", "meeting", "complaint", "report_chart"],
    displayOrder: 7
  },
  {
    rankCode: "R8",
    titleJa: "グローバル幹部 候補",
    titleVi: "Ứng viên Lãnh đạo Toàn cầu",
    bjtBandTarget: "J1",
    minSkillFloor: 92,
    unlockedSceneTypes: ["email", "chat", "deadline", "meeting", "complaint", "report_chart"],
    displayOrder: 8
  }
];

export const mockStoryNpcs: StoryNpc[] = [
  {
    slug: "yamada_bucho",
    nameJa: "山田 部長",
    roleJa: "営業部 部長",
    companyJa: "株式会社ミライ商事",
    defaultRelation: "uchi",
    avatarInitial: "山",
    avatarTint: "#1B2A4A",
    bioVi: "Cấp trên trực tiếp. Đánh giá cao 報連相 đúng lúc, ghét trễ deadline."
  },
  {
    slug: "suzuki_kakaricho",
    nameJa: "鈴木 係長",
    roleJa: "営業部 係長",
    companyJa: "株式会社ミライ商事",
    defaultRelation: "uchi",
    avatarInitial: "鈴",
    avatarTint: "#0E7490",
    bioVi: "Đối thủ thân thiện. Cùng band BJT J3, cạnh tranh thẳng thắn."
  },
  {
    slug: "tanaka_senpai",
    nameJa: "田中 先輩",
    roleJa: "営業部 主任",
    companyJa: "株式会社ミライ商事",
    defaultRelation: "uchi",
    avatarInitial: "田",
    avatarTint: "#059669",
    bioVi: "Tiền bối hướng dẫn (mentor). Để lại memo phản hồi sau mỗi lỗi."
  },
  {
    slug: "sato_kokyaku",
    nameJa: "佐藤 様",
    roleJa: "購買担当",
    companyJa: "東京テクノロジー株式会社",
    defaultRelation: "soto",
    avatarInitial: "佐",
    avatarTint: "#B45309",
    bioVi: "Khách hàng dài hạn. Kỳ vọng mức 敬語 chuẩn mực, không thích vòng vo."
  },
  {
    slug: "takahashi_clienthq",
    nameJa: "高橋 部長",
    roleJa: "調達部 部長",
    companyJa: "東京テクノロジー株式会社",
    defaultRelation: "soto",
    avatarInitial: "高",
    avatarTint: "#9F1239",
    bioVi: "Lãnh đạo phía khách hàng. Nhạy cảm với rủi ro hợp đồng và mặt mũi công ty."
  }
];

export const mockNpcRelations: NpcRelation[] = [
  { npcSlug: "yamada_bucho", trustScore: 53, lastInteractionAt: "2026-05-08T09:14:00Z" },
  { npcSlug: "suzuki_kakaricho", trustScore: 48, lastInteractionAt: "2026-05-07T15:02:00Z" },
  { npcSlug: "tanaka_senpai", trustScore: 71, lastInteractionAt: "2026-05-08T18:30:00Z" },
  { npcSlug: "sato_kokyaku", trustScore: 42, lastInteractionAt: "2026-05-06T11:00:00Z" },
  { npcSlug: "takahashi_clienthq", trustScore: 35, lastInteractionAt: "2026-05-05T14:20:00Z" }
];

export const mockCareerState: UserCareerState = {
  userId: "demo-user",
  jpWorkName: "田中 太郎",
  companyTheme: "mirai-shoji",
  hireDate: "2026-04-01",
  currentRankCode: "R3",
  rankXp: 296,
  rankXpToNext: 320,
  streakDays: 12,
  lastClockInAt: "2026-05-09T08:42:00Z",
  skills: [
    { axisCode: "keigo", value: 58 },
    { axisCode: "written", value: 64 },
    { axisCode: "meeting", value: 42 },
    { axisCode: "customer", value: 51 },
    { axisCode: "chart", value: 39 },
    { axisCode: "nuance", value: 47 }
  ]
};

const chapterClientEmail2: MissionChapter = {
  id: "ch_client_email_02",
  arcSlug: "arc.client-email",
  slug: "follow-up-after-quote",
  displayOrder: 2,
  titleJa: "見積もり送付後のフォローアップ",
  titleVi: "Theo dõi sau khi gửi báo giá",
  briefingJa:
    "三日前に佐藤様へ見積書を送りましたが、まだ返信がありません。山田部長から「今日中に丁寧にフォローして」と指示がありました。",
  briefingVi:
    "Bạn đã gửi báo giá cho Sato-san 3 ngày trước nhưng chưa có hồi âm. Yamada-bucho nhắc bạn theo dõi trong ngày, ngôn ngữ phải nhã nhặn.",
  yourRoleVi: "Bạn là 田中 太郎 — phụ trách khách hàng Tokyo Technology.",
  isBoss: false,
  estimatedMinutes: 6,
  scenarios: [
    {
      id: "sc_email_followup_01",
      scenarioType: "email",
      titleJa: "佐藤様へのフォローアップメール",
      titleVi: "Email theo dõi gửi Sato-san",
      contextSummaryVi:
        "Khách hàng có thể đang bận hoặc đang cân nhắc đối thủ. Câu chữ phải vừa nhã nhặn, vừa tạo lý do để khách phản hồi mà không gây áp lực.",
      goalJa: "返信を促しつつ、相手にプレッシャーを与えないメールを書く。",
      goalVi: "Thúc đẩy phản hồi mà không tạo áp lực cho khách hàng.",
      characters: [
        { npcSlug: "sato_kokyaku", roleInScene: "recipient" },
        { npcSlug: "yamada_bucho", roleInScene: "observer" }
      ],
      payload: {
        emailThread: [
          {
            from: "田中 太郎 <tanaka@mirai-shoji.co.jp>",
            to: "佐藤 様 <sato@tokyo-tech.co.jp>",
            subjectJa: "お見積もりの件（株式会社ミライ商事）",
            bodyJa:
              "佐藤様\n\nいつも大変お世話になっております。\nミライ商事の田中でございます。\n\n先日ご送付いたしました見積書につきまして、ご確認いただけましたでしょうか。\nご不明点などございましたら、お気軽にご連絡くださいませ。\n\nどうぞよろしくお願いいたします。",
            timestamp: "2026-05-06T10:00:00Z"
          }
        ]
      },
      question: {
        id: "q_followup_01",
        skillTag: "written",
        difficulty: "standard",
        promptJa: "三日経っても返信がありません。今日のフォローアップとして、最も適切な一文はどれですか？",
        promptVi:
          "Sau 3 ngày vẫn chưa có hồi âm. Câu nào phù hợp nhất để theo dõi trong ngày hôm nay?",
        options: [
          {
            optionKey: "A",
            textJa: "先日のお見積もり、いかがでしたでしょうか。早めにご返信ください。",
            isCorrect: false,
            outcome: {
              trustDelta: -8,
              clarityScore: 70,
              politenessScore: 45,
              businessRiskDelta: 10,
              satisfactionDelta: -10,
              nextActionCorrect: false,
              npcReactionTag: "frown",
              consequenceJa:
                "「早めに」は催促のように聞こえます。佐藤様は少し戸惑い、社内で不満を漏らすかもしれません。",
              consequenceVi:
                "“早めに” nghe như giục giã. Sato-san có thể khó chịu và phàn nàn nội bộ về cách nói trực tiếp.",
              affectedNpcSlug: "sato_kokyaku",
              errorType: "keigo_misunderstanding"
            }
          },
          {
            optionKey: "B",
            textJa:
              "先日お送りしたお見積もりにつきまして、その後ご検討状況はいかがでしょうか。お忙しいところ恐縮ですが、ご都合のよろしいときにご一報いただけますと幸いです。",
            isCorrect: true,
            outcome: {
              trustDelta: 12,
              clarityScore: 88,
              politenessScore: 92,
              businessRiskDelta: -6,
              satisfactionDelta: 8,
              nextActionCorrect: true,
              npcReactionTag: "smile",
              consequenceJa:
                "丁寧で配慮のある言い回しです。佐藤様は安心して検討を続け、午後に返信が届きました。",
              consequenceVi:
                "Câu viết tinh tế và có 配慮. Sato-san yên tâm tiếp tục cân nhắc và đã trả lời vào buổi chiều.",
              affectedNpcSlug: "sato_kokyaku",
              errorType: null
            }
          },
          {
            optionKey: "C",
            textJa: "返事まだですよね？確認お願いします。",
            isCorrect: false,
            outcome: {
              trustDelta: -16,
              clarityScore: 55,
              politenessScore: 18,
              businessRiskDelta: 18,
              satisfactionDelta: -16,
              nextActionCorrect: false,
              npcReactionTag: "escalate",
              consequenceJa:
                "敬語が崩れ、内輪の口調になっています。山田部長にCCで連絡が入り、フォローが入る可能性があります。",
              consequenceVi:
                "Mất hẳn 敬語, giọng nội bộ. Yamada-bucho có thể bị CC và phải vào can thiệp.",
              affectedNpcSlug: "sato_kokyaku",
              errorType: "internal_external_tone_mismatch"
            }
          },
          {
            optionKey: "D",
            textJa:
              "見積もりについて、もし社内で承認が下りない場合は、こちらでも何かサポートできることがあれば仰ってください。",
            isCorrect: false,
            outcome: {
              trustDelta: -2,
              clarityScore: 60,
              politenessScore: 78,
              businessRiskDelta: 6,
              satisfactionDelta: -2,
              nextActionCorrect: false,
              npcReactionTag: "silence",
              consequenceJa:
                "「承認が下りない場合」を勝手に想定したため、佐藤様は失礼に感じる可能性があります。",
              consequenceVi:
                "Tự ý giả định “nếu không được duyệt” khiến Sato-san có thể cảm thấy bị xem nhẹ.",
              affectedNpcSlug: "sato_kokyaku",
              errorType: "implied_meaning_error"
            }
          }
        ]
      }
    }
  ]
};

const chapterClientEmail1: MissionChapter = {
  id: "ch_client_email_01",
  arcSlug: "arc.client-email",
  slug: "first-quote-send",
  displayOrder: 1,
  titleJa: "初めての見積もり送付",
  titleVi: "Lần đầu gửi báo giá",
  briefingJa: "新規取引先へ初めて見積書を送付します。最初の印象が大切です。",
  briefingVi: "Lần đầu gửi báo giá tới khách hàng mới — ấn tượng đầu rất quan trọng.",
  yourRoleVi: "Bạn là 田中 太郎 — phụ trách khách hàng mới.",
  isBoss: false,
  estimatedMinutes: 5,
  scenarios: []
};

const chapterClientEmail3: MissionChapter = {
  id: "ch_client_email_03",
  arcSlug: "arc.client-email",
  slug: "rate-increase-notice",
  displayOrder: 3,
  titleJa: "値上げ通知のメール",
  titleVi: "Email thông báo tăng giá",
  briefingJa: "原材料の高騰により値上げをお願いするメールです。配慮が必要です。",
  briefingVi: "Phải gửi email đề nghị tăng giá do nguyên liệu lên — cần khéo léo.",
  yourRoleVi: "Bạn là 田中 太郎 — phụ trách thông báo điều chỉnh giá.",
  isBoss: false,
  estimatedMinutes: 8,
  scenarios: []
};

const chapterClientEmailBoss: MissionChapter = {
  id: "ch_client_email_boss",
  arcSlug: "arc.client-email",
  slug: "boss-difficult-client",
  displayOrder: 4,
  titleJa: "【難関】こじれた取引先への謝罪と再提案",
  titleVi: "【Boss】Email xin lỗi và đề xuất lại với khách hàng đang căng",
  briefingJa: "前任者の失敗で関係がこじれた取引先と、メールだけで関係を立て直してください。",
  briefingVi: "Khôi phục quan hệ với khách hàng đang căng — chỉ qua email.",
  yourRoleVi: "Bạn được giao xử lý trường hợp khó nhất quý này.",
  isBoss: true,
  estimatedMinutes: 12,
  scenarios: []
};

export const mockMissionChapters: MissionChapter[] = [
  chapterClientEmail1,
  chapterClientEmail2,
  chapterClientEmail3,
  chapterClientEmailBoss
];

export const mockMissionArcs: MissionArc[] = [
  {
    slug: "arc.hou-ren-sou",
    titleJa: "報連相 基礎",
    titleVi: "Nền tảng 報連相 (Hou-Ren-Sou)",
    rankCodeEntry: "R2",
    synopsisVi:
      "Học cách báo cáo / liên lạc / tham vấn với cấp trên đúng nhịp công ty Nhật.",
    npcSlugs: ["yamada_bucho", "tanaka_senpai"],
    chapterIds: [],
    status: "completed",
    totalChapters: 8,
    completedChapters: 8,
    bossChapterId: null,
    displayOrder: 1,
    artAccent: "#0E7490"
  },
  {
    slug: "arc.client-email",
    titleJa: "取引先メール",
    titleVi: "Email gửi khách hàng (取引先メール)",
    rankCodeEntry: "R3",
    synopsisVi:
      "Viết email tới khách hàng bên ngoài: báo giá, theo dõi, từ chối khéo, thông báo tăng giá.",
    npcSlugs: ["sato_kokyaku", "yamada_bucho", "tanaka_senpai"],
    chapterIds: [
      "ch_client_email_01",
      "ch_client_email_02",
      "ch_client_email_03",
      "ch_client_email_boss"
    ],
    status: "active",
    totalChapters: 4,
    completedChapters: 1,
    bossChapterId: "ch_client_email_boss",
    displayOrder: 2,
    artAccent: "#1B2A4A"
  },
  {
    slug: "arc.complaint-handling",
    titleJa: "クレーム対応",
    titleVi: "Xử lý khiếu nại khách hàng",
    rankCodeEntry: "R4",
    synopsisVi:
      "Front line ứng phó khiếu nại: nghe, xác nhận sự thật, xin lỗi đúng mực, leo thang đúng cách.",
    npcSlugs: ["takahashi_clienthq", "yamada_bucho"],
    chapterIds: [],
    status: "locked",
    totalChapters: 10,
    completedChapters: 0,
    bossChapterId: null,
    displayOrder: 3,
    artAccent: "#9F1239"
  }
];

export const mockInbox: ContextMemo[] = [
  {
    id: "memo_otsukaresama",
    cardKind: "scene_pattern",
    expressionJa: "お疲れ様です",
    reading: "おつかれさまです",
    surfaceMeaningVi: "Bạn đã vất vả rồi.",
    realIntentVi:
      "Lời chào / mở đầu chuẩn trong nội bộ công ty Nhật. Không nên dùng với khách bên ngoài.",
    sceneJa: "社内メール / 朝礼 / すれ違い",
    toneVi: "Trung tính, thân thiện trong 内 (uchi).",
    bjtTrapVi:
      "BJT thường gài bẫy bằng cách dùng câu này khi gửi cho 取引先 — sai vì là biểu hiện 内輪.",
    fromNpcSlug: "tanaka_senpai",
    generatedAt: "2026-05-08T18:30:00Z",
    status: "unread"
  },
  {
    id: "memo_osewani",
    cardKind: "expression_pair",
    expressionJa: "いつもお世話になっております",
    reading: "いつもおせわになっております",
    surfaceMeaningVi: "Luôn nhận được sự giúp đỡ.",
    realIntentVi:
      "Câu mở đầu chuẩn cho email gửi khách hàng. Đối ngược với 「お疲れ様です」 dùng cho 内.",
    sceneJa: "取引先へのメール冒頭",
    toneVi: "Lịch sự (敬語), bắt buộc với 取引先.",
    bjtTrapVi:
      "Quên dùng câu này khi viết email lần đầu tới khách bị tính là 失礼 trong BJT writing.",
    fromNpcSlug: "tanaka_senpai",
    generatedAt: "2026-05-07T19:10:00Z",
    status: "read"
  },
  {
    id: "memo_kyoshuku",
    cardKind: "soft_refusal",
    expressionJa: "お忙しいところ恐縮ですが",
    reading: "おいそがしいところきょうしゅくですが",
    surfaceMeaningVi: "Tôi xin lỗi vì bạn đang bận, nhưng…",
    realIntentVi:
      "Đệm lịch sự đứng trước yêu cầu — báo hiệu mình hiểu là phiền người ta. Giảm cảm giác giục.",
    sceneJa: "依頼・督促のクッション言葉",
    toneVi: "Rất nhã nhặn (敬語), bắt buộc khi giục khách hàng.",
    bjtTrapVi:
      "Thiếu cụm này khi giục khiến BJT chấm là 「失礼」 dù phần còn lại đúng ngữ pháp.",
    fromNpcSlug: "tanaka_senpai",
    generatedAt: "2026-05-06T20:05:00Z",
    status: "read"
  }
];

export const mockChapterResults: ChapterResult = {
  chapterId: "ch_client_email_02",
  rankXpDelta: 24,
  skillDeltas: { keigo: 8, written: 5, customer: 3 },
  npcTrustDeltas: [
    { npcSlug: "yamada_bucho", delta: 12 },
    { npcSlug: "sato_kokyaku", delta: 8 },
    { npcSlug: "tanaka_senpai", delta: 4 }
  ],
  contextMemoIds: ["memo_otsukaresama", "memo_osewani"],
  npcReactionMontage: [
    {
      npcSlug: "yamada_bucho",
      quoteJa: "うん、その配慮は大事だね。次もこの調子で頼むよ。",
      sentiment: "positive"
    },
    {
      npcSlug: "tanaka_senpai",
      quoteJa: "ナイス。クッション言葉、自然に使えてたね。",
      sentiment: "positive"
    },
    {
      npcSlug: "sato_kokyaku",
      quoteJa: "ご丁寧なご連絡、ありがとうございます。",
      sentiment: "positive"
    }
  ],
  completedAt: "2026-05-09T09:00:00Z"
};

export const mockBundle: CareerRpgMockBundle = {
  state: mockCareerState,
  ranks: mockCareerRanks,
  npcs: mockStoryNpcs,
  npcRelations: mockNpcRelations,
  arcs: mockMissionArcs,
  chapters: mockMissionChapters,
  inbox: mockInbox,
  sampleResult: mockChapterResults
};

export function findRank(rankCode: string): CareerRank | undefined {
  return mockCareerRanks.find((r) => r.rankCode === rankCode);
}

export function findNpc(slug: string): StoryNpc | undefined {
  return mockStoryNpcs.find((n) => n.slug === slug);
}

export function findChapter(id: string): MissionChapter | undefined {
  return mockMissionChapters.find((c) => c.id === id);
}

export function findArc(slug: string): MissionArc | undefined {
  return mockMissionArcs.find((a) => a.slug === slug);
}

export function findNextRank(rankCode: string): CareerRank | undefined {
  const current = mockCareerRanks.find((r) => r.rankCode === rankCode);
  if (!current) return undefined;
  return mockCareerRanks.find((r) => r.displayOrder === current.displayOrder + 1);
}
