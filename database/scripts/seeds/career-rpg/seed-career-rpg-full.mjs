/**
 * Full production seed for Career RPG: ranks, NPCs, arcs, and ALL chapters with scenario data.
 * Usage: node scripts/seed-career-rpg-full.mjs
 *
 * Covers:
 *   Arc 1: 報連相 基礎 (R2) — 4 chapters
 *   Arc 2: 取引先メール (R3) — 4 chapters
 *   Arc 3: クレーム対応 (R4) — 4 chapters
 *   = 12 chapters, each with full BJT-style scenario + 4 answer options
 */
import pg from "pg";

const client = new pg.Client(
  process.env.DATABASE_URL ??
    "postgresql://postgres:postgres@127.0.0.1:15432/nihongo_bjt",
);
await client.connect();

/* ─── helpers ─────────────────────────────────────────────────────────────── */

async function upsert(sql, params) {
  await client.query(sql, params);
}

/* ─── Career Ranks ────────────────────────────────────────────────────────── */

const ranks = [
  { rc: "R1", ja: "内定者", vi: "Nhân viên dự bị", band: "pre-J5", floor: 0, xp: 60, scenes: ["email"], order: 1 },
  { rc: "R2", ja: "新入社員", vi: "Nhân viên mới", band: "J5", floor: 30, xp: 120, scenes: ["email", "chat"], order: 2 },
  { rc: "R3", ja: "一般社員", vi: "Nhân viên chính thức", band: "J4", floor: 45, xp: 320, scenes: ["email", "chat", "deadline"], order: 3 },
  { rc: "R4", ja: "主任", vi: "Chuyên viên", band: "J3", floor: 60, xp: 600, scenes: ["email", "chat", "deadline", "meeting", "complaint"], order: 4 },
  { rc: "R5", ja: "係長", vi: "Trưởng nhóm", band: "J3+", floor: 70, xp: 1000, scenes: ["email", "chat", "deadline", "meeting", "complaint", "report_chart"], order: 5 },
  { rc: "R6", ja: "課長", vi: "Trưởng phòng", band: "J2", floor: 78, xp: 1600, scenes: ["email", "chat", "deadline", "meeting", "complaint", "report_chart"], order: 6 },
  { rc: "R7", ja: "部長", vi: "Giám đốc bộ phận", band: "J2+", floor: 85, xp: 2400, scenes: ["email", "chat", "deadline", "meeting", "complaint", "report_chart"], order: 7 },
  { rc: "R8", ja: "グローバル幹部 候補", vi: "Ứng viên Lãnh đạo Toàn cầu", band: "J1", floor: 92, xp: 0, scenes: ["email", "chat", "deadline", "meeting", "complaint", "report_chart"], order: 8 },
];

for (const r of ranks) {
  await upsert(
    `INSERT INTO career.career_rank (rank_code, title_ja, title_vi, bjt_band_target, min_skill_floor, xp_to_next, unlocked_scene_types, display_order, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now())
     ON CONFLICT (rank_code) DO UPDATE SET title_ja=EXCLUDED.title_ja, title_vi=EXCLUDED.title_vi, bjt_band_target=EXCLUDED.bjt_band_target, min_skill_floor=EXCLUDED.min_skill_floor, xp_to_next=EXCLUDED.xp_to_next, unlocked_scene_types=EXCLUDED.unlocked_scene_types, display_order=EXCLUDED.display_order, updated_at=now()`,
    [r.rc, r.ja, r.vi, r.band, r.floor, r.xp, JSON.stringify(r.scenes), r.order],
  );
}
console.log(`✓ ${ranks.length} career ranks upserted`);

/* ─── Story NPCs ──────────────────────────────────────────────────────────── */

const npcs = [
  { slug: "yamada_bucho", ja: "山田 部長", role: "営業部 部長", co: "株式会社ミライ商事", rel: "uchi", avatar: { avatarInitial: "山", avatarTint: "#1B2A4A", bioVi: "Cấp trên trực tiếp, nghiêm túc nhưng công bằng." } },
  { slug: "suzuki_kakaricho", ja: "鈴木 係長", role: "営業部 係長", co: "株式会社ミライ商事", rel: "uchi", avatar: { avatarInitial: "鈴", avatarTint: "#0E7490", bioVi: "Đồng nghiệp ngang hàng, hơi cạnh tranh." } },
  { slug: "tanaka_senpai", ja: "田中 先輩", role: "営業部 主任", co: "株式会社ミライ商事", rel: "uchi", avatar: { avatarInitial: "田", avatarTint: "#059669", bioVi: "Tiền bối hướng dẫn, luôn hỗ trợ." } },
  { slug: "sato_kokyaku", ja: "佐藤 様", role: "購買担当", co: "東京テクノロジー株式会社", rel: "soto", avatar: { avatarInitial: "佐", avatarTint: "#B45309", bioVi: "Khách hàng chính, quan hệ lâu năm." } },
  { slug: "takahashi_clienthq", ja: "高橋 部長", role: "調達部 部長", co: "東京テクノロジー株式会社", rel: "soto", avatar: { avatarInitial: "高", avatarTint: "#9F1239", bioVi: "Lãnh đạo phía khách hàng, khó tính." } },
];

for (const n of npcs) {
  await upsert(
    `INSERT INTO career.story_npc (slug, name_ja, role_ja, company_ja, default_relation, avatar_media, status)
     VALUES ($1,$2,$3,$4,$5,$6,'active')
     ON CONFLICT (slug) DO UPDATE SET name_ja=EXCLUDED.name_ja, role_ja=EXCLUDED.role_ja, company_ja=EXCLUDED.company_ja, default_relation=EXCLUDED.default_relation, avatar_media=EXCLUDED.avatar_media, status='active'`,
    [n.slug, n.ja, n.role, n.co, n.rel, JSON.stringify(n.avatar)],
  );
}
console.log(`✓ ${npcs.length} story NPCs upserted`);

/* ─── Mission Arcs ────────────────────────────────────────────────────────── */

const arcsData = [
  { slug: "arc.hou-ren-sou", ja: "報連相 基礎", vi: "Nền tảng 報連相 (Hou-Ren-Sou)", rank: "R1", story: { synopsisVi: "Học cách báo cáo / liên lạc / tham vấn với cấp trên đúng nhịp công ty Nhật. Hou-Ren-Sou là nền tảng giao tiếp mà mọi nhân viên mới cần nắm vững.", npcSlugs: ["yamada_bucho", "tanaka_senpai"], artAccent: "#0E7490" }, order: 1 },
  { slug: "arc.client-email", ja: "取引先メール", vi: "Email gửi khách hàng (取引先メール)", rank: "R2", story: { synopsisVi: "Viết email tới khách hàng bên ngoài: báo giá, theo dõi, từ chối khéo, thông báo tăng giá.", npcSlugs: ["sato_kokyaku", "yamada_bucho", "tanaka_senpai"], artAccent: "#1B2A4A" }, order: 2 },
  { slug: "arc.complaint-handling", ja: "クレーム対応", vi: "Xử lý khiếu nại khách hàng", rank: "R3", story: { synopsisVi: "Ứng phó khiếu nại tuyến đầu: lắng nghe, xác nhận sự thật, xin lỗi đúng mực, leo thang đúng cách.", npcSlugs: ["takahashi_clienthq", "yamada_bucho", "sato_kokyaku"], artAccent: "#9F1239" }, order: 3 },
];

const arcIds = {};
for (const a of arcsData) {
  const res = await client.query(
    `INSERT INTO career.mission_arc (slug, title_ja, title_vi, rank_code_entry, story_payload, status, display_order, updated_at)
     VALUES ($1,$2,$3,$4,$5,'published',$6,now())
     ON CONFLICT (slug) DO UPDATE SET title_ja=EXCLUDED.title_ja, title_vi=EXCLUDED.title_vi, rank_code_entry=EXCLUDED.rank_code_entry, story_payload=EXCLUDED.story_payload, status='published', display_order=EXCLUDED.display_order, updated_at=now()
     RETURNING id`,
    [a.slug, a.ja, a.vi, a.rank, JSON.stringify(a.story), a.order],
  );
  arcIds[a.slug] = res.rows[0].id;
}
console.log(`✓ ${arcsData.length} mission arcs upserted`);

/* ═══════════════════════════════════════════════════════════════════════════
 *  ARC 1: 報連相 基礎  (R2 entry — new employees)
 * ═══════════════════════════════════════════════════════════════════════════ */

const arc1Id = arcIds["arc.hou-ren-sou"];

