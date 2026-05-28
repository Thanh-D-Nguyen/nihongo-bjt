import { parseServerEnv } from "../../../../packages/config/src/index.js";
import { createPrismaClient, type Prisma } from "../../../../packages/database/src/index.js";
import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../../.env") });

const env = parseServerEnv(process.env);
const prisma = createPrismaClient(env.DATABASE_URL);

type ModuleSeed = {
  category: string;
  descriptionVi: string;
  disclaimerVi?: string;
  isSpotlightEligible: boolean;
  metadata: Prisma.InputJsonValue;
  moduleKey: string;
  moduleType: string;
  priority: number;
  routePath: string;
  titleJa: string;
  titleVi: string;
  visualTheme: string;
};

type CardSeed = {
  badgeTextVi: string;
  category: string;
  ctaLabelVi: string;
  descriptionVi: string;
  estimatedMinutes: number;
  isPinned: boolean;
  isSpotlight: boolean;
  levelLabel: string;
  metadata: Prisma.InputJsonValue;
  moduleKey: string;
  priority: number;
  recommendationReasonVi: string;
  slug: string;
  targetRoute?: string;
  titleJa?: string;
  titleVi: string;
};

const modules: ModuleSeed[] = [
  {
    category: "work",
    descriptionVi:
      "Luyện tiếng Nhật công sở qua tình huống thực tế: email, họp, báo cáo, xử lý khách hàng và phản ứng kiểu BJT.",
    isSpotlightEligible: true,
    metadata: {
      coreProduct: true,
      dailyMissionEnabled: true,
      recommendedBand: "BJT J2",
      skills: ["business_email", "meeting", "keigo", "honne_tatemae"]
    },
    moduleKey: "workplace_mission",
    moduleType: "scenario_link",
    priority: 100,
    routePath: "/vi/story/arcs",
    titleJa: "今日の仕事シーン",
    titleVi: "Tình huống công việc",
    visualTheme: "blue_corporate"
  },
  {
    category: "work",
    descriptionVi: "Luyện cách hiểu ý thật sau những câu nói vòng vo trong công ty Nhật.",
    isSpotlightEligible: true,
    metadata: {
      focus: "business_nuance",
      skills: ["implied_meaning", "soft_refusal", "indirect_disagreement"]
    },
    moduleKey: "honne_tatemae",
    moduleType: "content",
    priority: 95,
    routePath: "/vi/modules/honne_tatemae",
    titleJa: "本音と建前",
    titleVi: "Đọc ẩn ý tiếng Nhật",
    visualTheme: "indigo_culture"
  },
  {
    category: "life",
    descriptionVi:
      "Một lát cắt nhỏ về ngày hôm nay ở Nhật: mùa, văn hoá, sự kiện, từ vựng và mẫu câu nên biết.",
    isSpotlightEligible: true,
    metadata: { contentType: "daily_life_note", dailyRefreshExpected: true },
    moduleKey: "japan_today",
    moduleType: "content",
    priority: 90,
    routePath: "/vi/modules/japan_today",
    titleJa: "今日は何の日",
    titleVi: "Hôm nay có gì ở Nhật",
    visualTheme: "green_life"
  },
  {
    category: "life",
    descriptionVi: "Học từ vựng và câu giao tiếp thời tiết dùng được ngay trong ngày.",
    isSpotlightEligible: true,
    metadata: { defaultLocation: "Tokyo", phraseEnabled: true, realWeatherApi: false },
    moduleKey: "weather_japanese",
    moduleType: "content",
    priority: 88,
    routePath: "/vi/modules/weather_japanese",
    titleJa: "天気と言葉",
    titleVi: "Thời tiết & tiếng Nhật",
    visualTheme: "sky_weather"
  },
  {
    category: "life",
    descriptionVi: "Các mẹo thực dụng giúp người Việt xử lý tình huống thường gặp khi sống ở Nhật.",
    isSpotlightEligible: true,
    metadata: { phrasePackEnabled: true, target: "vietnamese_residents_in_japan" },
    moduleKey: "life_hack",
    moduleType: "content",
    priority: 86,
    routePath: "/vi/modules/life_hack",
    titleJa: "生活のコツ",
    titleVi: "Mẹo sống ở Nhật",
    visualTheme: "green_life"
  },
  {
    category: "procedure",
    descriptionVi:
      "Mẫu câu, checklist và từ vựng khi làm thủ tục ở cục xuất nhập cảnh, kuyakusho, bảo hiểm, My Number.",
    disclaimerVi:
      "Thông tin chỉ mang tính tham khảo. Khi làm thủ tục, hãy kiểm tra nguồn chính thức hoặc hỏi cơ quan phụ trách.",
    isSpotlightEligible: true,
    metadata: { legalAdvice: false, officialSourceRequired: true },
    moduleKey: "visa_cityhall",
    moduleType: "content",
    priority: 84,
    routePath: "/vi/modules/visa_cityhall",
    titleJa: "役所・在留手続き",
    titleVi: "Visa & thủ tục",
    visualTheme: "slate_procedure"
  },
  {
    category: "news",
    descriptionVi: "Biến tin tức Nhật thành bài đọc ngắn, từ vựng và câu hỏi kiểu BJT.",
    isSpotlightEligible: true,
    metadata: { connectExistingNhk: true, practiceType: "reading" },
    moduleKey: "news_bjt",
    moduleType: "news_link",
    priority: 82,
    routePath: "/vi/news",
    titleJa: "ニュースでBJT",
    titleVi: "News → BJT",
    visualTheme: "indigo_news"
  },
  {
    category: "work",
    descriptionVi: "Luyện tiếng Nhật phỏng vấn, CV, lý do chuyển việc và trao đổi với HR.",
    isSpotlightEligible: true,
    metadata: { skills: ["interview", "hr_japanese", "career"] },
    moduleKey: "interview_career",
    moduleType: "content",
    priority: 78,
    routePath: "/vi/modules/interview_career",
    titleJa: "転職・面接日本語",
    titleVi: "Phỏng vấn & chuyển việc",
    visualTheme: "blue_corporate"
  },
  {
    category: "money",
    descriptionVi: "Học tiếng Nhật qua tỷ giá, thị trường, quyết toán, IR và từ vựng đầu tư.",
    disclaimerVi:
      "Nội dung chỉ nhằm mục đích học tiếng Nhật và tham khảo thông tin, không phải lời khuyên đầu tư.",
    isSpotlightEligible: false,
    metadata: { educationOnly: true, financialAdvice: false, topics: ["USDJPY", "Nikkei", "IR", "earnings"] },
    moduleKey: "market_watch",
    moduleType: "ai_lab",
    priority: 76,
    routePath: "/vi/modules/market_watch",
    titleJa: "投資ニュース日本語",
    titleVi: "Market Japanese",
    visualTheme: "amber_money"
  },
  {
    category: "safety",
    descriptionVi:
      "Từ vựng và mẫu câu khi động đất, bão, tai nạn, bệnh viện, mất đồ hoặc cần gọi khẩn cấp.",
    isSpotlightEligible: true,
    metadata: { emergency: true, officialEmergencyServices: ["110", "119"] },
    moduleKey: "safety_emergency",
    moduleType: "content",
    priority: 74,
    routePath: "/vi/modules/safety_emergency",
    titleJa: "防災・緊急日本語",
    titleVi: "An toàn & khẩn cấp",
    visualTheme: "red_safety"
  },
  {
    category: "entertainment",
    descriptionVi: "Phân tích Loto6/Loto7 bằng thống kê và AI ở mức tham khảo/giải trí.",
    disclaimerVi:
      "Kết quả chỉ mang tính tham khảo/giải trí, không đảm bảo trúng thưởng. Hãy chơi có trách nhiệm.",
    isSpotlightEligible: false,
    metadata: {
      disclaimerRequired: true,
      entertainmentOnly: true,
      guaranteedWin: false,
      supportedGames: ["loto6", "loto7"]
    },
    moduleKey: "loto_ai_lab",
    moduleType: "ai_lab",
    priority: 72,
    routePath: "/vi/modules/loto_ai_lab",
    titleJa: "AI統計ラボ",
    titleVi: "Loto AI Lab",
    visualTheme: "purple_ai"
  },
  {
    category: "life",
    descriptionVi: "Mẫu câu khi đi khám, mua thuốc ở drugstore, mô tả triệu chứng và đặt lịch khám.",
    disclaimerVi: "Nội dung chỉ hỗ trợ ngôn ngữ và thông tin chung, không thay thế tư vấn y tế.",
    isSpotlightEligible: true,
    metadata: { medicalAdvice: false, phrasePackEnabled: true },
    moduleKey: "health_clinic",
    moduleType: "content",
    priority: 70,
    routePath: "/vi/modules/health_clinic",
    titleJa: "病院・薬局の日本語",
    titleVi: "Bệnh viện & thuốc",
    visualTheme: "teal_health"
  },
  {
    category: "life",
    descriptionVi: "Từ vựng và mẫu câu khi tàu trễ, đổi tuyến, hỏi đường, mua vé và đi làm hằng ngày.",
    isSpotlightEligible: false,
    metadata: { topics: ["train_delay", "commute", "station_phrases"] },
    moduleKey: "transport_commute",
    moduleType: "content",
    priority: 68,
    routePath: "/vi/modules/transport_commute",
    titleJa: "電車・通勤日本語",
    titleVi: "Đi lại & tàu điện",
    visualTheme: "cyan_transport"
  },
  {
    category: "family",
    descriptionVi:
      "Đọc thông báo nhà trẻ/trường học, trao đổi với giáo viên, mẫu câu về con cái và gia đình.",
    isSpotlightEligible: false,
    metadata: { phrasePackEnabled: true, target: "families_in_japan" },
    moduleKey: "family_school",
    moduleType: "content",
    priority: 66,
    routePath: "/vi/modules/family_school",
    titleJa: "子育て・学校日本語",
    titleVi: "Gia đình & trường học",
    visualTheme: "rose_family"
  },
  {
    category: "money",
    descriptionVi:
      "Học cách đọc coupon, campaign hoàn point, PayPay, Rakuten, d-point và mẹo tiết kiệm ở Nhật.",
    isSpotlightEligible: false,
    metadata: { topics: ["coupon", "points", "shopping_japanese"] },
    moduleKey: "deals_points",
    moduleType: "content",
    priority: 64,
    routePath: "/vi/modules/deals_points",
    titleJa: "節約・ポイント生活",
    titleVi: "Tiết kiệm & point",
    visualTheme: "amber_money"
  }
];

