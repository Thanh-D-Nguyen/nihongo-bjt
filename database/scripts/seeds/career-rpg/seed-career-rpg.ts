import { parseServerEnv } from "../../../../packages/config/src/index.js";
import { createPrismaClient, type Prisma } from "../../../../packages/database/src/index.js";
import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../../.env") });

const env = parseServerEnv(process.env);
const prisma = createPrismaClient(env.DATABASE_URL);

const ranks = [
  ["R1", "内定者", "Nhân viên dự bị", "pre-J5", 0, 0, 48, ["email"]],
  ["R2", "新入社員", "Nhân viên mới", "J5", 30, 1, 120, ["email", "chat"]],
  ["R3", "一般社員", "Nhân viên chính thức", "J4", 45, 2, 320, ["email", "chat", "deadline"]],
  ["R4", "主任", "Chuyên viên", "J3", 60, 3, 520, ["email", "chat", "deadline", "meeting", "complaint"]],
  ["R5", "係長", "Trưởng nhóm", "J3+", 70, 4, 760, ["email", "chat", "deadline", "meeting", "complaint", "report_chart"]],
  ["R6", "課長", "Trưởng phòng", "J2", 78, 5, 1040, ["email", "chat", "deadline", "meeting", "complaint", "report_chart"]],
  ["R7", "部長", "Giám đốc bộ phận", "J2+", 85, 6, 1360, ["email", "chat", "deadline", "meeting", "complaint", "report_chart"]],
  ["R8", "グローバル幹部候補", "Ứng viên Lãnh đạo Toàn cầu", "J1", 92, 8, 0, ["email", "chat", "deadline", "meeting", "complaint", "report_chart"]]
] as const;

const npcs = [
  {
    slug: "yamada_bucho",
    nameJa: "山田 部長",
    roleJa: "営業部 部長",
    companyJa: "株式会社ミライ商事",
    defaultRelation: "uchi",
    personaPrompt: "Direct manager. Values timely 報連相 and careful customer-facing tone.",
    avatarMedia: { avatarInitial: "山", avatarTint: "#1B2A4A", bioVi: "Cấp trên trực tiếp. Đánh giá cao 報連相 đúng lúc." }
  },
  {
    slug: "tanaka_senpai",
    nameJa: "田中 先輩",
    roleJa: "営業部 主任",
    companyJa: "株式会社ミライ商事",
    defaultRelation: "uchi",
    personaPrompt: "Mentor senpai. Gives concise context memos after mistakes.",
    avatarMedia: { avatarInitial: "田", avatarTint: "#059669", bioVi: "Tiền bối hướng dẫn. Để lại memo phản hồi sau mỗi lỗi." }
  },
  {
    slug: "sato_kokyaku",
    nameJa: "佐藤 様",
    roleJa: "購買担当",
    companyJa: "東京テクノロジー株式会社",
    defaultRelation: "soto",
    personaPrompt: "Client purchasing contact. Expects standard keigo and low-pressure follow-up.",
    avatarMedia: { avatarInitial: "佐", avatarTint: "#B45309", bioVi: "Khách hàng. Kỳ vọng 敬語 chuẩn mực, không thích bị giục." }
  }
] as const;

const chapterScenario = {
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
        promptVi: "Sau 3 ngày vẫn chưa có hồi âm. Câu nào phù hợp nhất để theo dõi trong ngày hôm nay?",
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
              consequenceJa: "「早めに」は催促のように聞こえます。",
              consequenceVi: "“早めに” nghe như giục giã.",
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
              consequenceJa: "丁寧で配慮のある言い回しです。",
              consequenceVi: "Câu viết tinh tế và có 配慮.",
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
              consequenceJa: "敬語が崩れ、内輪の口調になっています。",
              consequenceVi: "Mất hẳn 敬語, giọng nội bộ.",
              affectedNpcSlug: "sato_kokyaku",
              errorType: "internal_external_tone_mismatch"
            }
          }
        ]
      }
    }
  ]
};

const rewardsPayload = {
  rankXp: 24,
  skillGains: { keigo: 8, written: 5, customer: 3 },
  npcTrustGains: [
    { npcSlug: "yamada_bucho", delta: 12 },
    { npcSlug: "sato_kokyaku", delta: 8 },
    { npcSlug: "tanaka_senpai", delta: 4 }
  ],
  contextMemoDrops: [
    {
      id: "memo_osewani",
      cardKind: "expression_pair",
      expressionJa: "いつもお世話になっております",
      reading: "いつもおせわになっております",
      surfaceMeaningVi: "Luôn nhận được sự giúp đỡ.",
      realIntentVi: "Câu mở đầu chuẩn cho email gửi khách hàng.",
      sceneJa: "取引先へのメール冒頭",
      toneVi: "Lịch sự (敬語), bắt buộc với 取引先.",
      bjtTrapVi: "Dùng お疲れ様です với khách hàng là sai ngữ cảnh.",
      fromNpcSlug: "tanaka_senpai"
    }
  ],
  npcReactionMontage: [
    { npcSlug: "yamada_bucho", quoteJa: "うん、その配慮は大事だね。次もこの調子で頼むよ。", sentiment: "positive" },
    { npcSlug: "tanaka_senpai", quoteJa: "ナイス。クッション言葉、自然に使えてたね。", sentiment: "positive" },
    { npcSlug: "sato_kokyaku", quoteJa: "ご丁寧なご連絡、ありがとうございます。", sentiment: "positive" }
  ]
};