const arc1Chapters = [
  /* ── Chapter 1-1: 初めての業務報告 ─────────────────────────────────── */
  {
    slug: "first-houkoku",
    ja: "初めての業務報告",
    vi: "Báo cáo công việc đầu tiên",
    order: 1,
    boss: false,
    briefing: {
      briefingJa: "入社して1週間。山田部長から「今日の進捗を報告してください」と言われました。初めての業務報告メールを書きます。",
      briefingVi: "Tuần đầu tiên đi làm. Sếp Yamada yêu cầu bạn báo cáo tiến độ hôm nay. Đây là email báo cáo đầu tiên.",
      yourRoleVi: "新入社員（あなた）",
      estimatedMinutes: 5,
    },
    scenario: {
      scenarios: [{
        id: "sc_houkoku_01",
        scenarioType: "email",
        titleJa: "山田部長への業務報告メール",
        titleVi: "Email báo cáo công việc gửi sếp Yamada",
        contextSummaryVi: "Ngày đầu tuần, sếp muốn biết tiến độ. Bạn đã hoàn thành việc sắp xếp hồ sơ khách hàng và bắt đầu học hệ thống nội bộ.",
        goalJa: "上司に分かりやすく、簡潔に業務報告を行う。",
        goalVi: "Báo cáo công việc cho sếp một cách rõ ràng và ngắn gọn.",
        characters: [{ npcSlug: "yamada_bucho", roleInScene: "recipient" }],
        payload: {
          emailThread: [{
            from: "あなた",
            to: "山田 部長 <yamada@mirai-shoji.co.jp>",
            subjectJa: "【業務報告】本日の進捗について",
            bodyJa: "（あなたがこれから書くメール）",
            timestamp: "2026-04-14T17:00:00Z",
          }],
        },
        question: {
          id: "q_houkoku_01",
          skillTag: "written",
          difficulty: "easy",
          promptJa: "山田部長への業務報告メールとして、最も適切な書き出しはどれですか？",
          promptVi: "Câu mở đầu nào phù hợp nhất cho email báo cáo gửi sếp Yamada?",
          options: [
            {
              optionKey: "A",
              textJa: "山田部長　お疲れ様です。本日の業務報告をいたします。\n\n1. 顧客ファイルの整理（完了）\n2. 社内システムの操作研修（進行中）\n\n明日は引き続きシステム研修を進める予定です。\nご不明点がございましたら、ご指示いただけますと幸いです。",
              isCorrect: true,
              outcome: { trustDelta: 10, clarityScore: 90, politenessScore: 88, businessRiskDelta: -5, satisfactionDelta: 10, nextActionCorrect: true, npcReactionTag: "smile", consequenceJa: "簡潔で分かりやすい報告です。", consequenceVi: "Báo cáo ngắn gọn, dễ hiểu.", affectedNpcSlug: "yamada_bucho", errorType: null },
            },
            {
              optionKey: "B",
              textJa: "山田部長　今日はファイル整理とシステム研修をやりました。以上です。",
              isCorrect: false,
              outcome: { trustDelta: -5, clarityScore: 50, politenessScore: 35, businessRiskDelta: 5, satisfactionDelta: -8, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "敬語が不十分で、報告内容も簡素すぎます。", consequenceVi: "Thiếu kính ngữ, nội dung quá sơ sài.", affectedNpcSlug: "yamada_bucho", errorType: "keigo_misunderstanding" },
            },
            {
              optionKey: "C",
              textJa: "山田部長　お疲れ様です。\n今日は色々やりました。ファイルとかシステムとか。\n明日もがんばります！",
              isCorrect: false,
              outcome: { trustDelta: -8, clarityScore: 30, politenessScore: 50, businessRiskDelta: 8, satisfactionDelta: -10, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "具体性がなく、ビジネスメールとして不適切です。", consequenceVi: "Thiếu cụ thể, không phù hợp email công việc.", affectedNpcSlug: "yamada_bucho", errorType: "business_context_error" },
            },
            {
              optionKey: "D",
              textJa: "山田様　いつもお世話になっております。\n本日の業務報告をお送りいたします。\n（以下略）",
              isCorrect: false,
              outcome: { trustDelta: -3, clarityScore: 70, politenessScore: 60, businessRiskDelta: 3, satisfactionDelta: -4, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "社内の上司に「お世話になっております」は不自然です。", consequenceVi: "Dùng 'お世話になっております' với sếp nội bộ là không tự nhiên.", affectedNpcSlug: "yamada_bucho", errorType: "internal_external_tone_mismatch" },
            },
          ],
        },
      }],
    },
    rewards: { rankXp: 16, skillGains: { written: 4, keigo: 3 }, npcTrustGains: [{ npcSlug: "yamada_bucho", delta: 6 }] },
  },

  /* ── Chapter 1-2: 口頭での連絡 ────────────────────────────────────── */
  {
    slug: "verbal-renraku",
    ja: "口頭での連絡：会議室変更",
    vi: "Liên lạc miệng: thay đổi phòng họp",
    order: 2,
    boss: false,
    briefing: {
      briefingJa: "午後の会議の部屋が変更になりました。田中先輩に口頭で連絡します。社内連絡の基本を学びましょう。",
      briefingVi: "Phòng họp buổi chiều đã thay đổi. Bạn cần thông báo miệng cho senpai Tanaka. Học cách liên lạc nội bộ cơ bản.",
      yourRoleVi: "新入社員（あなた）",
      estimatedMinutes: 4,
    },
    scenario: {
      scenarios: [{
        id: "sc_renraku_01",
        scenarioType: "chat",
        titleJa: "田中先輩への会議室変更連絡",
        titleVi: "Thông báo đổi phòng họp cho senpai Tanaka",
        contextSummaryVi: "Phòng họp A thay đổi sang phòng B do bảo trì. Cuộc họp lúc 14:00, hiện tại là 13:30.",
        goalJa: "必要な情報を漏れなく、丁寧に伝える。",
        goalVi: "Truyền đạt đầy đủ thông tin cần thiết một cách lịch sự.",
        characters: [{ npcSlug: "tanaka_senpai", roleInScene: "recipient" }],
        payload: {
          chatLog: [
            { speaker: "あなた", lineJa: "（田中先輩に声をかける）", timestamp: "2026-04-15T13:30:00Z" },
          ],
        },
        question: {
          id: "q_renraku_01",
          skillTag: "keigo",
          difficulty: "easy",
          promptJa: "田中先輩に会議室変更を伝える際、最も適切な言い方はどれですか？",
          promptVi: "Cách nào phù hợp nhất để thông báo đổi phòng họp cho senpai Tanaka?",
          options: [
            {
              optionKey: "A",
              textJa: "田中先輩、お忙しいところすみません。14時からの会議ですが、会議室Aが設備点検のため、会議室Bに変更になりました。ご確認いただけますでしょうか。",
              isCorrect: true,
              outcome: { trustDelta: 8, clarityScore: 92, politenessScore: 90, businessRiskDelta: -4, satisfactionDelta: 8, nextActionCorrect: true, npcReactionTag: "smile", consequenceJa: "必要な情報がすべて含まれています。", consequenceVi: "Đầy đủ thông tin cần thiết.", affectedNpcSlug: "tanaka_senpai", errorType: null },
            },
            {
              optionKey: "B",
              textJa: "田中さん、会議室変わったよ。Bだって。",
              isCorrect: false,
              outcome: { trustDelta: -6, clarityScore: 55, politenessScore: 30, businessRiskDelta: 6, satisfactionDelta: -8, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "先輩に対してタメ口は失礼です。", consequenceVi: "Nói suồng sã với senpai là bất lịch sự.", affectedNpcSlug: "tanaka_senpai", errorType: "keigo_misunderstanding" },
            },
            {
              optionKey: "C",
              textJa: "田中先輩、会議室が変更になりました。",
              isCorrect: false,
              outcome: { trustDelta: -2, clarityScore: 40, politenessScore: 75, businessRiskDelta: 8, satisfactionDelta: -5, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "どの会議か、どこに変わったか、情報が不足しています。", consequenceVi: "Thiếu thông tin: cuộc họp nào, phòng nào.", affectedNpcSlug: "tanaka_senpai", errorType: "action_item_miss" },
            },
            {
              optionKey: "D",
              textJa: "田中先輩、大変申し訳ございません。会議室の件でお伝えしたいことがございまして、お時間をいただけますでしょうか。",
              isCorrect: false,
              outcome: { trustDelta: -1, clarityScore: 35, politenessScore: 85, businessRiskDelta: 4, satisfactionDelta: -3, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "丁寧すぎて回りくどく、情報がすぐに伝わりません。", consequenceVi: "Quá trang trọng, vòng vo, chậm truyền thông tin.", affectedNpcSlug: "tanaka_senpai", errorType: "implied_meaning_error" },
            },
          ],
        },
      }],
    },
    rewards: { rankXp: 14, skillGains: { keigo: 5, meeting: 2 }, npcTrustGains: [{ npcSlug: "tanaka_senpai", delta: 8 }] },
  },

  /* ── Chapter 1-3: 上司への相談 ────────────────────────────────────── */
  {
    slug: "soudan-with-boss",
    ja: "上司への相談：納期遅延の可能性",
    vi: "Tham vấn sếp: khả năng trễ deadline",
    order: 3,
    boss: false,
    briefing: {
      briefingJa: "担当案件で資材の入荷が遅れ、納期に間に合わない可能性が出てきました。山田部長に相談します。",
      briefingVi: "Nguyên liệu nhập chậm, có thể trễ deadline dự án. Bạn cần tham vấn sếp Yamada về tình hình.",
      yourRoleVi: "新入社員（あなた）",
      estimatedMinutes: 6,
    },
    scenario: {
      scenarios: [{
        id: "sc_soudan_01",
        scenarioType: "meeting",
        titleJa: "山田部長への納期相談",
        titleVi: "Tham vấn sếp Yamada về deadline",
        contextSummaryVi: "Nhà cung cấp thông báo chậm giao hàng 5 ngày. Deadline khách hàng là 25/4. Bạn cần báo sếp và xin ý kiến.",
        goalJa: "事実を正確に伝え、上司の判断を仰ぐ。自分の意見も添える。",
        goalVi: "Trình bày sự thật chính xác, xin ý kiến sếp. Đưa ra đề xuất của mình.",
        characters: [{ npcSlug: "yamada_bucho", roleInScene: "manager" }, { npcSlug: "tanaka_senpai", roleInScene: "observer" }],
        payload: {
          meetingTranscript: [
            { speaker: "山田部長", lineJa: "何か報告があるんだね。どうぞ。" },
            { speaker: "あなた", lineJa: "（相談を切り出す）" },
          ],
        },
        question: {
          id: "q_soudan_01",
          skillTag: "meeting",
          difficulty: "standard",
          promptJa: "山田部長に納期遅延の可能性を相談する際、最も適切な切り出し方はどれですか？",
          promptVi: "Khi tham vấn sếp Yamada về khả năng trễ deadline, cách mở đầu nào phù hợp nhất?",
          options: [
            {
              optionKey: "A",
              textJa: "お時間いただきありがとうございます。A社案件の納期についてご相談があります。本日、仕入先から資材の入荷が5日遅れるとの連絡がありました。現状のままですと4月25日の納期に影響が出る可能性があります。対応策として2つ考えております。ご指示いただけますでしょうか。",
              isCorrect: true,
              outcome: { trustDelta: 12, clarityScore: 95, politenessScore: 90, businessRiskDelta: -8, satisfactionDelta: 12, nextActionCorrect: true, npcReactionTag: "nod", consequenceJa: "事実→影響→対応案の流れが完璧です。", consequenceVi: "Trình bày hoàn hảo: sự thật → ảnh hưởng → phương án.", affectedNpcSlug: "yamada_bucho", errorType: null },
            },
            {
              optionKey: "B",
              textJa: "部長、ちょっとまずいんですけど、A社の納期、たぶん無理そうです。",
              isCorrect: false,
              outcome: { trustDelta: -10, clarityScore: 35, politenessScore: 30, businessRiskDelta: 12, satisfactionDelta: -12, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "曖昧で、具体的な情報がありません。敬語も不十分です。", consequenceVi: "Mơ hồ, thiếu thông tin cụ thể, thiếu kính ngữ.", affectedNpcSlug: "yamada_bucho", errorType: "keigo_misunderstanding" },
            },
            {
              optionKey: "C",
              textJa: "山田部長、申し訳ありません。納期に間に合わないかもしれません。どうしたらいいでしょうか。",
              isCorrect: false,
              outcome: { trustDelta: -4, clarityScore: 45, politenessScore: 70, businessRiskDelta: 6, satisfactionDelta: -5, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "事実の詳細がなく、自分の考えも示していません。", consequenceVi: "Thiếu chi tiết sự thật, không đưa ra đề xuất.", affectedNpcSlug: "yamada_bucho", errorType: "action_item_miss" },
            },
            {
              optionKey: "D",
              textJa: "山田部長、A社の件ですが、仕入先の問題で納期が5日遅れます。先方には私から直接連絡して調整します。",
              isCorrect: false,
              outcome: { trustDelta: -8, clarityScore: 70, politenessScore: 55, businessRiskDelta: 15, satisfactionDelta: -10, nextActionCorrect: false, npcReactionTag: "escalate", consequenceJa: "上司の判断を仰がず、勝手に決定しています。", consequenceVi: "Tự quyết định mà không xin ý kiến sếp.", affectedNpcSlug: "yamada_bucho", errorType: "responsibility_misread" },
            },
          ],
        },
      }],
    },
    rewards: { rankXp: 22, skillGains: { meeting: 6, keigo: 4, customer: 2 }, npcTrustGains: [{ npcSlug: "yamada_bucho", delta: 10 }, { npcSlug: "tanaka_senpai", delta: 4 }] },
  },

  /* ── Chapter 1-4 (Boss): 複数関係者への報連相 ──────────────────────── */
  {
    slug: "boss-multi-stakeholder",
    ja: "【難関】複数関係者への報連相",
    vi: "【Boss】Hou-Ren-Sou với nhiều bên liên quan",
    order: 4,
    boss: true,
    briefing: {
      briefingJa: "顧客の急な要望変更が発生。山田部長への報告、田中先輩への連絡、そして自分の対応案を同時に整理して伝える必要があります。",
      briefingVi: "Khách hàng đột ngột thay đổi yêu cầu. Bạn cần báo cáo sếp Yamada, liên lạc senpai Tanaka, và trình bày phương án cùng lúc.",
      yourRoleVi: "新入社員（あなた）",
      estimatedMinutes: 10,
    },
    scenario: {
      scenarios: [{
        id: "sc_multi_horenso_01",
        scenarioType: "email",
        titleJa: "関係者全員への状況共有メール",
        titleVi: "Email chia sẻ tình hình cho tất cả bên liên quan",
        contextSummaryVi: "Khách hàng Sato muốn thay đổi spec sản phẩm gấp. Cần thông báo sếp và team, đồng thời đề xuất timeline mới.",
        goalJa: "関係者全員に現状と対応策を正確に共有する。",
        goalVi: "Chia sẻ tình hình và phương án cho tất cả bên liên quan.",
        characters: [{ npcSlug: "yamada_bucho", roleInScene: "recipient" }, { npcSlug: "tanaka_senpai", roleInScene: "recipient" }, { npcSlug: "sato_kokyaku", roleInScene: "observer" }],
        payload: {
          emailThread: [
            { from: "佐藤 様 <sato@tokyo-tech.co.jp>", to: "あなた", subjectJa: "仕様変更のお願い", bodyJa: "お世話になっております。\n先日お打ち合わせした仕様について、社内で再検討した結果、一部変更をお願いしたく存じます。\n詳細は添付のとおりです。お忙しいところ恐縮ですが、ご確認をお願いいたします。", timestamp: "2026-04-16T09:00:00Z" },
          ],
        },
        question: {
          id: "q_multi_horenso_01",
          skillTag: "written",
          difficulty: "hard",
          promptJa: "佐藤様からの仕様変更依頼を受け、山田部長と田中先輩にCCで共有メールを送ります。最も適切な書き方はどれですか？",
          promptVi: "Sau khi nhận yêu cầu thay đổi spec từ Sato-san, bạn gửi email CC cho sếp Yamada và senpai Tanaka. Cách viết nào phù hợp nhất?",
          options: [
            {
              optionKey: "A",
              textJa: "山田部長、田中先輩\nお疲れ様です。\n\n本日、東京テクノロジー佐藤様より仕様変更のご依頼がありましたのでご報告いたします。\n\n■ 変更概要：添付資料参照\n■ 影響範囲：納期2日延長の可能性あり\n■ 対応案：\n  ①仕様確認ミーティングを明日中に設定\n  ②田中先輩に技術的影響の確認をお願いしたい\n\nご指示をいただけますと幸いです。",
              isCorrect: true,
              outcome: { trustDelta: 15, clarityScore: 95, politenessScore: 92, businessRiskDelta: -10, satisfactionDelta: 15, nextActionCorrect: true, npcReactionTag: "smile", consequenceJa: "報連相の三要素が完璧にカバーされています。", consequenceVi: "Ba yếu tố Hou-Ren-Sou được thể hiện hoàn hảo.", affectedNpcSlug: "yamada_bucho", errorType: null },
            },
            {
              optionKey: "B",
              textJa: "山田部長\n佐藤様から仕様変更の連絡がありました。対応しておきます。",
              isCorrect: false,
              outcome: { trustDelta: -10, clarityScore: 30, politenessScore: 60, businessRiskDelta: 12, satisfactionDelta: -12, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "田中先輩への連絡がなく、詳細不足。勝手に判断しています。", consequenceVi: "Thiếu liên lạc senpai Tanaka, thiếu chi tiết, tự quyết định.", affectedNpcSlug: "yamada_bucho", errorType: "responsibility_misread" },
            },
            {
              optionKey: "C",
              textJa: "みなさん\n佐藤さんから仕様変更って言われました。ちょっと困ってます。どうしましょう？",
              isCorrect: false,
              outcome: { trustDelta: -12, clarityScore: 25, politenessScore: 25, businessRiskDelta: 15, satisfactionDelta: -15, nextActionCorrect: false, npcReactionTag: "escalate", consequenceJa: "ビジネスメールとして完全に不適切です。", consequenceVi: "Hoàn toàn không phù hợp email công việc.", affectedNpcSlug: "yamada_bucho", errorType: "keigo_misunderstanding" },
            },
            {
              optionKey: "D",
              textJa: "山田部長、田中先輩\nお疲れ様です。佐藤様より仕様変更の件でご連絡がありました。\n添付にて共有いたします。よろしくお願いいたします。",
              isCorrect: false,
              outcome: { trustDelta: -3, clarityScore: 50, politenessScore: 80, businessRiskDelta: 6, satisfactionDelta: -4, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "影響範囲と対応案がないため、判断材料になりません。", consequenceVi: "Thiếu phạm vi ảnh hưởng và phương án, sếp không có cơ sở quyết định.", affectedNpcSlug: "yamada_bucho", errorType: "action_item_miss" },
            },
          ],
        },
      }],
    },
    rewards: {
      rankXp: 40,
      skillGains: { written: 8, keigo: 6, meeting: 4, customer: 3 },
      npcTrustGains: [{ npcSlug: "yamada_bucho", delta: 15 }, { npcSlug: "tanaka_senpai", delta: 10 }, { npcSlug: "sato_kokyaku", delta: 5 }],
      npcReactionMontage: [
        { npcSlug: "yamada_bucho", quoteJa: "よく整理されているね。判断しやすい報告だ。", sentiment: "positive" },
        { npcSlug: "tanaka_senpai", quoteJa: "報連相の基本、しっかり身についてきたね。", sentiment: "positive" },
      ],
    },
  },
];