const fallbackRouteByModule = new Map(modules.map((item) => [item.moduleKey, item.routePath]));

function seedMetadata(metadata: Prisma.InputJsonValue): Prisma.InputJsonValue {
  const safeObject =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : {};
  return { seed: true, ...safeObject } as Prisma.InputJsonValue;
}

function withCommonMetadata(
  partial: Record<string, unknown>,
  goal: string,
  japaneseExpressions: string[],
  skills: string[],
  disclaimerRequired = false
): Prisma.InputJsonValue {
  return {
    comingSoon: false,
    contentGoal: goal,
    disclaimerRequired,
    japaneseExpressions,
    skills,
    ...partial
  } as Prisma.InputJsonValue;
}

const cards: CardSeed[] = [
  {
    badgeTextVi: "BJT J2",
    category: "work",
    ctaLabelVi: "Xử lý tình huống",
    descriptionVi:
      "Khách hàng hỏi “tiến độ sao rồi?”. Bạn chọn cách trả lời lịch sự mà không né trách nhiệm.",
    estimatedMinutes: 5,
    isPinned: true,
    isSpotlight: true,
    levelLabel: "BJT J2",
    metadata: withCommonMetadata(
      {
        errorFocus: "responsibility_misread",
        focusSkill: "business_email",
        japaneseExpression: "進捗はいかがでしょうか",
        scenarioType: "client_email"
      },
      "Luyện phản hồi email催促 đúng chuẩn công sở Nhật.",
      ["進捗はいかがでしょうか", "ご連絡ありがとうございます"],
      ["business_email", "keigo"]
    ),
    moduleKey: "workplace_mission",
    priority: 220,
    recommendationReasonVi: "Vì email 催促 là tình huống rất thường gặp khi làm việc với người Nhật.",
    slug: "client-follow-up-email-j2",
    targetRoute: "/vi/story/arcs",
    titleVi: "催促メールが来た — Khách hàng hỏi gấp tiến độ"
  },
  {
    badgeTextVi: "報連相",
    category: "work",
    ctaLabelVi: "Luyện báo cáo",
    descriptionVi: "Luyện cách báo cáo chậm tiến độ với sếp mà vẫn rõ nguyên nhân và next action.",
    estimatedMinutes: 6,
    isPinned: true,
    isSpotlight: false,
    levelLabel: "N2 / BJT J2",
    metadata: withCommonMetadata(
      { errorFocus: "deadline_misread", focusSkill: "report", scenarioType: "report" },
      "Rèn cách báo cáo trễ hạn mà vẫn giữ độ tin cậy.",
      ["納期", "遅延", "報告"],
      ["horenso", "reporting"]
    ),
    moduleKey: "workplace_mission",
    priority: 218,
    recommendationReasonVi: "BJT và công ty Nhật đều đánh giá cao 報連相 đúng thời điểm.",
    slug: "report-delay-to-manager",
    targetRoute: "/vi/story/arcs",
    titleVi: "納期遅延を報告する — Báo cáo trễ deadline"
  },
  {
    badgeTextVi: "Email",
    category: "work",
    ctaLabelVi: "Thử trả lời",
    descriptionVi: "Bạn cần đổi lịch với khách hàng. Câu nào lịch sự và tự nhiên nhất?",
    estimatedMinutes: 4,
    isPinned: false,
    isSpotlight: false,
    levelLabel: "N3-N2",
    metadata: withCommonMetadata(
      { focusSkill: "business_email", scenarioType: "meeting" },
      "Luyện đổi lịch họp mà không gây cảm giác bất tiện.",
      ["日程変更", "ご調整いただけますでしょうか"],
      ["business_email", "meeting"]
    ),
    moduleKey: "workplace_mission",
    priority: 214,
    recommendationReasonVi: "Đây là mẫu email/hội thoại dùng rất nhiều khi đi làm.",
    slug: "reschedule-meeting-politely",
    targetRoute: "/vi/story/arcs",
    titleVi: "会議の日程変更 — Xin đổi lịch họp"
  },
  {
    badgeTextVi: "会話",
    category: "work",
    ctaLabelVi: "Học cách hỏi",
    descriptionVi: "Luyện cách hỏi lại senpai/sếp mà không bị xem là thiếu chủ động.",
    estimatedMinutes: 5,
    isPinned: false,
    isSpotlight: false,
    levelLabel: "N3-N2",
    metadata: withCommonMetadata(
      { focusSkill: "keigo", scenarioType: "meeting" },
      "Rèn cách hỏi làm rõ chỉ thị mơ hồ trong team.",
      ["確認させてください", "念のため"],
      ["clarification", "keigo"]
    ),
    moduleKey: "workplace_mission",
    priority: 212,
    recommendationReasonVi: "Người học thường ngại hỏi lại, nhưng hỏi sai cách dễ gây hiểu nhầm.",
    slug: "unclear-instruction-senpai",
    targetRoute: "/vi/story/arcs",
    titleVi: "指示が曖昧なとき — Khi không hiểu chỉ thị"
  },
  {
    badgeTextVi: "Customer",
    category: "work",
    ctaLabelVi: "Xử lý claim",
    descriptionVi: "Khách hàng đang bực. Bạn nên mở lời thế nào để giảm căng thẳng?",
    estimatedMinutes: 7,
    isPinned: false,
    isSpotlight: false,
    levelLabel: "BJT J2",
    metadata: withCommonMetadata(
      { focusSkill: "nuance", scenarioType: "complaint" },
      "Luyện phản hồi đầu tiên khi khách hàng phàn nàn.",
      ["ご不便をおかけし", "お詫び申し上げます"],
      ["complaint_handling", "keigo"]
    ),
    moduleKey: "workplace_mission",
    priority: 210,
    recommendationReasonVi: "Xử lý claim là tình huống business Japanese rất quan trọng.",
    slug: "complaint-first-response",
    targetRoute: "/vi/story/arcs",
    titleVi: "クレームの第一声 — Câu đầu tiên khi bị phàn nàn"
  },
  {
    badgeTextVi: "Listening",
    category: "work",
    ctaLabelVi: "Luyện nghe",
    descriptionVi: "Nghe đoạn họp ngắn và xác định ai cần làm gì trước khi nào.",
    estimatedMinutes: 6,
    isPinned: false,
    isSpotlight: false,
    levelLabel: "BJT J2",
    metadata: withCommonMetadata(
      { errorFocus: "action_item_miss", focusSkill: "listening", scenarioType: "meeting" },
      "Tập bắt action item sau cuộc họp ngắn.",
      ["担当", "期限", "対応"],
      ["listening", "meeting"]
    ),
    moduleKey: "workplace_mission",
    priority: 208,
    recommendationReasonVi: "BJT rất hay hỏi next action và trách nhiệm của từng người.",
    slug: "meeting-action-items",
    targetRoute: "/vi/story/arcs",
    titleVi: "会議のToDoを聞き取る"
  },
  {
    badgeTextVi: "Nuance",
    category: "work",
    ctaLabelVi: "Luyện nuance",
    descriptionVi: "Không nói “できません” quá thẳng. Học cách từ chối vẫn giữ quan hệ.",
    estimatedMinutes: 5,
    isPinned: false,
    isSpotlight: false,
    levelLabel: "N2+",
    metadata: withCommonMetadata(
      { errorFocus: "soft_refusal_misread", focusSkill: "nuance", scenarioType: "client_email" },
      "Luyện cách từ chối mềm trong ngữ cảnh khách hàng.",
      ["難しいかもしれません", "別案をご提案します"],
      ["soft_refusal", "business_nuance"]
    ),
    moduleKey: "workplace_mission",
    priority: 206,
    recommendationReasonVi: "Đây là điểm khác biệt giữa tiếng Nhật sách vở và business Japanese thực tế.",
    slug: "soft-refusal-client",
    targetRoute: "/vi/story/arcs",
    titleVi: "やんわり断る — Từ chối mềm với khách hàng"
  },
  {
    badgeTextVi: "本音建前",
    category: "work",
    ctaLabelVi: "Đọc ẩn ý",
    descriptionVi: "Học cách phân biệt khi nào “sẽ cân nhắc” là thiện chí thật, khi nào là từ chối mềm.",
    estimatedMinutes: 4,
    isPinned: true,
    isSpotlight: false,
    levelLabel: "N2+",
    metadata: withCommonMetadata(
      { focusSkill: "nuance", scenarioType: "meeting" },
      "Phân biệt tín hiệu đồng ý thật và từ chối mềm.",
      ["検討します", "前向きに検討します"],
      ["implied_meaning", "honne_tatemae"]
    ),
    moduleKey: "honne_tatemae",
    priority: 204,
    recommendationReasonVi: "Đây là bẫy 本音・建前 kinh điển trong công ty Nhật.",
    slug: "kentou-shimasu-real-meaning",
    titleVi: "「検討します」は đồng ý hay từ chối?"
  },
  {
    badgeTextVi: "Ẩn ý",
    category: "work",
    ctaLabelVi: "Giải mã",
    descriptionVi: "Câu này có thể nhẹ nhàng hơn “không được”, nhưng trong business thường là tín hiệu cảnh báo.",
    estimatedMinutes: 4,
    isPinned: false,
    isSpotlight: false,
    levelLabel: "N2",
    metadata: withCommonMetadata(
      { focusSkill: "nuance", scenarioType: "meeting" },
      "Hiểu tín hiệu từ chối dạng gián tiếp trong trao đổi công việc.",
      ["少し難しいかもしれません"],
      ["implied_meaning", "soft_refusal"]
    ),
    moduleKey: "honne_tatemae",
    priority: 202,
    recommendationReasonVi: "Người Việt dễ hiểu quá literal và bỏ lỡ tín hiệu từ chối.",
    slug: "muzukashii-kamoshiremasen",
    titleVi: "「少し難しいかもしれません」の真意"
  },
  {
    badgeTextVi: "Business nuance",
    category: "work",
    ctaLabelVi: "Học sắc thái",
    descriptionVi: "Không phải lúc nào “tích cực cân nhắc” cũng là cam kết.",
    estimatedMinutes: 3,
    isPinned: false,
    isSpotlight: false,
    levelLabel: "N2+",
    metadata: withCommonMetadata(
      { focusSkill: "nuance", scenarioType: "meeting" },
      "Rèn cách đọc mức độ chắc chắn của phát ngôn trong business Nhật.",
      ["前向きに検討します", "社内で確認します"],
      ["implied_meaning", "business_nuance"]
    ),
    moduleKey: "honne_tatemae",
    priority: 200,
    recommendationReasonVi: "Luyện đọc mức độ chắc chắn trong phát ngôn business.",
    slug: "maemuki-ni-kentou",
    titleVi: "「前向きに検討します」を hiểu sao?"
  },
  {
    badgeTextVi: "Hôm nay",
    category: "life",
    ctaLabelVi: "Học 3 phút",
    descriptionVi: "Học các từ như 梅雨, 湿気, 蒸し暑い và câu nói chuyện nhỏ với đồng nghiệp.",
    estimatedMinutes: 3,
    isPinned: false,
    isSpotlight: false,
    levelLabel: "N4-N3",
    metadata: withCommonMetadata(
      { weatherType: "rain" },
      "Bổ sung từ vựng mùa mưa để dùng ngay trong small talk.",
      ["梅雨", "湿気", "蒸し暑い"],
      ["seasonal_vocab", "small_talk"]
    ),
    moduleKey: "japan_today",
    priority: 198,
    recommendationReasonVi: "Mùa mưa là chủ đề giao tiếp hằng ngày ở công ty.",
    slug: "rainy-season-words",
    titleVi: "梅雨の日本語 — Từ vựng mùa mưa"
  },
  {
    badgeTextVi: "An toàn",
    category: "life",
    ctaLabelVi: "Học nhanh",
    descriptionVi: "Học những câu cần biết khi nói về động đất, nơi sơ tán và chuẩn bị khẩn cấp.",
    estimatedMinutes: 5,
    isPinned: false,
    isSpotlight: false,
    levelLabel: "N3",
    metadata: withCommonMetadata(
      { weatherType: "typhoon" },
      "Luyện vốn từ phòng chống thiên tai theo ngày kỷ niệm 防災の日.",
      ["避難所", "防災", "非常持ち出し袋"],
      ["safety_vocab", "daily_life"]
    ),
    moduleKey: "japan_today",
    priority: 196,
    recommendationReasonVi: "Sống ở Nhật nên biết tiếng Nhật phòng chống thiên tai.",
    slug: "disaster-prevention-day",
    titleVi: "防災の日に覚える言葉"
  },
  {
    badgeTextVi: "Email",
    category: "life",
    ctaLabelVi: "Xem mẫu câu",
    descriptionVi: "Học vài câu mở đầu email theo mùa, dùng được khi viết cho đối tác Nhật.",
    estimatedMinutes: 4,
    isPinned: false,
    isSpotlight: false,
    levelLabel: "N2",
    metadata: withCommonMetadata(
      {},
      "Luyện seasonal greeting trong email business.",
      ["時下ますますご清栄のこととお喜び申し上げます"],
      ["business_email", "seasonal_expression"]
    ),
    moduleKey: "japan_today",
    priority: 194,
    recommendationReasonVi: "Email business Nhật thường dùng lời chào theo mùa.",
    slug: "seasonal-greeting-email",
    titleVi: "季節の挨拶 trong email"
  },
  {
    badgeTextVi: "会話",
    category: "life",
    ctaLabelVi: "Luyện nói",
    descriptionVi: "5 câu nói tự nhiên về thời tiết, tàu điện và cuối tuần.",
    estimatedMinutes: 3,
    isPinned: false,
    isSpotlight: false,
    levelLabel: "N4-N3",
    metadata: withCommonMetadata(
      {},
      "Luyện small talk văn phòng để tăng hòa nhập.",
      ["週末はどうでしたか", "電車が遅れていましたね"],
      ["small_talk", "office_conversation"]
    ),
    moduleKey: "japan_today",
    priority: 192,
    recommendationReasonVi: "Small talk giúp hoà nhập ở công ty Nhật.",
    slug: "today-small-talk-office",
    titleVi: "今日の雑談 — Nói chuyện nhỏ ở văn phòng"
  },
  {
    badgeTextVi: "Weather",
    category: "life",
    ctaLabelVi: "Học câu hôm nay",
    descriptionVi: "Mang ô nhé. Học câu “午後から雨が降るらしいです。”",
    estimatedMinutes: 2,
    isPinned: false,
    isSpotlight: false,
    levelLabel: "N4",
    metadata: withCommonMetadata(
      { phraseJa: "午後から雨が降るらしいです。", phraseVi: "Chiều có vẻ sẽ mưa.", weatherType: "rain" },
      "Học câu thời tiết ngắn để mở đầu hội thoại mỗi ngày.",
      ["今日は雨が降りそうです", "午後から雨が降るらしいです"],
      ["weather_phrase", "small_talk"]
    ),
    moduleKey: "weather_japanese",
    priority: 190,
    recommendationReasonVi: "Một câu thời tiết nhỏ có thể mở đầu cuộc trò chuyện tự nhiên.",
    slug: "rain-umbrella-phrase",
    titleVi: "今日は雨が降りそうです"
  },
  {
    badgeTextVi: "Mùa hè",
    category: "life",
    ctaLabelVi: "Học mẫu câu",
    descriptionVi: "Học cách nói về nắng nóng, say nắng và nhắc người khác giữ sức.",
    estimatedMinutes: 3,
    isPinned: false,
    isSpotlight: false,
    levelLabel: "N3",
    metadata: withCommonMetadata(
      {
        phraseJa: "熱中症に気をつけてください。",
        phraseVi: "Hãy cẩn thận say nắng nhé.",
        weatherType: "heat"
      },
      "Chuẩn bị câu nhắc nhở sức khỏe mùa hè.",
      ["熱中症", "水分補給"],
      ["weather_phrase", "health_communication"]
    ),
    moduleKey: "weather_japanese",
    priority: 188,
    recommendationReasonVi: "Mùa hè ở Nhật rất hay có cảnh báo 熱中症.",
    slug: "heatstroke-warning-phrase",
    titleVi: "熱中症に気をつけてください"
  },
  {
    badgeTextVi: "通勤",
    category: "life",
    ctaLabelVi: "Học cách báo trễ",
    descriptionVi: "Học cách báo trễ khi tàu chậm do mưa lớn.",
    estimatedMinutes: 4,
    isPinned: false,
    isSpotlight: false,
    levelLabel: "N3",
    metadata: withCommonMetadata(
      {
        phraseJa: "大雨で電車が遅れています。",
        phraseVi: "Tàu đang trễ do mưa lớn.",
        weatherType: "rain"
      },
      "Nắm mẫu câu báo trễ liên quan thời tiết.",
      ["大雨で電車が遅れています"],
      ["commute", "weather_phrase"]
    ),
    moduleKey: "weather_japanese",
    priority: 186,
    recommendationReasonVi: "Đây là tình huống đi làm rất thực tế ở Nhật.",
    slug: "train-delay-weather",
    titleVi: "大雨で電車が遅れています"
  },
  {
    badgeTextVi: "生活",
    category: "life",
    ctaLabelVi: "Xem hướng dẫn",
    descriptionVi: "Có phiếu giao hàng vắng nhà thì làm gì? Học cách gọi/đặt giao lại.",
    estimatedMinutes: 5,
    isPinned: false,
    isSpotlight: false,
    levelLabel: "N4-N3",
    metadata: withCommonMetadata(
      {},
      "Giúp người học xử lý phiếu giao hàng vắng nhà.",
      ["不在票", "再配達"],
      ["daily_life", "service_call"]
    ),
    moduleKey: "life_hack",
    priority: 184,
    recommendationReasonVi: "Ai sống ở Nhật cũng gặp 不在票 ít nhất vài lần.",
    slug: "missed-delivery-slip",
    titleVi: "不在票が入っていたら？"
  },
  {
    badgeTextVi: "Life",
    category: "life",
    ctaLabelVi: "Học từ vựng",
    descriptionVi: "Học các từ 可燃ごみ, 不燃ごみ, 資源ごみ và cách hỏi ngày đổ rác.",
    estimatedMinutes: 5,
    isPinned: false,
    isSpotlight: false,
    levelLabel: "N5-N4",
    metadata: withCommonMetadata(
      {},
      "Luyện vốn từ phân loại rác và quy định địa phương.",
      ["可燃ごみ", "不燃ごみ", "資源ごみ"],
      ["daily_life_vocab"]
    ),
    moduleKey: "life_hack",
    priority: 182,
    recommendationReasonVi: "Phân loại rác là kỹ năng sống bắt buộc ở Nhật.",
    slug: "trash-sorting-basic",
    titleVi: "ゴミの分別 — Phân loại rác"
  },
  {
    badgeTextVi: "Thuốc",
    category: "life",
    ctaLabelVi: "Học mẫu câu",
    descriptionVi: "Học cách hỏi thuốc đau đầu, cảm lạnh, đau bụng ở drugstore.",
    estimatedMinutes: 6,
    isPinned: false,
    isSpotlight: false,
    levelLabel: "N4-N3",
    metadata: withCommonMetadata(
      { medicalAdvice: false, phrasePackEnabled: true },
      "Giúp xử lý nhanh tình huống mua thuốc không kê đơn.",
      ["頭痛", "風邪薬", "腹痛"],
      ["drugstore_phrase", "health_life"]
    ),
    moduleKey: "life_hack",
    priority: 180,
    recommendationReasonVi: "Biết vài câu này giúp bạn tự xử lý tình huống nhỏ hằng ngày.",
    slug: "drugstore-phrases",
    titleVi: "ドラッグストアで薬を買う"
  },
  {
    badgeTextVi: "郵便局",
    category: "life",
    ctaLabelVi: "Xem mẫu câu",
    descriptionVi: "Từ vựng và mẫu câu khi nhận bưu phẩm, gửi đồ, hỏi phí gửi.",
    estimatedMinutes: 5,
    isPinned: false,
    isSpotlight: false,
    levelLabel: "N4-N3",
    metadata: withCommonMetadata(
      {},
      "Luyện tiếng Nhật dùng ở bưu điện.",
      ["受け取り", "送料", "追跡番号"],
      ["daily_life", "service_counter"]
    ),
    moduleKey: "life_hack",
    priority: 178,
    recommendationReasonVi: "Bưu điện Nhật rất hay dùng từ chuyên biệt.",
    slug: "post-office-redelivery",
    titleVi: "郵便局で荷物を受け取る"
  },
  {
    badgeTextVi: "Chung cư",
    category: "life",
    ctaLabelVi: "Đọc thử",
    descriptionVi: "Đọc thông báo tiếng Nhật trong chung cư về tiếng ồn, rác, xe đạp.",
    estimatedMinutes: 4,
    isPinned: false,
    isSpotlight: false,
    levelLabel: "N3",
    metadata: withCommonMetadata(
      {},
      "Luyện đọc notice thực tế trong khu dân cư.",
      ["騒音", "注意", "駐輪場"],
      ["reading_notice", "daily_life"]
    ),
    moduleKey: "life_hack",
    priority: 176,
    recommendationReasonVi: "Đây là loại tiếng Nhật người sống ở Nhật gặp thường xuyên.",
    slug: "apartment-noise-note",
    titleVi: "騒音注意の貼り紙を読む"
  },
  {
    badgeTextVi: "Visa",
    category: "procedure",
    ctaLabelVi: "Học cách hỏi",
    descriptionVi: "Gia hạn visa cần gọi hỏi người phụ trách thế nào?",
    estimatedMinutes: 6,
    isPinned: false,
    isSpotlight: false,
    levelLabel: "N3-N2",
    metadata: withCommonMetadata(
      { officialSourceRequired: true, procedureType: "residence_card_renewal" },
      "Luyện câu xác nhận hồ sơ visa trước khi đi nộp.",
      ["在留カード更新", "必要書類"],
      ["procedure_japanese"],
      true
    ),
    moduleKey: "visa_cityhall",
    priority: 174,
    recommendationReasonVi: "Trước khi nộp hồ sơ, biết cách hỏi bằng tiếng Nhật giúp yên tâm hơn.",
    slug: "residence-card-renewal-call",
    titleVi: "在留カード更新の前に確認"
  },
  {
    badgeTextVi: "役所",
    category: "procedure",
    ctaLabelVi: "Xem checklist",
    descriptionVi: "Học mẫu câu khi chuyển địa chỉ ở kuyakusho.",
    estimatedMinutes: 5,
    isPinned: false,
    isSpotlight: false,
    levelLabel: "N4-N3",
    metadata: withCommonMetadata(
      { officialSourceRequired: true, procedureType: "address_change" },
      "Nắm thủ tục đổi địa chỉ sau khi chuyển nhà.",
      ["住所変更", "転入届", "転出届"],
      ["procedure_japanese"],
      true
    ),
    moduleKey: "visa_cityhall",
    priority: 172,
    recommendationReasonVi: "Người mới sang hoặc chuyển nhà ở Nhật đều cần thủ tục này.",
    slug: "cityhall-address-change",
    titleVi: "住所変更を役所で伝える"
  },
  {
    badgeTextVi: "My Number",
    category: "procedure",
    ctaLabelVi: "Đọc cùng tôi",
    descriptionVi: "Đọc các từ thường gặp trong thông báo My Number.",
    estimatedMinutes: 5,
    isPinned: false,
    isSpotlight: false,
    levelLabel: "N3",
    metadata: withCommonMetadata(
      { officialSourceRequired: true, procedureType: "my_number_notice" },
      "Giảm khó khăn khi đọc thông báo hành chính nhiều kanji.",
      ["マイナンバー", "通知カード", "個人番号"],
      ["official_notice_reading"],
      true
    ),
    moduleKey: "visa_cityhall",
    priority: 170,
    recommendationReasonVi: "Thông báo hành chính thường khó vì nhiều từ kanji.",
    slug: "my-number-notice",
    titleVi: "マイナンバーのお知らせを読む"
  },
  {
    badgeTextVi: "Bảo hiểm",
    category: "procedure",
    ctaLabelVi: "Học mẫu câu",
    descriptionVi: "Học cách hỏi về bảo hiểm y tế, giấy tờ và phí.",
    estimatedMinutes: 6,
    isPinned: false,
    isSpotlight: false,
    levelLabel: "N3",
    metadata: withCommonMetadata(
      { officialSourceRequired: true, procedureType: "health_insurance" },
      "Chuẩn bị câu hỏi ở quầy bảo hiểm quốc dân.",
      ["国民健康保険", "窓口", "保険料"],
      ["procedure_japanese"],
      true
    ),
    moduleKey: "visa_cityhall",
    priority: 168,
    recommendationReasonVi: "Khi làm thủ tục ở Nhật, câu hỏi rõ ràng giúp tiết kiệm thời gian.",
    slug: "health-insurance-counter",
    titleVi: "国民健康保険の窓口で聞く"
  },
  {
    badgeTextVi: "News",
    category: "news",
    ctaLabelVi: "Đọc & luyện",
    descriptionVi: "Đọc một tin ngắn và trả lời câu hỏi đọc hiểu kiểu BJT.",
    estimatedMinutes: 5,
    isPinned: false,
    isSpotlight: false,
    levelLabel: "N3-N2",
    metadata: withCommonMetadata(
      {},
      "Kết nối NHK tin thật với dạng câu hỏi BJT.",
      ["発表", "影響", "対策"],
      ["reading", "bjt_style_question"]
    ),
    moduleKey: "news_bjt",
    priority: 166,
    recommendationReasonVi: "Tin thật giúp luyện reading có ngữ cảnh.",
    slug: "nhk-easy-reading-one-question",
    targetRoute: "/vi/news",
    titleVi: "NHK News → 1 câu BJT"
  },
  {
    badgeTextVi: "BJT vocab",
    category: "news",
    ctaLabelVi: "Học từ vựng",
    descriptionVi: "Học 5 từ business từ tin tức hôm nay: 発表, 増加, 影響, 対策, 見通し.",
    estimatedMinutes: 4,
    isPinned: false,
    isSpotlight: false,
    levelLabel: "N2",
    metadata: withCommonMetadata(
      {},
      "Mở rộng từ vựng BJT từ bản tin hàng ngày.",
      ["発表", "増加", "影響", "対策", "見通し"],
      ["bjt_vocab", "reading"]
    ),
    moduleKey: "news_bjt",
    priority: 164,
    recommendationReasonVi: "Đây là nhóm từ rất hay xuất hiện trong BJT reading.",
    slug: "business-news-vocab",
    targetRoute: "/vi/news",
    titleVi: "ニュースで覚えるビジネス語"
  },
  {
    badgeTextVi: "Chart",
    category: "news",
    ctaLabelVi: "Luyện đọc số liệu",
    descriptionVi: "Luyện cách đọc xu hướng tăng/giảm trong biểu đồ và bản tin.",
    estimatedMinutes: 6,
    isPinned: false,
    isSpotlight: false,
    levelLabel: "BJT J2",
    metadata: withCommonMetadata(
      {},
      "Rèn kỹ năng đọc số liệu đi kèm tin.",
      ["増加", "減少", "前年比"],
      ["chart_reading", "bjt_reading"]
    ),
    moduleKey: "news_bjt",
    priority: 162,
    recommendationReasonVi: "BJT thường kiểm tra khả năng đọc số liệu và xu hướng.",
    slug: "chart-news-reading",
    targetRoute: "/vi/news",
    titleVi: "グラフ付きニュースを読む"
  },
  {
    badgeTextVi: "Reading",
    category: "news",
    ctaLabelVi: "Học headline",
    descriptionVi: "Tiêu đề báo Nhật hay rút gọn. Học cách hiểu nhanh cấu trúc thường gặp.",
    estimatedMinutes: 4,
    isPinned: false,
    isSpotlight: false,
    levelLabel: "N2",
    metadata: withCommonMetadata(
      {},
      "Luyện đọc headline rút gọn trong báo Nhật.",
      ["見出し", "速報", "判明"],
      ["headline_reading", "news_japanese"]
    ),
    moduleKey: "news_bjt",
    priority: 160,
    recommendationReasonVi: "Đọc được headline giúp bạn scan tin nhanh hơn.",
    slug: "headline-grammar",
    targetRoute: "/vi/news",
    titleVi: "見出しの日本語 — Đọc tiêu đề tin"
  },
  {
    badgeTextVi: "Market",
    category: "money",
    ctaLabelVi: "Học qua tỷ giá",
    descriptionVi: "Học cách hiểu 円安, 円高 và ảnh hưởng khi gửi tiền về Việt Nam.",
    estimatedMinutes: 4,
    isPinned: false,
    isSpotlight: false,
    levelLabel: "N3-N2",
    metadata: withCommonMetadata(
      { educationOnly: true, financialAdvice: false, topics: ["USDJPY"] },
      "Giải thích từ vựng tỷ giá thường gặp trong tin.",
      ["円安", "円高", "為替"],
      ["market_vocab"],
      true
    ),
    moduleKey: "market_watch",
    priority: 158,
    recommendationReasonVi: "Người Việt ở Nhật thường quan tâm tỷ giá nhưng từ vựng tài chính khá khó.",
    slug: "usd-jpy-vocab",
    titleVi: "円安・円高を読む"
  },
  {
    badgeTextVi: "Money",
    category: "money",
    ctaLabelVi: "Học market Japanese",
    descriptionVi: "Giải thích đơn giản về 日経平均 và từ vựng thị trường cơ bản.",
    estimatedMinutes: 5,
    isPinned: false,
    isSpotlight: false,
    levelLabel: "N2",
    metadata: withCommonMetadata(
      { educationOnly: true, financialAdvice: false, topics: ["Nikkei"] },
      "Hiểu chỉ số cơ bản hay gặp trên báo Nhật.",
      ["日経平均", "株価指数"],
      ["market_vocab"],
      true
    ),
    moduleKey: "market_watch",
    priority: 156,
    recommendationReasonVi: "Tin tức Nhật thường nhắc tới chỉ số này.",
    slug: "nikkei-basic",
    titleVi: "日経平均って何？"
  },
  {
    badgeTextVi: "IR",
    category: "money",
    ctaLabelVi: "Học từ IR",
    descriptionVi: "Học các từ 売上高, 営業利益, 前年比, 増収増益.",
    estimatedMinutes: 6,
    isPinned: false,
    isSpotlight: false,
    levelLabel: "N2+",
    metadata: withCommonMetadata(
      { educationOnly: true, financialAdvice: false, topics: ["IR", "earnings"] },
      "Mở rộng từ vựng quyết toán và báo cáo doanh nghiệp.",
      ["売上高", "営業利益", "前年比", "増収増益"],
      ["ir_vocab", "business_reading"],
      true
    ),
    moduleKey: "market_watch",
    priority: 154,
    recommendationReasonVi: "BJT business reading rất hợp với nhóm từ IR/quyết toán.",
    slug: "earnings-report-vocab",
    titleVi: "決算発表の言葉"
  },
  {
    badgeTextVi: "Money",
    category: "money",
    ctaLabelVi: "Học từ cơ bản",
    descriptionVi: "Học từ vựng cơ bản khi đọc về NISA/iDeCo.",
    estimatedMinutes: 5,
    isPinned: false,
    isSpotlight: false,
    levelLabel: "N2",
    metadata: withCommonMetadata(
      { educationOnly: true, financialAdvice: false, topics: ["NISA", "iDeCo"] },
      "Làm quen thuật ngữ tài chính cá nhân phổ biến tại Nhật.",
      ["NISA", "iDeCo", "積立"],
      ["money_vocab"],
      true
    ),
    moduleKey: "market_watch",
    priority: 152,
    recommendationReasonVi: "Đây là chủ đề tài chính cá nhân phổ biến ở Nhật.",
    slug: "nisa-ideco-words",
    titleVi: "NISA・iDeCoの基本語彙"
  },
  {
    badgeTextVi: "AI Lab",
    category: "entertainment",
    ctaLabelVi: "Xem phân tích",
    descriptionVi: "Xem cách thống kê số xuất hiện nhiều/ít trong dữ liệu lịch sử.",
    estimatedMinutes: 3,
    isPinned: false,
    isSpotlight: false,
    levelLabel: "Giải trí",
    metadata: withCommonMetadata(
      { entertainmentOnly: true, game: "loto6", guaranteedWin: false },
      "Biến thống kê giải trí thành bài học từ vựng xác suất.",
      ["統計", "抽選", "当選"],
      ["probability_vocab"],
      true
    ),
    moduleKey: "loto_ai_lab",
    priority: 150,
    recommendationReasonVi: "Module này giúp luyện tư duy dữ liệu và từ vựng xác suất bằng tiếng Nhật.",
    slug: "loto6-hot-cold",
    titleVi: "Loto6 AI Lab: số nóng/lạnh"
  },
  {
    badgeTextVi: "Loto7",
    category: "entertainment",
    ctaLabelVi: "Xem xu hướng",
    descriptionVi: "Phân tích cặp số hay xuất hiện cùng nhau ở mức tham khảo.",
    estimatedMinutes: 3,
    isPinned: false,
    isSpotlight: false,
    levelLabel: "Giải trí",
    metadata: withCommonMetadata(
      { entertainmentOnly: true, game: "loto7", guaranteedWin: false },
      "Luyện đọc cụm từ thống kê qua nội dung giải trí.",
      ["組み合わせ", "傾向"],
      ["probability_vocab"],
      true
    ),
    moduleKey: "loto_ai_lab",
    priority: 148,
    recommendationReasonVi: "Nội dung giải trí nhưng có thể gắn với từ vựng 統計, 確率, 抽選.",
    slug: "loto7-patterns",
    titleVi: "Loto7: cặp số thường đi cùng"
  },
  {
    badgeTextVi: "Vocab",
    category: "entertainment",
    ctaLabelVi: "Học từ thống kê",
    descriptionVi: "Học các từ xác suất qua ví dụ Loto: 確率, 統計, 抽選, 当選.",
    estimatedMinutes: 4,
    isPinned: false,
    isSpotlight: false,
    levelLabel: "N2",
    metadata: withCommonMetadata(
      { entertainmentOnly: true, game: "vocab", guaranteedWin: false },
      "Biến trò giải trí thành bài học từ vựng chắc tay.",
      ["確率", "統計", "抽選", "当選"],
      ["vocab_building"],
      true
    ),
    moduleKey: "loto_ai_lab",
    priority: 146,
    recommendationReasonVi: "Biến nội dung giải trí thành bài học tiếng Nhật có ích.",
    slug: "probability-japanese",
    titleVi: "確率・統計の日本語"
  },
  {
    badgeTextVi: "面接",
    category: "work",
    ctaLabelVi: "Luyện trả lời",
    descriptionVi: "Trả lời lý do chuyển việc sao cho tự nhiên và không gây ấn tượng xấu.",
    estimatedMinutes: 6,
    isPinned: false,
    isSpotlight: false,
    levelLabel: "N2",
    metadata: withCommonMetadata(
      { focusSkill: "nuance", scenarioType: "interview" },
      "Luyện cách nói lý do転職 thuyết phục.",
      ["転職理由", "成長機会"],
      ["interview_japanese"]
    ),
    moduleKey: "interview_career",
    priority: 144,
    recommendationReasonVi: "Đây là câu hỏi phỏng vấn rất thường gặp ở Nhật.",
    slug: "interview-tenshoku-reason",
    titleVi: "転職理由を聞かれたら？"
  },
  {
    badgeTextVi: "Career",
    category: "work",
    ctaLabelVi: "Tập 自己PR",
    descriptionVi: "Học cấu trúc nói điểm mạnh của bản thân trong 60 giây.",
    estimatedMinutes: 6,
    isPinned: false,
    isSpotlight: false,
    levelLabel: "N3-N2",
    metadata: withCommonMetadata(
      { scenarioType: "interview" },
      "Xây mẫu câu自己PR ngắn gọn cho phỏng vấn.",
      ["自己PR", "強み", "成果"],
      ["interview_japanese", "self_intro"]
    ),
    moduleKey: "interview_career",
    priority: 142,
    recommendationReasonVi: "Người Việt thường dịch trực tiếp từ tiếng Việt nên câu nghe thiếu tự nhiên.",
    slug: "self-pr-japanese",
    titleVi: "自己PRを短く言う"
  },
  {
    badgeTextVi: "HR",
    category: "work",
    ctaLabelVi: "Học cách hỏi",
    descriptionVi: "Học cách hỏi lương, remote, overtime mà vẫn lịch sự.",
    estimatedMinutes: 5,
    isPinned: false,
    isSpotlight: false,
    levelLabel: "N2",
    metadata: withCommonMetadata(
      { scenarioType: "interview" },
      "Luyện đặt câu hỏi điều kiện làm việc đúng cách.",
      ["条件面", "残業", "リモート"],
      ["interview_japanese", "hr_conversation"]
    ),
    moduleKey: "interview_career",
    priority: 140,
    recommendationReasonVi: "Hỏi điều kiện làm việc cần đúng timing và đúng cách nói.",
    slug: "salary-condition-politeness",
    titleVi: "条件面について聞く"
  },
  {
    badgeTextVi: "防災",
    category: "safety",
    ctaLabelVi: "Học câu khẩn cấp",
    descriptionVi: "5 câu tiếng Nhật cần biết khi có động đất.",
    estimatedMinutes: 4,
    isPinned: false,
    isSpotlight: false,
    levelLabel: "N4-N3",
    metadata: withCommonMetadata(
      {},
      "Chuẩn bị mẫu câu phòng thân khi động đất.",
      ["地震", "落ち着いてください", "避難してください"],
      ["emergency_phrase"]
    ),
    moduleKey: "safety_emergency",
    priority: 138,
    recommendationReasonVi: "Đây là kiến thức thiết yếu khi sống ở Nhật.",
    slug: "earthquake-phrases",
    titleVi: "地震が起きたら言う言葉"
  },
  {
    badgeTextVi: "Khẩn cấp",
    category: "safety",
    ctaLabelVi: "Học ngay",
    descriptionVi: "Học cách nói địa chỉ, tình trạng và yêu cầu xe cứu thương.",
    estimatedMinutes: 6,
    isPinned: false,
    isSpotlight: false,
    levelLabel: "N3",
    metadata: withCommonMetadata(
      {},
      "Luyện mẫu hội thoại gọi 119 ngắn, rõ, đủ thông tin.",
      ["救急車をお願いします", "住所は", "意識があります"],
      ["emergency_call"]
    ),
    moduleKey: "safety_emergency",
    priority: 136,
    recommendationReasonVi: "Tình huống khẩn cấp cần câu ngắn, rõ, đúng thông tin.",
    slug: "call-119",
    titleVi: "119番に電話する"
  },
  {
    badgeTextVi: "Koban",
    category: "safety",
    ctaLabelVi: "Học mẫu câu",
    descriptionVi: "Học cách báo mất ví ở koban và mô tả đồ bị mất.",
    estimatedMinutes: 5,
    isPinned: false,
    isSpotlight: false,
    levelLabel: "N4-N3",
    metadata: withCommonMetadata(
      {},
      "Luyện từ vựng báo mất đồ tại đồn cảnh sát gần ga.",
      ["財布をなくしました", "遺失物届"],
      ["safety_phrase", "police_report"]
    ),
    moduleKey: "safety_emergency",
    priority: 134,
    recommendationReasonVi: "Koban là nơi người nước ngoài ở Nhật có thể cần đến.",
    slug: "lost-wallet-police",
    titleVi: "財布をなくしたら？"
  },
  {
    badgeTextVi: "子育て",
    category: "family",
    ctaLabelVi: "Đọc thử",
    descriptionVi: "Đọc các từ thường gặp trong thông báo nhà trẻ: 持ち物, 提出, 連絡帳.",
    estimatedMinutes: 5,
    isPinned: false,
    isSpotlight: false,
    levelLabel: "N3",
    metadata: withCommonMetadata(
      {},
      "Giúp phụ huynh hiểu thông báo từ nhà trẻ nhanh hơn.",
      ["持ち物", "提出", "連絡帳"],
      ["family_notice_reading"]
    ),
    moduleKey: "family_school",
    priority: 132,
    recommendationReasonVi: "Phụ huynh ở Nhật gặp rất nhiều giấy thông báo.",
    slug: "hoikuen-notice",
    titleVi: "保育園のお知らせを読む"
  },
  {
    badgeTextVi: "School",
    category: "family",
    ctaLabelVi: "Học cách gọi",
    descriptionVi: "Học cách gọi báo con nghỉ học vì sốt hoặc cảm.",
    estimatedMinutes: 4,
    isPinned: false,
    isSpotlight: false,
    levelLabel: "N4-N3",
    metadata: withCommonMetadata(
      {},
      "Luyện hội thoại ngắn với trường khi con nghỉ học.",
      ["欠席します", "熱があります"],
      ["family_conversation"]
    ),
    moduleKey: "family_school",
    priority: 130,
    recommendationReasonVi: "Đây là tình huống gia đình rất thực tế.",
    slug: "call-school-sick",
    titleVi: "子どもの欠席を連絡する"
  },
  {
    badgeTextVi: "病院",
    category: "life",
    ctaLabelVi: "Học mẫu câu",
    descriptionVi: "Học cách nói đau đầu, sốt, đau bụng, chóng mặt khi đi khám.",
    estimatedMinutes: 5,
    isPinned: false,
    isSpotlight: false,
    levelLabel: "N4-N3",
    metadata: withCommonMetadata(
      { medicalAdvice: false, phrasePackEnabled: true },
      "Giúp mô tả triệu chứng rõ ràng ở phòng khám.",
      ["頭痛", "発熱", "腹痛", "めまい"],
      ["clinic_phrase"],
      true
    ),
    moduleKey: "health_clinic",
    priority: 128,
    recommendationReasonVi: "Đi bệnh viện ở Nhật sẽ dễ hơn nếu mô tả triệu chứng rõ.",
    slug: "clinic-symptoms",
    titleVi: "症状を説明する"
  },
  {
    badgeTextVi: "薬局",
    category: "life",
    ctaLabelVi: "Học câu hỏi",
    descriptionVi: "Học cách hỏi liều lượng, thời điểm uống và tác dụng phụ.",
    estimatedMinutes: 5,
    isPinned: false,
    isSpotlight: false,
    levelLabel: "N3",
    metadata: withCommonMetadata(
      { medicalAdvice: false, phrasePackEnabled: true },
      "Luyện câu hỏi ở hiệu thuốc để dùng thuốc an toàn hơn.",
      ["副作用", "用量", "食後"],
      ["pharmacy_phrase"],
      true
    ),
    moduleKey: "health_clinic",
    priority: 126,
    recommendationReasonVi: "Drugstore/nhà thuốc ở Nhật có nhiều từ chuyên môn.",
    slug: "pharmacy-side-effects",
    titleVi: "薬の副作用を聞く"
  },
  {
    badgeTextVi: "通勤",
    category: "life",
    ctaLabelVi: "Học cách báo",
    descriptionVi: "Học cách nhắn cho công ty khi tàu bị trễ.",
    estimatedMinutes: 3,
    isPinned: false,
    isSpotlight: false,
    levelLabel: "N4-N3",
    metadata: withCommonMetadata(
      {},
      "Mẫu tin nhắn ngắn báo trễ vì tàu delay.",
      ["電車遅延", "到着が遅れます"],
      ["commute_phrase", "work_communication"]
    ),
    moduleKey: "transport_commute",
    priority: 124,
    recommendationReasonVi: "Đây là câu dùng thực tế khi đi làm ở Nhật.",
    slug: "train-delay-report",
    titleVi: "電車遅延を会社に連絡"
  },
  {
    badgeTextVi: "駅",
    category: "life",
    ctaLabelVi: "Học mẫu câu",
    descriptionVi: "Học cách hỏi tuyến, cửa ra, tàu chuyển tiếp và vé.",
    estimatedMinutes: 4,
    isPinned: false,
    isSpotlight: false,
    levelLabel: "N5-N4",
    metadata: withCommonMetadata(
      {},
      "Bổ sung câu hỏi nhanh khi cần trợ giúp ở ga.",
      ["何番線", "乗り換え", "出口"],
      ["station_phrase", "commute"]
    ),
    moduleKey: "transport_commute",
    priority: 122,
    recommendationReasonVi: "Dù có Google Maps, hỏi người thật vẫn rất cần.",
    slug: "ask-station-staff",
    titleVi: "駅員さんに聞く"
  },
  {
    badgeTextVi: "節約",
    category: "money",
    ctaLabelVi: "Học cách đọc",
    descriptionVi: "Học cách đọc campaign hoàn point ở cửa hàng/app Nhật.",
    estimatedMinutes: 4,
    isPinned: false,
    isSpotlight: false,
    levelLabel: "N3",
    metadata: withCommonMetadata(
      {},
      "Giúp đọc nhanh điều kiện hoàn point để tiết kiệm.",
      ["ポイント還元", "対象店舗"],
      ["money_life_vocab"]
    ),
    moduleKey: "deals_points",
    priority: 120,
    recommendationReasonVi: "Người sống ở Nhật có thể tiết kiệm hơn nếu hiểu các từ này.",
    slug: "point-campaign-reading",
    titleVi: "ポイント還元を読む"
  },
  {
    badgeTextVi: "Coupon",
    category: "money",
    ctaLabelVi: "Đọc điều kiện",
    descriptionVi: "Học các từ như 対象商品, 併用不可, 期間限定.",
    estimatedMinutes: 4,
    isPinned: false,
    isSpotlight: false,
    levelLabel: "N3",
    metadata: withCommonMetadata(
      {},
      "Giảm nhầm lẫn khi đọc điều khoản coupon ngắn.",
      ["対象商品", "併用不可", "期間限定"],
      ["coupon_reading"]
    ),
    moduleKey: "deals_points",
    priority: 118,
    recommendationReasonVi: "Điều kiện coupon thường ngắn nhưng nhiều từ khó.",
    slug: "coupon-terms",
    titleVi: "クーポンの条件を読む"
  }
];