async function main() {
  for (const [index, rank] of ranks.entries()) {
    const [rankCode, titleJa, titleVi, bjtBandTarget, minSkillFloor, requiredArcCount, xpToNext, sceneTypes] = rank;
    await prisma.careerRank.upsert({
      create: {
        bjtBandTarget,
        displayOrder: index + 1,
        minSkillFloor,
        rankCode,
        requiredArcCount,
        rewardsPayload: { seed: true } as Prisma.InputJsonValue,
        titleJa,
        titleVi,
        unlockedSceneTypes: sceneTypes as unknown as Prisma.InputJsonValue,
        xpToNext
      },
      update: {
        bjtBandTarget,
        displayOrder: index + 1,
        minSkillFloor,
        requiredArcCount,
        titleJa,
        titleVi,
        unlockedSceneTypes: sceneTypes as unknown as Prisma.InputJsonValue,
        xpToNext
      },
      where: { rankCode }
    });
  }

  for (const npc of npcs) {
    await prisma.storyNpc.upsert({
      create: { ...npc, avatarMedia: npc.avatarMedia as Prisma.InputJsonValue, status: "active" },
      update: { ...npc, avatarMedia: npc.avatarMedia as Prisma.InputJsonValue, status: "active" },
      where: { slug: npc.slug }
    });
  }

  const arcs = [
    {
      slug: "arc.onboarding",
      titleJa: "入社オンボーディング",
      titleVi: "Onboarding công ty Nhật",
      rankCodeEntry: "R1",
      status: "published",
      displayOrder: 0,
      storyPayload: { synopsisVi: "Làm quen với nhịp công ty Nhật.", npcSlugs: ["tanaka_senpai"], artAccent: "#059669" }
    },
    {
      slug: "arc.hou-ren-sou",
      titleJa: "報連相 基礎",
      titleVi: "Nền tảng 報連相",
      rankCodeEntry: "R2",
      status: "published",
      displayOrder: 1,
      storyPayload: { synopsisVi: "Báo cáo, liên lạc, tham vấn đúng lúc.", npcSlugs: ["yamada_bucho", "tanaka_senpai"], artAccent: "#0E7490" }
    },
    {
      slug: "arc.client-email",
      titleJa: "取引先メール",
      titleVi: "Email gửi khách hàng",
      rankCodeEntry: "R1",
      status: "published",
      displayOrder: 2,
      storyPayload: { synopsisVi: "Viết email tới khách hàng bên ngoài: báo giá, theo dõi, từ chối khéo.", npcSlugs: ["sato_kokyaku", "yamada_bucho", "tanaka_senpai"], artAccent: "#1B2A4A" }
    }
  ] as const;

  for (const arc of arcs) {
    await prisma.missionArc.upsert({
      create: { ...arc, storyPayload: arc.storyPayload as Prisma.InputJsonValue },
      update: { ...arc, storyPayload: arc.storyPayload as Prisma.InputJsonValue },
      where: { slug: arc.slug }
    });
  }

  const clientArc = await prisma.missionArc.findUniqueOrThrow({ where: { slug: "arc.client-email" } });
  const chapters = [
    {
      slug: "follow-up-after-quote",
      titleJa: "見積もり送付後のフォローアップ",
      titleVi: "Theo dõi sau khi gửi báo giá",
      displayOrder: 1,
      isBoss: false,
      briefingPayload: {
        briefingJa: "三日前に佐藤様へ見積書を送りましたが、まだ返信がありません。山田部長から「今日中に丁寧にフォローして」と指示がありました。",
        briefingVi: "Bạn đã gửi báo giá cho Sato-san 3 ngày trước nhưng chưa có hồi âm. Yamada-bucho nhắc bạn theo dõi trong ngày, ngôn ngữ phải nhã nhặn.",
        yourRoleVi: "Bạn là 田中 太郎 — phụ trách khách hàng Tokyo Technology.",
        estimatedMinutes: 6
      },
      scenarioPayload: chapterScenario,
      rewardsPayload
    }
  ];

  for (const chapter of chapters) {
    await prisma.missionChapter.upsert({
      create: {
        ...chapter,
        arcId: clientArc.id,
        briefingPayload: chapter.briefingPayload as Prisma.InputJsonValue,
        rewardsPayload: chapter.rewardsPayload as Prisma.InputJsonValue,
        scenarioPayload: chapter.scenarioPayload as Prisma.InputJsonValue
      },
      update: {
        titleJa: chapter.titleJa,
        titleVi: chapter.titleVi,
        briefingPayload: chapter.briefingPayload as Prisma.InputJsonValue,
        displayOrder: chapter.displayOrder,
        isBoss: chapter.isBoss,
        rewardsPayload: chapter.rewardsPayload as Prisma.InputJsonValue,
        scenarioPayload: chapter.scenarioPayload as Prisma.InputJsonValue
      },
      where: { arcId_slug: { arcId: clientArc.id, slug: chapter.slug } }
    });
  }

  console.log("Seeded Career RPG ranks, NPCs, arcs, and starter chapters.");
}

main()
  .finally(() => prisma.$disconnect())
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