for (const ch of arc1Chapters) {
  await upsert(
    `INSERT INTO career.mission_chapter (arc_id, slug, title_ja, title_vi, display_order, is_boss, briefing_payload, scenario_payload, rewards_payload)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (arc_id, slug) DO UPDATE SET title_ja=EXCLUDED.title_ja, title_vi=EXCLUDED.title_vi, display_order=EXCLUDED.display_order, is_boss=EXCLUDED.is_boss, briefing_payload=EXCLUDED.briefing_payload, scenario_payload=EXCLUDED.scenario_payload, rewards_payload=EXCLUDED.rewards_payload`,
    [arc1Id, ch.slug, ch.ja, ch.vi, ch.order, ch.boss, JSON.stringify(ch.briefing), JSON.stringify(ch.scenario), JSON.stringify(ch.rewards)],
  );
}
console.log(`✓ ${arc1Chapters.length} chapters upserted for arc.hou-ren-sou`);

/* ═══════════════════════════════════════════════════════════════════════════
 *  ARC 2: 取引先メール  (R3 entry — writing to external clients)
 * ═══════════════════════════════════════════════════════════════════════════ */

const arc2Id = arcIds["arc.client-email"];

const arc2Chapters = [
  /* ── Chapter 2-1: 初めての見積もり送付 ─────────────────────────────── */
  {
    slug: "first-quote-send",
    ja: "初めての見積もり送付",
    vi: "Lần đầu gửi báo giá",
    order: 1,
    boss: false,
    briefing: {
      briefingJa: "東京テクノロジーの佐藤様に初めて見積書を送付します。取引先への初回メールの書き方を学びましょう。",
      briefingVi: "Gửi báo giá lần đầu cho Sato-san (Tokyo Technology). Học cách viết email lần đầu cho đối tác.",
      yourRoleVi: "田中 太郎",
      estimatedMinutes: 5,
    },
    scenario: {
      scenarios: [{
        id: "sc_quote_send_01",
        scenarioType: "email",
        titleJa: "佐藤様への見積書送付メール",
        titleVi: "Email gửi báo giá cho Sato-san",
        contextSummaryVi: "Đây là lần đầu tiên bạn gửi email cho khách hàng bên ngoài. Cần đính kèm file báo giá và viết email chuyên nghiệp.",
        goalJa: "取引先に初めてメールを送る際の適切な文面を選ぶ。",
        goalVi: "Chọn cách viết phù hợp khi gửi email lần đầu cho đối tác.",
        characters: [{ npcSlug: "sato_kokyaku", roleInScene: "recipient" }, { npcSlug: "yamada_bucho", roleInScene: "observer" }],
        payload: {
          emailThread: [{
            from: "田中 太郎 <tanaka@mirai-shoji.co.jp>",
            to: "佐藤 様 <sato@tokyo-tech.co.jp>",
            subjectJa: "お見積もりご送付の件（株式会社ミライ商事）",
            bodyJa: "（あなたがこれから書くメール）",
            timestamp: "2026-05-03T10:00:00Z",
          }],
        },
        question: {
          id: "q_quote_01",
          skillTag: "written",
          difficulty: "standard",
          promptJa: "佐藤様に見積書を初めて送るメールとして、最も適切なものはどれですか？",
          promptVi: "Email nào phù hợp nhất khi gửi báo giá lần đầu cho Sato-san?",
          options: [
            {
              optionKey: "A",
              textJa: "佐藤様\n\nいつもお世話になっております。\n株式会社ミライ商事の田中でございます。\n\n先日はお打ち合わせのお時間をいただき、誠にありがとうございました。\nご依頼いただきました件につきまして、お見積書を添付にてお送りいたします。\n\nご不明点がございましたら、お気軽にお問い合わせくださいませ。\nご査収のほど、よろしくお願いいたします。",
              isCorrect: true,
              outcome: { trustDelta: 10, clarityScore: 90, politenessScore: 95, businessRiskDelta: -6, satisfactionDelta: 10, nextActionCorrect: true, npcReactionTag: "smile", consequenceJa: "ビジネスメールの基本形式を押さえています。", consequenceVi: "Đúng format chuẩn email business.", affectedNpcSlug: "sato_kokyaku", errorType: null },
            },
            {
              optionKey: "B",
              textJa: "佐藤さん\n見積もり送ります。添付確認してください。",
              isCorrect: false,
              outcome: { trustDelta: -12, clarityScore: 50, politenessScore: 15, businessRiskDelta: 15, satisfactionDelta: -15, nextActionCorrect: false, npcReactionTag: "escalate", consequenceJa: "取引先に対して敬語がなく、非常に失礼です。", consequenceVi: "Không dùng kính ngữ với đối tác, rất bất lịch sự.", affectedNpcSlug: "sato_kokyaku", errorType: "internal_external_tone_mismatch" },
            },
            {
              optionKey: "C",
              textJa: "佐藤様\n\nお世話になっております。田中です。\n見積もりを送ります。\nよろしくお願いします。",
              isCorrect: false,
              outcome: { trustDelta: -4, clarityScore: 55, politenessScore: 55, businessRiskDelta: 5, satisfactionDelta: -5, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "会社名がなく、内容も簡素すぎます。", consequenceVi: "Thiếu tên công ty, nội dung quá sơ sài.", affectedNpcSlug: "sato_kokyaku", errorType: "business_context_error" },
            },
            {
              optionKey: "D",
              textJa: "佐藤様\n\n平素より大変お世話になっております。\n株式会社ミライ商事営業部の田中太郎と申します。\n本日はお見積もりの件でご連絡を差し上げました。\n何卒ご検討のほどお願い申し上げます。\n\n追伸：先日のお食事は楽しかったです。",
              isCorrect: false,
              outcome: { trustDelta: -6, clarityScore: 60, politenessScore: 70, businessRiskDelta: 8, satisfactionDelta: -6, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "追伸の私的な内容がビジネスメールにふさわしくありません。", consequenceVi: "Nội dung cá nhân ở P.S. không phù hợp email business.", affectedNpcSlug: "sato_kokyaku", errorType: "relationship_mismatch" },
            },
          ],
        },
      }],
    },
    rewards: { rankXp: 16, skillGains: { written: 4, keigo: 3 }, npcTrustGains: [{ npcSlug: "yamada_bucho", delta: 6 }] },
  },

  /* ── Chapter 2-2: 見積もり送付後のフォローアップ ───────────────────── */
  {
    slug: "follow-up-after-quote",
    ja: "見積もり送付後のフォローアップ",
    vi: "Theo dõi sau khi gửi báo giá",
    order: 2,
    boss: false,
    briefing: {
      briefingJa: "三日前に佐藤様へ見積書を送りましたが、まだ返信がありません。フォローアップメールを送ります。",
      briefingVi: "3 ngày trước đã gửi báo giá cho Sato-san nhưng chưa có phản hồi. Gửi email theo dõi.",
      yourRoleVi: "田中 太郎",
      estimatedMinutes: 6,
    },
    scenario: {
      scenarios: [{
        id: "sc_email_followup_01",
        scenarioType: "email",
        titleJa: "佐藤様へのフォローアップメール",
        titleVi: "Email theo dõi gửi Sato-san",
        contextSummaryVi: "Khách hàng có thể đang bận hoặc đang cân nhắc đối thủ.",
        goalJa: "返信を促しつつ、相手にプレッシャーを与えないメールを書く。",
        goalVi: "Thúc đẩy phản hồi mà không tạo áp lực cho khách hàng.",
        characters: [{ npcSlug: "sato_kokyaku", roleInScene: "recipient" }, { npcSlug: "yamada_bucho", roleInScene: "observer" }],
        payload: {
          emailThread: [{
            from: "田中 太郎 <tanaka@mirai-shoji.co.jp>",
            to: "佐藤 様 <sato@tokyo-tech.co.jp>",
            subjectJa: "お見積もりの件（株式会社ミライ商事）",
            bodyJa: "佐藤様\n\nいつも大変お世話になっております。\nミライ商事の田中でございます。\n\n先日ご送付いたしました見積書につきまして、ご確認いただけましたでしょうか。",
            timestamp: "2026-05-06T10:00:00Z",
          }],
        },
        question: {
          id: "q_followup_01",
          skillTag: "written",
          difficulty: "standard",
          promptJa: "三日経っても返信がありません。今日のフォローアップとして、最も適切な一文はどれですか？",
          promptVi: "Sau 3 ngày vẫn chưa có hồi âm. Câu nào phù hợp nhất?",
          options: [
            {
              optionKey: "A",
              textJa: "先日のお見積もり、いかがでしたでしょうか。早めにご返信ください。",
              isCorrect: false,
              outcome: { trustDelta: -8, clarityScore: 70, politenessScore: 45, businessRiskDelta: 10, satisfactionDelta: -10, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "催促のように聞こえます。", consequenceVi: "Nghe giục giã.", affectedNpcSlug: "sato_kokyaku", errorType: "keigo_misunderstanding" },
            },
            {
              optionKey: "B",
              textJa: "先日お送りしたお見積もりにつきまして、その後ご検討状況はいかがでしょうか。お忙しいところ恐縮ですが、ご都合のよろしいときにご一報いただけますと幸いです。",
              isCorrect: true,
              outcome: { trustDelta: 12, clarityScore: 88, politenessScore: 92, businessRiskDelta: -6, satisfactionDelta: 8, nextActionCorrect: true, npcReactionTag: "smile", consequenceJa: "丁寧で配慮のある言い回しです。", consequenceVi: "Tinh tế và có 配慮.", affectedNpcSlug: "sato_kokyaku", errorType: null },
            },
            {
              optionKey: "C",
              textJa: "返事まだですよね？確認お願いします。",
              isCorrect: false,
              outcome: { trustDelta: -16, clarityScore: 55, politenessScore: 18, businessRiskDelta: 18, satisfactionDelta: -16, nextActionCorrect: false, npcReactionTag: "escalate", consequenceJa: "敬語が崩れています。", consequenceVi: "Mất 敬語.", affectedNpcSlug: "sato_kokyaku", errorType: "internal_external_tone_mismatch" },
            },
            {
              optionKey: "D",
              textJa: "見積もりについて、もし社内で承認が下りない場合は、こちらでも何かサポートできることがあれば仰ってください。",
              isCorrect: false,
              outcome: { trustDelta: -2, clarityScore: 60, politenessScore: 78, businessRiskDelta: 6, satisfactionDelta: -2, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "勝手に想定したため失礼に感じる可能性があります。", consequenceVi: "Giả định khiến khách khó chịu.", affectedNpcSlug: "sato_kokyaku", errorType: "implied_meaning_error" },
            },
          ],
        },
      }],
    },
    rewards: {
      rankXp: 24,
      skillGains: { keigo: 8, written: 5, customer: 3 },
      npcTrustGains: [{ npcSlug: "yamada_bucho", delta: 12 }, { npcSlug: "sato_kokyaku", delta: 8 }, { npcSlug: "tanaka_senpai", delta: 4 }],
      npcReactionMontage: [
        { npcSlug: "yamada_bucho", quoteJa: "うん、その配慮は大事だね。", sentiment: "positive" },
        { npcSlug: "tanaka_senpai", quoteJa: "ナイス。クッション言葉、自然に使えてたね。", sentiment: "positive" },
        { npcSlug: "sato_kokyaku", quoteJa: "ご丁寧なご連絡、ありがとうございます。", sentiment: "positive" },
      ],
    },
  },

  /* ── Chapter 2-3: 値上げ通知のメール ───────────────────────────────── */
  {
    slug: "rate-increase-notice",
    ja: "値上げ通知のメール",
    vi: "Email thông báo tăng giá",
    order: 3,
    boss: false,
    briefing: {
      briefingJa: "原材料の高騰により、来月から5%の値上げをお願いすることになりました。佐藤様への通知メールを書きます。",
      briefingVi: "Do nguyên liệu tăng giá, cần thông báo tăng 5% từ tháng sau. Viết email thông báo cho Sato-san.",
      yourRoleVi: "田中 太郎",
      estimatedMinutes: 8,
    },
    scenario: {
      scenarios: [{
        id: "sc_price_increase_01",
        scenarioType: "email",
        titleJa: "佐藤様への値上げ通知メール",
        titleVi: "Email thông báo tăng giá cho Sato-san",
        contextSummaryVi: "Tăng giá là chuyện nhạy cảm. Cần giải thích lý do, thể hiện sự cảm thông, và giữ quan hệ tốt.",
        goalJa: "値上げの理由を丁寧に説明し、取引継続への感謝と配慮を示す。",
        goalVi: "Giải thích lý do tăng giá lịch sự, thể hiện sự trân trọng và quan tâm đến quan hệ hợp tác.",
        characters: [{ npcSlug: "sato_kokyaku", roleInScene: "recipient" }, { npcSlug: "yamada_bucho", roleInScene: "observer" }],
        payload: {
          emailThread: [{
            from: "田中 太郎 <tanaka@mirai-shoji.co.jp>",
            to: "佐藤 様 <sato@tokyo-tech.co.jp>",
            subjectJa: "価格改定のお知らせとお願い（株式会社ミライ商事）",
            bodyJa: "（あなたがこれから書くメール）",
            timestamp: "2026-05-10T09:00:00Z",
          }],
        },
        question: {
          id: "q_price_01",
          skillTag: "customer",
          difficulty: "standard",
          promptJa: "佐藤様に値上げを通知するメールの結び方として、最も適切なものはどれですか？",
          promptVi: "Cách kết thúc email thông báo tăng giá cho Sato-san nào phù hợp nhất?",
          options: [
            {
              optionKey: "A",
              textJa: "ご理解いただきますようお願いいたします。来月から値上げします。",
              isCorrect: false,
              outcome: { trustDelta: -8, clarityScore: 55, politenessScore: 40, businessRiskDelta: 10, satisfactionDelta: -10, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "一方的で、クッション言葉がありません。", consequenceVi: "Một chiều, thiếu cushion words.", affectedNpcSlug: "sato_kokyaku", errorType: "soft_refusal_misread" },
            },
            {
              optionKey: "B",
              textJa: "何卒ご理解を賜りますよう、お願い申し上げます。なお、価格改定に伴い、品質管理体制をさらに強化してまいります。今後とも変わらぬお引き立てを賜りますよう、よろしくお願いいたします。",
              isCorrect: true,
              outcome: { trustDelta: 10, clarityScore: 88, politenessScore: 95, businessRiskDelta: -5, satisfactionDelta: 8, nextActionCorrect: true, npcReactionTag: "nod", consequenceJa: "値上げの理由を説明しつつ、今後の付加価値も示しています。", consequenceVi: "Giải thích lý do và cam kết giá trị gia tăng.", affectedNpcSlug: "sato_kokyaku", errorType: null },
            },
            {
              optionKey: "C",
              textJa: "すみません、値上げさせていただくことになりました。ごめんなさい。",
              isCorrect: false,
              outcome: { trustDelta: -6, clarityScore: 40, politenessScore: 45, businessRiskDelta: 8, satisfactionDelta: -8, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "謝りすぎて、ビジネスの自信が感じられません。", consequenceVi: "Xin lỗi quá nhiều, thiếu tự tin trong business.", affectedNpcSlug: "sato_kokyaku", errorType: "business_context_error" },
            },
            {
              optionKey: "D",
              textJa: "他社さんも値上げされていますし、弊社としても限界でございます。ご了承ください。",
              isCorrect: false,
              outcome: { trustDelta: -10, clarityScore: 60, politenessScore: 35, businessRiskDelta: 12, satisfactionDelta: -12, nextActionCorrect: false, npcReactionTag: "escalate", consequenceJa: "他社を引き合いに出すのは不適切です。", consequenceVi: "Viện dẫn công ty khác là không phù hợp.", affectedNpcSlug: "sato_kokyaku", errorType: "relationship_mismatch" },
            },
          ],
        },
      }],
    },
    rewards: { rankXp: 20, skillGains: { written: 6, customer: 4, nuance: 3 }, npcTrustGains: [{ npcSlug: "sato_kokyaku", delta: 6 }] },
  },

  /* ── Chapter 2-4 (Boss): こじれた取引先への謝罪と再提案 ────────────── */
  {
    slug: "boss-difficult-client",
    ja: "【難関】こじれた取引先への謝罪と再提案",
    vi: "【Boss】Email xin lỗi và đề xuất lại cho đối tác",
    order: 4,
    boss: true,
    briefing: {
      briefingJa: "前任者のミスで佐藤様との関係が悪化。謝罪と信頼回復のためのメールを書きます。山田部長も注視しています。",
      briefingVi: "Người tiền nhiệm để lỗi, quan hệ với Sato-san xấu đi. Viết email xin lỗi và khôi phục niềm tin. Sếp Yamada đang theo dõi.",
      yourRoleVi: "田中 太郎",
      estimatedMinutes: 12,
    },
    scenario: {
      scenarios: [{
        id: "sc_apology_proposal_01",
        scenarioType: "email",
        titleJa: "佐藤様への謝罪・再提案メール",
        titleVi: "Email xin lỗi và đề xuất lại cho Sato-san",
        contextSummaryVi: "Lần giao hàng trước bị lỗi chất lượng. Sato-san rất tức giận. Cần xin lỗi chân thành và đề xuất giải pháp cụ thể.",
        goalJa: "誠意ある謝罪と具体的な改善策で、信頼を回復する。",
        goalVi: "Xin lỗi chân thành kèm giải pháp cải thiện cụ thể để khôi phục niềm tin.",
        characters: [{ npcSlug: "sato_kokyaku", roleInScene: "recipient" }, { npcSlug: "yamada_bucho", roleInScene: "observer" }, { npcSlug: "takahashi_clienthq", roleInScene: "observer" }],
        payload: {
          emailThread: [
            { from: "佐藤 様 <sato@tokyo-tech.co.jp>", to: "田中 太郎 <tanaka@mirai-shoji.co.jp>", subjectJa: "先日の納品について", bodyJa: "田中様\n\n先日納品いただいた商品ですが、検品の結果、10個中3個に不良品がございました。\n正直、今回の件は大変残念に思っております。\n今後の取引について検討させていただきます。", timestamp: "2026-05-12T14:00:00Z" },
          ],
        },
        question: {
          id: "q_apology_01",
          skillTag: "customer",
          difficulty: "hard",
          promptJa: "佐藤様への謝罪メールの書き出しとして、最も適切なものはどれですか？",
          promptVi: "Câu mở đầu email xin lỗi cho Sato-san nào phù hợp nhất?",
          options: [
            {
              optionKey: "A",
              textJa: "佐藤様\n\nこの度は、弊社の納品に不良品が含まれていたとのこと、大変申し訳ございませんでした。\nご迷惑をおかけしましたことを、心よりお詫び申し上げます。\n\n原因を調査いたしましたところ、出荷前検品の工程に不備がございました。\n再発防止のため、以下の対策を実施いたします。\n\n1. 出荷前検品の二重チェック体制の導入\n2. 不良品の即日交換対応\n3. 品質管理報告書の定期提出\n\n何卒ご検討のほど、お願い申し上げます。",
              isCorrect: true,
              outcome: { trustDelta: 15, clarityScore: 95, politenessScore: 95, businessRiskDelta: -12, satisfactionDelta: 15, nextActionCorrect: true, npcReactionTag: "nod", consequenceJa: "謝罪→原因→対策の流れが完璧。具体的で誠意があります。", consequenceVi: "Xin lỗi → Nguyên nhân → Đối sách, hoàn hảo. Cụ thể và chân thành.", affectedNpcSlug: "sato_kokyaku", errorType: null },
            },
            {
              optionKey: "B",
              textJa: "佐藤様\n\n不良品の件、すみませんでした。今後気をつけます。",
              isCorrect: false,
              outcome: { trustDelta: -15, clarityScore: 25, politenessScore: 30, businessRiskDelta: 18, satisfactionDelta: -18, nextActionCorrect: false, npcReactionTag: "escalate", consequenceJa: "謝罪が軽すぎて、対策も具体的ではありません。", consequenceVi: "Xin lỗi quá nhẹ, đối sách không cụ thể.", affectedNpcSlug: "sato_kokyaku", errorType: "business_context_error" },
            },
            {
              optionKey: "C",
              textJa: "佐藤様\n\nご連絡ありがとうございます。\n不良品の件、確認いたしました。交換品をお送りいたしますので、お待ちください。",
              isCorrect: false,
              outcome: { trustDelta: -8, clarityScore: 55, politenessScore: 50, businessRiskDelta: 10, satisfactionDelta: -10, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "謝罪の言葉がなく、事務的すぎます。", consequenceVi: "Thiếu lời xin lỗi, quá sự vụ.", affectedNpcSlug: "sato_kokyaku", errorType: "soft_refusal_misread" },
            },
            {
              optionKey: "D",
              textJa: "佐藤様\n\n誠に申し訳ございません。不良品の原因は弊社の品質管理の問題です。全面的に弊社の責任です。どんな補償でもいたします。",
              isCorrect: false,
              outcome: { trustDelta: -5, clarityScore: 50, politenessScore: 75, businessRiskDelta: 12, satisfactionDelta: -6, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "「どんな補償でも」は無制限の約束で、リスクが高いです。", consequenceVi: "\"Bồi thường gì cũng được\" là cam kết vô hạn, rủi ro cao.", affectedNpcSlug: "sato_kokyaku", errorType: "responsibility_misread" },
            },
          ],
        },
      }],
    },
    rewards: {
      rankXp: 40,
      skillGains: { keigo: 10, written: 8, customer: 6, nuance: 5 },
      npcTrustGains: [{ npcSlug: "yamada_bucho", delta: 15 }, { npcSlug: "sato_kokyaku", delta: 12 }],
      npcReactionMontage: [
        { npcSlug: "yamada_bucho", quoteJa: "よくやった。誠意が伝わる内容だ。", sentiment: "positive" },
        { npcSlug: "sato_kokyaku", quoteJa: "ご丁寧な対応、ありがとうございます。引き続きよろしくお願いいたします。", sentiment: "positive" },
        { npcSlug: "tanaka_senpai", quoteJa: "難しい状況だったのに、よく乗り越えたね。", sentiment: "positive" },
      ],
    },
  },
];