async function main() {
  const moduleByKey = new Map<string, { id: string }>();
  for (const module of modules) {
    const row = await prisma.dailyRadarModuleConfig.upsert({
      create: {
        category: module.category,
        defaultPriority: module.priority,
        descriptionJa: module.descriptionVi,
        descriptionVi: module.descriptionVi,
        disclaimerVi: module.disclaimerVi,
        isEnabled: true,
        isSpotlightEligible: module.isSpotlightEligible,
        metadata: seedMetadata(module.metadata),
        moduleKey: module.moduleKey,
        moduleType: module.moduleType,
        routePath: module.routePath,
        status: "published",
        titleEn: module.titleVi,
        titleJa: module.titleJa,
        titleVi: module.titleVi,
        visualTheme: module.visualTheme
      },
      update: {
        category: module.category,
        defaultPriority: module.priority,
        descriptionJa: module.descriptionVi,
        descriptionVi: module.descriptionVi,
        disclaimerVi: module.disclaimerVi,
        isEnabled: true,
        isSpotlightEligible: module.isSpotlightEligible,
        metadata: seedMetadata(module.metadata),
        moduleType: module.moduleType,
        routePath: module.routePath,
        status: "published",
        titleJa: module.titleJa,
        titleVi: module.titleVi,
        visualTheme: module.visualTheme
      },
      where: { moduleKey: module.moduleKey }
    });
    moduleByKey.set(module.moduleKey, row);
  }

  for (const card of cards) {
    const module = moduleByKey.get(card.moduleKey);
    if (!module) continue;
    const moduleSeed = modules.find((row) => row.moduleKey === card.moduleKey);
    if (!moduleSeed) continue;
    const targetRoute = card.targetRoute ?? fallbackRouteByModule.get(card.moduleKey) ?? `/vi/modules/${card.moduleKey}`;
    await prisma.dailyRadarCard.upsert({
      create: {
        badgeTextVi: card.badgeTextVi,
        category: card.category,
        ctaLabelVi: card.ctaLabelVi,
        descriptionVi: card.descriptionVi,
        estimatedMinutes: card.estimatedMinutes,
        isPinned: card.isPinned,
        isSpotlight: card.isSpotlight,
        levelLabel: card.levelLabel,
        metadata: seedMetadata(card.metadata),
        moduleConfigId: module.id,
        moduleType: moduleSeed.moduleType,
        priority: card.priority,
        recommendationReasonVi: card.recommendationReasonVi,
        slug: card.slug,
        status: "published",
        targetRoute,
        titleJa: card.titleJa,
        titleVi: card.titleVi,
        visualTheme: moduleSeed.visualTheme
      },
      update: {
        badgeTextVi: card.badgeTextVi,
        category: card.category,
        ctaLabelVi: card.ctaLabelVi,
        descriptionVi: card.descriptionVi,
        estimatedMinutes: card.estimatedMinutes,
        isPinned: card.isPinned,
        isSpotlight: card.isSpotlight,
        levelLabel: card.levelLabel,
        metadata: seedMetadata(card.metadata),
        moduleConfigId: module.id,
        moduleType: moduleSeed.moduleType,
        priority: card.priority,
        recommendationReasonVi: card.recommendationReasonVi,
        status: "published",
        targetRoute,
        titleJa: card.titleJa ?? null,
        titleVi: card.titleVi,
        visualTheme: moduleSeed.visualTheme
      },
      where: { slug: card.slug }
    });
  }

  console.log(`Seeded Daily Radar modules (${modules.length}) and cards (${cards.length}).`);
}

main()
  .finally(() => prisma.$disconnect())
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