for (const ch of arc2Chapters) {
  await upsert(
    `INSERT INTO career.mission_chapter (arc_id, slug, title_ja, title_vi, display_order, is_boss, briefing_payload, scenario_payload, rewards_payload)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (arc_id, slug) DO UPDATE SET title_ja=EXCLUDED.title_ja, title_vi=EXCLUDED.title_vi, display_order=EXCLUDED.display_order, is_boss=EXCLUDED.is_boss, briefing_payload=EXCLUDED.briefing_payload, scenario_payload=EXCLUDED.scenario_payload, rewards_payload=EXCLUDED.rewards_payload`,
    [arc2Id, ch.slug, ch.ja, ch.vi, ch.order, ch.boss, JSON.stringify(ch.briefing), JSON.stringify(ch.scenario), JSON.stringify(ch.rewards)],
  );
}
console.log(`✓ ${arc2Chapters.length} chapters upserted for arc.client-email`);

/* ═══════════════════════════════════════════════════════════════════════════
 *  ARC 3: クレーム対応  (R4 entry — complaint handling)
 * ═══════════════════════════════════════════════════════════════════════════ */

const arc3Id = arcIds["arc.complaint-handling"];

const arc3Chapters = [
  /* ── Chapter 3-1: 電話クレームの初期対応 ───────────────────────────── */
  {
    slug: "phone-complaint-initial",
    ja: "電話クレームの初期対応",
    vi: "Xử lý ban đầu khi khách phàn nàn qua điện thoại",
    order: 1,
    boss: false,
    briefing: {
      briefingJa: "高橋部長（東京テクノロジー）から直接電話クレームが入りました。納品された製品に問題があるとのこと。まず落ち着いて対応しましょう。",
      briefingVi: "Bộ trưởng Takahashi (Tokyo Technology) gọi điện phàn nàn trực tiếp. Sản phẩm giao có vấn đề. Cần bình tĩnh xử lý.",
      yourRoleVi: "田中 太郎",
      estimatedMinutes: 6,
    },
    scenario: {
      scenarios: [{
        id: "sc_phone_complaint_01",
        scenarioType: "complaint",
        titleJa: "高橋部長からの電話クレーム",
        titleVi: "Cuộc gọi phàn nàn từ bộ trưởng Takahashi",
        contextSummaryVi: "Sản phẩm giao có 5 lỗi kỹ thuật. Takahashi rất tức giận và đòi nói chuyện với quản lý. Bạn là người nhận cuộc gọi đầu tiên.",
        goalJa: "クレームの内容を正確に把握し、お客様の怒りを和らげる初期対応を行う。",
        goalVi: "Nắm chính xác nội dung khiếu nại và xoa dịu cơn giận của khách hàng.",
        characters: [{ npcSlug: "takahashi_clienthq", roleInScene: "sender" }, { npcSlug: "yamada_bucho", roleInScene: "observer" }],
        payload: {
          chatLog: [
            { speaker: "高橋部長", lineJa: "もしもし、東京テクノロジーの高橋です。先日の納品について、ちょっと困っているんですが。", timestamp: "2026-05-15T10:00:00Z" },
            { speaker: "高橋部長", lineJa: "検品したら5個も不良品があったんですよ。これではうちの生産ラインに影響が出ます。", timestamp: "2026-05-15T10:00:30Z" },
          ],
        },
        question: {
          id: "q_phone_complaint_01",
          skillTag: "customer",
          difficulty: "standard",
          promptJa: "高橋部長からのクレーム電話で、最初に言うべき言葉として最も適切なものはどれですか？",
          promptVi: "Khi nhận cuộc gọi phàn nàn từ Takahashi, câu đầu tiên nào phù hợp nhất?",
          options: [
            {
              optionKey: "A",
              textJa: "高橋様、この度は大変ご迷惑をおかけいたしまして、誠に申し訳ございません。状況を正確に把握させていただきたいのですが、具体的にどの製品でどのような不良がございましたでしょうか。",
              isCorrect: true,
              outcome: { trustDelta: 12, clarityScore: 90, politenessScore: 92, businessRiskDelta: -8, satisfactionDelta: 10, nextActionCorrect: true, npcReactionTag: "nod", consequenceJa: "謝罪と事実確認を同時に行っています。", consequenceVi: "Vừa xin lỗi vừa xác nhận sự thật.", affectedNpcSlug: "takahashi_clienthq", errorType: null },
            },
            {
              optionKey: "B",
              textJa: "高橋様、そうですか。ちょっと確認してから折り返します。",
              isCorrect: false,
              outcome: { trustDelta: -10, clarityScore: 40, politenessScore: 35, businessRiskDelta: 12, satisfactionDelta: -12, nextActionCorrect: false, npcReactionTag: "escalate", consequenceJa: "謝罪がなく、相手の話を聞く姿勢がありません。", consequenceVi: "Không xin lỗi, không lắng nghe.", affectedNpcSlug: "takahashi_clienthq", errorType: "soft_refusal_misread" },
            },
            {
              optionKey: "C",
              textJa: "それは申し訳ありません。でも、出荷前に検品は行っておりまして、弊社としては問題なかったはずなのですが…",
              isCorrect: false,
              outcome: { trustDelta: -15, clarityScore: 50, politenessScore: 30, businessRiskDelta: 18, satisfactionDelta: -15, nextActionCorrect: false, npcReactionTag: "escalate", consequenceJa: "言い訳に聞こえ、お客様の怒りが増します。", consequenceVi: "Nghe như bào chữa, khách càng tức.", affectedNpcSlug: "takahashi_clienthq", errorType: "speaker_intention_miss" },
            },
            {
              optionKey: "D",
              textJa: "高橋様、大変申し訳ございません。すぐに全品交換させていただきます。本日中にお届けいたします。",
              isCorrect: false,
              outcome: { trustDelta: -3, clarityScore: 55, politenessScore: 80, businessRiskDelta: 10, satisfactionDelta: -5, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "事実確認なしに即答すると、実行できない約束をするリスクがあります。", consequenceVi: "Hứa ngay mà chưa xác nhận sự thật, rủi ro không thực hiện được.", affectedNpcSlug: "takahashi_clienthq", errorType: "responsibility_misread" },
            },
          ],
        },
      }],
    },
    rewards: { rankXp: 24, skillGains: { customer: 6, keigo: 4, nuance: 3 }, npcTrustGains: [{ npcSlug: "takahashi_clienthq", delta: 8 }, { npcSlug: "yamada_bucho", delta: 6 }] },
  },

  /* ── Chapter 3-2: 事実確認と社内共有 ───────────────────────────────── */
  {
    slug: "fact-check-internal",
    ja: "事実確認と社内共有",
    vi: "Xác nhận sự thật và chia sẻ nội bộ",
    order: 2,
    boss: false,
    briefing: {
      briefingJa: "高橋部長との電話を終え、事実を確認して山田部長に報告する必要があります。正確な情報整理が求められます。",
      briefingVi: "Kết thúc cuộc gọi với Takahashi, cần xác nhận sự thật và báo cáo sếp Yamada. Cần sắp xếp thông tin chính xác.",
      yourRoleVi: "田中 太郎",
      estimatedMinutes: 6,
    },
    scenario: {
      scenarios: [{
        id: "sc_factcheck_01",
        scenarioType: "email",
        titleJa: "山田部長への社内報告メール",
        titleVi: "Email báo cáo nội bộ cho sếp Yamada",
        contextSummaryVi: "Cần tổng hợp thông tin từ cuộc gọi khiếu nại và gửi báo cáo nội bộ cho sếp để xin chỉ đạo.",
        goalJa: "事実を正確にまとめ、対応案とともに上司に報告する。",
        goalVi: "Tổng hợp sự thật chính xác, kèm phương án đối ứng, báo cáo sếp.",
        characters: [{ npcSlug: "yamada_bucho", roleInScene: "recipient" }, { npcSlug: "tanaka_senpai", roleInScene: "recipient" }],
        payload: {
          emailThread: [{
            from: "あなた",
            to: "山田 部長 <yamada@mirai-shoji.co.jp>",
            subjectJa: "【至急】東京テクノロジー様クレーム報告",
            bodyJa: "（あなたがこれから書くメール）",
            timestamp: "2026-05-15T10:30:00Z",
          }],
        },
        question: {
          id: "q_factcheck_01",
          skillTag: "written",
          difficulty: "standard",
          promptJa: "山田部長への社内クレーム報告メールとして、最も適切な構成はどれですか？",
          promptVi: "Cấu trúc email báo cáo khiếu nại nội bộ nào phù hợp nhất?",
          options: [
            {
              optionKey: "A",
              textJa: "山田部長、田中先輩\nお疲れ様です。至急のご報告です。\n\n■ クレーム概要\n・発生日時：本日10:00\n・お客様：東京テクノロジー 高橋部長\n・内容：納品100個中5個の不良品\n・影響：先方の生産ライン停止の恐れ\n\n■ 対応状況\n・電話にて初期謝罪済み\n・不良品の詳細情報を確認中\n\n■ 対応案\n①本日中に代替品5個を発送\n②品質管理チームに原因調査を依頼\n③明日午前中に先方へ正式な報告書を提出\n\nご指示をお願いいたします。",
              isCorrect: true,
              outcome: { trustDelta: 12, clarityScore: 95, politenessScore: 88, businessRiskDelta: -10, satisfactionDelta: 12, nextActionCorrect: true, npcReactionTag: "nod", consequenceJa: "5W1Hが明確で、対応案も具体的です。", consequenceVi: "5W1H rõ ràng, phương án cụ thể.", affectedNpcSlug: "yamada_bucho", errorType: null },
            },
            {
              optionKey: "B",
              textJa: "部長、高橋さんから電話ありました。怒ってました。不良品が5個あったそうです。どうしましょう。",
              isCorrect: false,
              outcome: { trustDelta: -10, clarityScore: 30, politenessScore: 35, businessRiskDelta: 12, satisfactionDelta: -12, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "情報不足で、対応案もありません。", consequenceVi: "Thiếu thông tin, không có phương án.", affectedNpcSlug: "yamada_bucho", errorType: "action_item_miss" },
            },
            {
              optionKey: "C",
              textJa: "山田部長\nクレームの件ですが、大した問題ではないと思います。不良品を交換すれば解決するかと。",
              isCorrect: false,
              outcome: { trustDelta: -12, clarityScore: 45, politenessScore: 40, businessRiskDelta: 15, satisfactionDelta: -15, nextActionCorrect: false, npcReactionTag: "escalate", consequenceJa: "クレームを軽視しており、判断も勝手です。", consequenceVi: "Coi nhẹ khiếu nại, tự quyết định.", affectedNpcSlug: "yamada_bucho", errorType: "priority_misread" },
            },
            {
              optionKey: "D",
              textJa: "山田部長\nお疲れ様です。東京テクノロジーの高橋部長からクレームがありました。不良品が5個あったとのことです。対応をお願いいたします。",
              isCorrect: false,
              outcome: { trustDelta: -5, clarityScore: 50, politenessScore: 65, businessRiskDelta: 8, satisfactionDelta: -6, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "自分の対応案がなく、丸投げになっています。", consequenceVi: "Không có phương án, đẩy hết cho sếp.", affectedNpcSlug: "yamada_bucho", errorType: "responsibility_misread" },
            },
          ],
        },
      }],
    },
    rewards: { rankXp: 22, skillGains: { written: 6, meeting: 3, customer: 3 }, npcTrustGains: [{ npcSlug: "yamada_bucho", delta: 10 }, { npcSlug: "tanaka_senpai", delta: 5 }] },
  },

  /* ── Chapter 3-3: お詫びメールの作成 ───────────────────────────────── */
  {
    slug: "formal-apology-email",
    ja: "お詫びメールの作成",
    vi: "Soạn email xin lỗi chính thức",
    order: 3,
    boss: false,
    briefing: {
      briefingJa: "山田部長の指示で、高橋部長へ正式なお詫びメールを作成します。会社の信頼回復がかかっています。",
      briefingVi: "Theo chỉ đạo của sếp Yamada, soạn email xin lỗi chính thức gửi Takahashi. Liên quan đến uy tín công ty.",
      yourRoleVi: "田中 太郎",
      estimatedMinutes: 8,
    },
    scenario: {
      scenarios: [{
        id: "sc_formal_apology_01",
        scenarioType: "email",
        titleJa: "高橋部長への正式お詫びメール",
        titleVi: "Email xin lỗi chính thức gửi Takahashi",
        contextSummaryVi: "Đây là email chính thức đại diện công ty. Cần thể hiện sự nghiêm túc, trách nhiệm và cam kết cải thiện.",
        goalJa: "会社を代表して、誠意と具体的な改善策を伝える。",
        goalVi: "Đại diện công ty, truyền đạt sự chân thành và giải pháp cải thiện cụ thể.",
        characters: [{ npcSlug: "takahashi_clienthq", roleInScene: "recipient" }, { npcSlug: "yamada_bucho", roleInScene: "observer" }],
        payload: {
          emailThread: [{
            from: "田中 太郎 <tanaka@mirai-shoji.co.jp>",
            to: "高橋 部長 <takahashi@tokyo-tech.co.jp>",
            subjectJa: "納品不良に関するお詫びと今後の対応について",
            bodyJa: "（あなたがこれから書くメール）",
            timestamp: "2026-05-16T09:00:00Z",
          }],
        },
        question: {
          id: "q_formal_apology_01",
          skillTag: "keigo",
          difficulty: "standard",
          promptJa: "お詫びメールの「今後の対応」セクションとして、最も適切な表現はどれですか？",
          promptVi: "Phần \"đối ứng trong tương lai\" trong email xin lỗi, cách diễn đạt nào phù hợp nhất?",
          options: [
            {
              optionKey: "A",
              textJa: "今後の対応につきまして、下記のとおり実施してまいります。\n\n1. 代替品5個を本日発送（追跡番号：別途ご連絡）\n2. 品質管理体制の見直し（ダブルチェック体制への移行）\n3. 再発防止報告書の提出（来週金曜日まで）\n\n弊社といたしましては、このような事態を深く反省し、信頼回復に全力を尽くす所存でございます。",
              isCorrect: true,
              outcome: { trustDelta: 12, clarityScore: 95, politenessScore: 95, businessRiskDelta: -10, satisfactionDelta: 12, nextActionCorrect: true, npcReactionTag: "nod", consequenceJa: "具体的な日程と対策が明示されており、信頼感があります。", consequenceVi: "Ngày cụ thể và đối sách rõ ràng, tạo niềm tin.", affectedNpcSlug: "takahashi_clienthq", errorType: null },
            },
            {
              optionKey: "B",
              textJa: "今後はこのようなことがないよう、気をつけます。よろしくお願いします。",
              isCorrect: false,
              outcome: { trustDelta: -10, clarityScore: 25, politenessScore: 45, businessRiskDelta: 12, satisfactionDelta: -12, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "抽象的で、具体策がまったくありません。", consequenceVi: "Trừu tượng, hoàn toàn không có đối sách cụ thể.", affectedNpcSlug: "takahashi_clienthq", errorType: "action_item_miss" },
            },
            {
              optionKey: "C",
              textJa: "改善策として、担当者を変更いたします。新しい担当者から改めてご連絡いたします。",
              isCorrect: false,
              outcome: { trustDelta: -8, clarityScore: 50, politenessScore: 60, businessRiskDelta: 10, satisfactionDelta: -8, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "人を変えるだけでは根本的な解決にならず、責任回避にも見えます。", consequenceVi: "Chỉ đổi người không giải quyết gốc vấn đề, có vẻ trốn trách nhiệm.", affectedNpcSlug: "takahashi_clienthq", errorType: "responsibility_misread" },
            },
            {
              optionKey: "D",
              textJa: "つきましては、今後のお取引条件について、値引きでの対応をご提案させていただきたく存じます。具体的な条件は追ってご相談させてください。",
              isCorrect: false,
              outcome: { trustDelta: -5, clarityScore: 55, politenessScore: 70, businessRiskDelta: 8, satisfactionDelta: -6, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "品質問題を金銭で解決しようとしており、本質的ではありません。", consequenceVi: "Dùng tiền giải quyết vấn đề chất lượng, không bản chất.", affectedNpcSlug: "takahashi_clienthq", errorType: "priority_misread" },
            },
          ],
        },
      }],
    },
    rewards: { rankXp: 26, skillGains: { keigo: 7, written: 5, customer: 4, nuance: 3 }, npcTrustGains: [{ npcSlug: "takahashi_clienthq", delta: 10 }, { npcSlug: "yamada_bucho", delta: 8 }] },
  },

  /* ── Chapter 3-4 (Boss): クレーム対応の最終提案 ────────────────────── */
  {
    slug: "boss-final-resolution",
    ja: "【難関】クレーム対応の最終提案と関係修復",
    vi: "【Boss】Đề xuất giải quyết cuối cùng và khôi phục quan hệ",
    order: 4,
    boss: true,
    briefing: {
      briefingJa: "高橋部長から「今後の取引を継続するかどうか、上層部で検討中」と告げられました。最後のチャンスとして、対面ミーティングで信頼回復の提案を行います。",
      briefingVi: "Takahashi nói \"ban lãnh đạo đang xem xét có tiếp tục giao dịch hay không\". Đây là cơ hội cuối cùng — họp trực tiếp để đề xuất khôi phục niềm tin.",
      yourRoleVi: "田中 太郎",
      estimatedMinutes: 12,
    },
    scenario: {
      scenarios: [{
        id: "sc_final_resolution_01",
        scenarioType: "meeting",
        titleJa: "高橋部長との信頼回復ミーティング",
        titleVi: "Họp khôi phục niềm tin với Takahashi",
        contextSummaryVi: "Cuộc họp quyết định tương lai quan hệ kinh doanh. Takahashi giận nhưng sẵn sàng lắng nghe. Yamada cũng tham gia.",
        goalJa: "具体的な改善実績と今後の提案で、取引継続の判断を引き出す。",
        goalVi: "Dùng kết quả cải thiện cụ thể và đề xuất tương lai để thuyết phục tiếp tục giao dịch.",
        characters: [{ npcSlug: "takahashi_clienthq", roleInScene: "recipient" }, { npcSlug: "yamada_bucho", roleInScene: "manager" }, { npcSlug: "sato_kokyaku", roleInScene: "observer" }],
        payload: {
          meetingTranscript: [
            { speaker: "山田部長", lineJa: "高橋様、本日はお忙しい中、お時間をいただきありがとうございます。" },
            { speaker: "高橋部長", lineJa: "こちらこそ。正直、今回の件は社内でも問題になっています。具体的にどうされるおつもりですか。" },
            { speaker: "山田部長", lineJa: "田中から、改善の取り組みと今後のご提案をさせていただきます。" },
            { speaker: "あなた", lineJa: "（プレゼンテーションを始める）" },
          ],
        },
        question: {
          id: "q_final_resolution_01",
          skillTag: "meeting",
          difficulty: "hard",
          promptJa: "ミーティングでのプレゼンテーションの冒頭として、最も適切なものはどれですか？",
          promptVi: "Câu mở đầu presentation trong cuộc họp nào phù hợp nhất?",
          options: [
            {
              optionKey: "A",
              textJa: "高橋様、改めまして、この度の不良品の件、大変ご迷惑をおかけいたしました。\n\nまず、この2週間で実施した改善内容をご報告させていただきます。\n\n第一に、検品体制をダブルチェックに変更し、不良率を0.3%から0.02%に改善いたしました。\n第二に、品質管理の専任担当を配置いたしました。\n\nそして今後のご提案として、四半期ごとの品質報告会の実施と、初回ロットの無償サンプル提供をご用意しております。\n\nご検討いただけましたら幸いです。",
              isCorrect: true,
              outcome: { trustDelta: 18, clarityScore: 96, politenessScore: 94, businessRiskDelta: -15, satisfactionDelta: 18, nextActionCorrect: true, npcReactionTag: "smile", consequenceJa: "データに基づく改善実績と具体的な今後の提案が信頼感を与えます。", consequenceVi: "Kết quả cải thiện dựa trên dữ liệu và đề xuất cụ thể tạo niềm tin.", affectedNpcSlug: "takahashi_clienthq", errorType: null },
            },
            {
              optionKey: "B",
              textJa: "高橋様、本当にすみませんでした。二度とこのようなことがないよう、全力で取り組みます。どうかお取引を続けていただけませんか。",
              isCorrect: false,
              outcome: { trustDelta: -8, clarityScore: 30, politenessScore: 70, businessRiskDelta: 10, satisfactionDelta: -10, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "感情に訴えるだけで、データや具体策がありません。", consequenceVi: "Chỉ kêu gọi cảm xúc, thiếu dữ liệu và đối sách cụ thể.", affectedNpcSlug: "takahashi_clienthq", errorType: "business_context_error" },
            },
            {
              optionKey: "C",
              textJa: "今回の件は弊社の品質管理部門の問題です。該当部門には厳しく指導いたしました。今後は問題ないかと存じます。",
              isCorrect: false,
              outcome: { trustDelta: -12, clarityScore: 45, politenessScore: 50, businessRiskDelta: 14, satisfactionDelta: -12, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "他部門のせいにしており、組織としての責任感が見えません。", consequenceVi: "Đổ lỗi cho bộ phận khác, thiếu trách nhiệm tổ chức.", affectedNpcSlug: "takahashi_clienthq", errorType: "responsibility_misread" },
            },
            {
              optionKey: "D",
              textJa: "高橋様、弊社としては価格を10%引き下げる用意がございます。品質の件はお許しいただけますでしょうか。",
              isCorrect: false,
              outcome: { trustDelta: -10, clarityScore: 50, politenessScore: 60, businessRiskDelta: 12, satisfactionDelta: -10, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "品質問題を値引きで解決しようとしており、本末転倒です。", consequenceVi: "Dùng giảm giá để giải quyết vấn đề chất lượng, sai bản chất.", affectedNpcSlug: "takahashi_clienthq", errorType: "priority_misread" },
            },
          ],
        },
      }],
    },
    rewards: {
      rankXp: 45,
      skillGains: { meeting: 10, customer: 8, keigo: 6, nuance: 5, chart: 3 },
      npcTrustGains: [{ npcSlug: "takahashi_clienthq", delta: 18 }, { npcSlug: "yamada_bucho", delta: 15 }, { npcSlug: "sato_kokyaku", delta: 8 }],
      npcReactionMontage: [
        { npcSlug: "takahashi_clienthq", quoteJa: "具体的な改善データ、説得力がありますね。検討させていただきます。", sentiment: "positive" },
        { npcSlug: "yamada_bucho", quoteJa: "よくやった。高橋さんも少し表情が和らいでいたな。", sentiment: "positive" },
        { npcSlug: "sato_kokyaku", quoteJa: "田中さんの対応、社内でも評価されていますよ。", sentiment: "positive" },
      ],
    },
  },
];

for (const ch of arc3Chapters) {
  await upsert(
    `INSERT INTO career.mission_chapter (arc_id, slug, title_ja, title_vi, display_order, is_boss, briefing_payload, scenario_payload, rewards_payload)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (arc_id, slug) DO UPDATE SET title_ja=EXCLUDED.title_ja, title_vi=EXCLUDED.title_vi, display_order=EXCLUDED.display_order, is_boss=EXCLUDED.is_boss, briefing_payload=EXCLUDED.briefing_payload, scenario_payload=EXCLUDED.scenario_payload, rewards_payload=EXCLUDED.rewards_payload`,
    [arc3Id, ch.slug, ch.ja, ch.vi, ch.order, ch.boss, JSON.stringify(ch.briefing), JSON.stringify(ch.scenario), JSON.stringify(ch.rewards)],
  );
}
console.log(`✓ ${arc3Chapters.length} chapters upserted for arc.complaint-handling`);

/* ─── Verify ──────────────────────────────────────────────────────────────── */

console.log("\n─── Verification ───");
for (const t of ["career_rank", "mission_arc", "mission_chapter", "story_npc"]) {
  const r = await client.query(`SELECT count(*)::int as cnt FROM career.${t}`);
  console.log(`  ${t}: ${r.rows[0].cnt} rows`);
}

// Verify all chapters have scenario data
const emptyScenarios = await client.query(`
  SELECT slug, title_ja FROM career.mission_chapter
  WHERE scenario_payload::text = '{}' OR scenario_payload::text = '{"scenarios":[]}'
`);
if (emptyScenarios.rows.length > 0) {
  console.warn("⚠ Chapters with empty scenarios:", emptyScenarios.rows.map((r) => r.slug));
} else {
  console.log("  ✓ All chapters have scenario data");
}

// Verify all arcs have chapters
const arcChapterCounts = await client.query(`
  SELECT a.slug, a.title_ja, a.display_order, count(c.id)::int as chapter_count
  FROM career.mission_arc a
  LEFT JOIN career.mission_chapter c ON c.arc_id = a.id
  GROUP BY a.slug, a.title_ja, a.display_order
  ORDER BY a.display_order
`);
for (const row of arcChapterCounts.rows) {
  console.log(`  ${row.slug}: ${row.chapter_count} chapters (${row.title_ja})`);
}

await client.end();
console.log("\n✓ Career RPG seed complete.");
