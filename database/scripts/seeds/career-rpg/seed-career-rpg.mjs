/**
 * Seed Career RPG tables with production-ready data.
 * Usage:  node scripts/seed-career-rpg.mjs
 */
import pg from "pg";

const client = new pg.Client(
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:15432/nihongo_bjt"
);
await client.connect();

// ── Career Ranks ────────────────────────────────────────────────────────────

const ranks = [
  { rc: "R1", ja: "内定者", vi: "Nhân viên dự bị", band: "pre-J5", floor: 0, xp: 60, scenes: ["email"], order: 1 },
  { rc: "R2", ja: "新入社員", vi: "Nhân viên mới", band: "J5", floor: 30, xp: 120, scenes: ["email","chat"], order: 2 },
  { rc: "R3", ja: "一般社員", vi: "Nhân viên chính thức", band: "J4", floor: 45, xp: 320, scenes: ["email","chat","deadline"], order: 3 },
  { rc: "R4", ja: "主任", vi: "Chuyên viên", band: "J3", floor: 60, xp: 600, scenes: ["email","chat","deadline","meeting","complaint"], order: 4 },
  { rc: "R5", ja: "係長", vi: "Trưởng nhóm", band: "J3+", floor: 70, xp: 1000, scenes: ["email","chat","deadline","meeting","complaint","report_chart"], order: 5 },
  { rc: "R6", ja: "課長", vi: "Trưởng phòng", band: "J2", floor: 78, xp: 1600, scenes: ["email","chat","deadline","meeting","complaint","report_chart"], order: 6 },
  { rc: "R7", ja: "部長", vi: "Giám đốc bộ phận", band: "J2+", floor: 85, xp: 2400, scenes: ["email","chat","deadline","meeting","complaint","report_chart"], order: 7 },
  { rc: "R8", ja: "グローバル幹部 候補", vi: "Ứng viên Lãnh đạo Toàn cầu", band: "J1", floor: 92, xp: 0, scenes: ["email","chat","deadline","meeting","complaint","report_chart"], order: 8 },
];

for (const r of ranks) {
  await client.query(
    `INSERT INTO career.career_rank (rank_code, title_ja, title_vi, bjt_band_target, min_skill_floor, xp_to_next, unlocked_scene_types, display_order, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now())
     ON CONFLICT (rank_code) DO UPDATE SET title_ja=EXCLUDED.title_ja, title_vi=EXCLUDED.title_vi, bjt_band_target=EXCLUDED.bjt_band_target, min_skill_floor=EXCLUDED.min_skill_floor, xp_to_next=EXCLUDED.xp_to_next, unlocked_scene_types=EXCLUDED.unlocked_scene_types, display_order=EXCLUDED.display_order, updated_at=now()`,
    [r.rc, r.ja, r.vi, r.band, r.floor, r.xp, JSON.stringify(r.scenes), r.order]
  );
}
console.log(ranks.length + " career ranks upserted");

// ── Story NPCs ──────────────────────────────────────────────────────────────

const npcs = [
  { slug: "yamada_bucho", ja: "山田 部長", role: "営業部 部長", co: "株式会社ミライ商事", rel: "uchi", avatar: { avatarInitial: "山", avatarTint: "#1B2A4A", bioVi: "Cấp trên trực tiếp." } },
  { slug: "suzuki_kakaricho", ja: "鈴木 係長", role: "営業部 係長", co: "株式会社ミライ商事", rel: "uchi", avatar: { avatarInitial: "鈴", avatarTint: "#0E7490", bioVi: "Đối thủ thân thiện." } },
  { slug: "tanaka_senpai", ja: "田中 先輩", role: "営業部 主任", co: "株式会社ミライ商事", rel: "uchi", avatar: { avatarInitial: "田", avatarTint: "#059669", bioVi: "Tiền bối hướng dẫn." } },
  { slug: "sato_kokyaku", ja: "佐藤 様", role: "購買担当", co: "東京テクノロジー株式会社", rel: "soto", avatar: { avatarInitial: "佐", avatarTint: "#B45309", bioVi: "Khách hàng dài hạn." } },
  { slug: "takahashi_clienthq", ja: "高橋 部長", role: "調達部 部長", co: "東京テクノロジー株式会社", rel: "soto", avatar: { avatarInitial: "高", avatarTint: "#9F1239", bioVi: "Lãnh đạo phía khách hàng." } },
];

for (const n of npcs) {
  await client.query(
    `INSERT INTO career.story_npc (slug, name_ja, role_ja, company_ja, default_relation, avatar_media, status)
     VALUES ($1,$2,$3,$4,$5,$6,'active')
     ON CONFLICT (slug) DO UPDATE SET name_ja=EXCLUDED.name_ja, role_ja=EXCLUDED.role_ja, company_ja=EXCLUDED.company_ja, default_relation=EXCLUDED.default_relation, avatar_media=EXCLUDED.avatar_media, status='active'`,
    [n.slug, n.ja, n.role, n.co, n.rel, JSON.stringify(n.avatar)]
  );
}
console.log(npcs.length + " story NPCs upserted");

// ── Mission Arcs ────────────────────────────────────────────────────────────

const arcsData = [
  { slug: "arc.hou-ren-sou", ja: "報連相 基礎", vi: "Nền tảng 報連相 (Hou-Ren-Sou)", rank: "R2", story: { synopsisVi: "Học cách báo cáo / liên lạc / tham vấn với cấp trên đúng nhịp công ty Nhật.", npcSlugs: ["yamada_bucho","tanaka_senpai"], artAccent: "#0E7490" }, order: 1 },
  { slug: "arc.client-email", ja: "取引先メール", vi: "Email gửi khách hàng (取引先メール)", rank: "R3", story: { synopsisVi: "Viết email tới khách hàng bên ngoài: báo giá, theo dõi, từ chối khéo, thông báo tăng giá.", npcSlugs: ["sato_kokyaku","yamada_bucho","tanaka_senpai"], artAccent: "#1B2A4A" }, order: 2 },
  { slug: "arc.complaint-handling", ja: "クレーム対応", vi: "Xử lý khiếu nại khách hàng", rank: "R4", story: { synopsisVi: "Front line ứng phó khiếu nại: nghe, xác nhận sự thật, xin lỗi đúng mực, leo thang đúng cách.", npcSlugs: ["takahashi_clienthq","yamada_bucho"], artAccent: "#9F1239" }, order: 3 },
];

const arcIds = {};
for (const a of arcsData) {
  const res = await client.query(
    `INSERT INTO career.mission_arc (slug, title_ja, title_vi, rank_code_entry, story_payload, status, display_order, updated_at)
     VALUES ($1,$2,$3,$4,$5,'published',$6,now())
     ON CONFLICT (slug) DO UPDATE SET title_ja=EXCLUDED.title_ja, title_vi=EXCLUDED.title_vi, rank_code_entry=EXCLUDED.rank_code_entry, story_payload=EXCLUDED.story_payload, status='published', display_order=EXCLUDED.display_order, updated_at=now()
     RETURNING id`,
    [a.slug, a.ja, a.vi, a.rank, JSON.stringify(a.story), a.order]
  );
  arcIds[a.slug] = res.rows[0].id;
}
console.log(arcsData.length + " mission arcs upserted");

// ── Mission Chapters (arc.client-email) ─────────────────────────────────────

const arcId = arcIds["arc.client-email"];

// Build scenario JSON separately to avoid quoting issues
const scenario1 = {
  scenarios: [{
    id: "sc_email_followup_01",
    scenarioType: "email",
    titleJa: "佐藤様へのフォローアップメール",
    titleVi: "Email theo d\u00f5i g\u1eedi Sato-san",
    contextSummaryVi: "Kh\u00e1ch h\u00e0ng c\u00f3 th\u1ec3 \u0111ang b\u1eadn ho\u1eb7c \u0111ang c\u00e2n nh\u1eafc \u0111\u1ed1i th\u1ee7.",
    goalJa: "返信を促しつつ、相手にプレッシャーを与えないメールを書く。",
    goalVi: "Th\u00fac \u0111\u1ea9y ph\u1ea3n h\u1ed3i m\u00e0 kh\u00f4ng t\u1ea1o \u00e1p l\u1ef1c cho kh\u00e1ch h\u00e0ng.",
    characters: [{ npcSlug: "sato_kokyaku", roleInScene: "recipient" }, { npcSlug: "yamada_bucho", roleInScene: "observer" }],
    payload: {
      emailThread: [{
        from: "田中 太郎 <tanaka@mirai-shoji.co.jp>",
        to: "佐藤 様 <sato@tokyo-tech.co.jp>",
        subjectJa: "お見積もりの件（株式会社ミライ商事）",
        bodyJa: "佐藤様\n\nいつも大変お世話になっております。\nミライ商事の田中でございます。\n\n先日ご送付いたしました見積書につきまして、ご確認いただけましたでしょうか。",
        timestamp: "2026-05-06T10:00:00Z"
      }]
    },
    question: {
      id: "q_followup_01",
      skillTag: "written",
      difficulty: "standard",
      promptJa: "三日経っても返信がありません。今日のフォローアップとして、最も適切な一文はどれですか？",
      promptVi: "Sau 3 ng\u00e0y v\u1eabn ch\u01b0a c\u00f3 h\u1ed3i \u00e2m. C\u00e2u n\u00e0o ph\u00f9 h\u1ee3p nh\u1ea5t?",
      options: [
        { optionKey: "A", textJa: "先日のお見積もり、いかがでしたでしょうか。早めにご返信ください。", isCorrect: false, outcome: { trustDelta: -8, clarityScore: 70, politenessScore: 45, businessRiskDelta: 10, satisfactionDelta: -10, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "催促のように聞こえます。", consequenceVi: "Nghe gi\u1ee5c gi\u00e3.", affectedNpcSlug: "sato_kokyaku", errorType: "keigo_misunderstanding" } },
        { optionKey: "B", textJa: "先日お送りしたお見積もりにつきまして、その後ご検討状況はいかがでしょうか。お忙しいところ恐縮ですが、ご都合のよろしいときにご一報いただけますと幸いです。", isCorrect: true, outcome: { trustDelta: 12, clarityScore: 88, politenessScore: 92, businessRiskDelta: -6, satisfactionDelta: 8, nextActionCorrect: true, npcReactionTag: "smile", consequenceJa: "丁寧で配慮のある言い回しです。", consequenceVi: "Tinh t\u1ebf v\u00e0 c\u00f3 配慮.", affectedNpcSlug: "sato_kokyaku", errorType: null } },
        { optionKey: "C", textJa: "返事まだですよね？確認お願いします。", isCorrect: false, outcome: { trustDelta: -16, clarityScore: 55, politenessScore: 18, businessRiskDelta: 18, satisfactionDelta: -16, nextActionCorrect: false, npcReactionTag: "escalate", consequenceJa: "敬語が崩れています。", consequenceVi: "M\u1ea5t 敬語.", affectedNpcSlug: "sato_kokyaku", errorType: "internal_external_tone_mismatch" } },
        { optionKey: "D", textJa: "見積もりについて、もし社内で承認が下りない場合は、こちらでも何かサポートできることがあれば仰ってください。", isCorrect: false, outcome: { trustDelta: -2, clarityScore: 60, politenessScore: 78, businessRiskDelta: 6, satisfactionDelta: -2, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "勝手に想定したため失礼に感じる可能性があります。", consequenceVi: "Gi\u1ea3 \u0111\u1ecbnh khi\u1ebfn kh\u00e1ch kh\u00f3 ch\u1ecbu.", affectedNpcSlug: "sato_kokyaku", errorType: "implied_meaning_error" } },
      ]
    }
  }]
};

const chapters = [
  { slug: "first-quote-send", ja: "初めての見積もり送付", vi: "Lần đầu gửi báo giá", order: 1, boss: false, briefing: { briefingJa: "新規取引先へ初めて見積書を送付します。", briefingVi: "Lần đầu gửi báo giá.", yourRoleVi: "田中 太郎", estimatedMinutes: 5 }, scenario: { scenarios: [] }, rewards: { rankXp: 16, skillGains: { written: 4, keigo: 3 }, npcTrustGains: [{ npcSlug: "yamada_bucho", delta: 6 }] } },
  { slug: "follow-up-after-quote", ja: "見積もり送付後のフォローアップ", vi: "Theo dõi sau khi gửi báo giá", order: 2, boss: false, briefing: { briefingJa: "三日前に佐藤様へ見積書を送りました。", briefingVi: "Theo dõi báo giá.", yourRoleVi: "田中 太郎", estimatedMinutes: 6 }, scenario: scenario1, rewards: { rankXp: 24, skillGains: { keigo: 8, written: 5, customer: 3 }, npcTrustGains: [{ npcSlug: "yamada_bucho", delta: 12 }, { npcSlug: "sato_kokyaku", delta: 8 }, { npcSlug: "tanaka_senpai", delta: 4 }], npcReactionMontage: [{ npcSlug: "yamada_bucho", quoteJa: "うん、その配慮は大事だね。", sentiment: "positive" }, { npcSlug: "tanaka_senpai", quoteJa: "ナイス。クッション言葉、自然に使えてたね。", sentiment: "positive" }, { npcSlug: "sato_kokyaku", quoteJa: "ご丁寧なご連絡、ありがとうございます。", sentiment: "positive" }] } },
  { slug: "rate-increase-notice", ja: "値上げ通知のメール", vi: "Email thông báo tăng giá", order: 3, boss: false, briefing: { briefingJa: "原材料の高騰により値上げをお願いします。", briefingVi: "Thông báo tăng giá.", yourRoleVi: "田中 太郎", estimatedMinutes: 8 }, scenario: { scenarios: [] }, rewards: { rankXp: 20, skillGains: { written: 6, customer: 4, nuance: 3 }, npcTrustGains: [{ npcSlug: "sato_kokyaku", delta: 6 }] } },
  { slug: "boss-difficult-client", ja: "【難関】こじれた取引先への謝罪と再提案", vi: "【Boss】Email xin lỗi", order: 4, boss: true, briefing: { briefingJa: "前任者の失敗で関係がこじれた取引先。", briefingVi: "Khôi phục quan hệ.", yourRoleVi: "田中 太郎", estimatedMinutes: 12 }, scenario: { scenarios: [] }, rewards: { rankXp: 40, skillGains: { keigo: 10, written: 8, customer: 6, nuance: 5 }, npcTrustGains: [{ npcSlug: "yamada_bucho", delta: 15 }, { npcSlug: "sato_kokyaku", delta: 12 }] } },
];

for (const ch of chapters) {
  await client.query(
    `INSERT INTO career.mission_chapter (arc_id, slug, title_ja, title_vi, display_order, is_boss, briefing_payload, scenario_payload, rewards_payload)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (arc_id, slug) DO UPDATE SET title_ja=EXCLUDED.title_ja, title_vi=EXCLUDED.title_vi, display_order=EXCLUDED.display_order, is_boss=EXCLUDED.is_boss, briefing_payload=EXCLUDED.briefing_payload, scenario_payload=EXCLUDED.scenario_payload, rewards_payload=EXCLUDED.rewards_payload`,
    [arcId, ch.slug, ch.ja, ch.vi, ch.order, ch.boss, JSON.stringify(ch.briefing), JSON.stringify(ch.scenario), JSON.stringify(ch.rewards)]
  );
}
console.log(chapters.length + " chapters upserted for arc.client-email");

// ── Verify ──────────────────────────────────────────────────────────────────

for (const t of ["career_rank","mission_arc","mission_chapter","story_npc"]) {
  const r = await client.query(`SELECT count(*)::int as cnt FROM career.${t}`);
  console.log(t + ": " + r.rows[0].cnt);
}

await client.end();
console.log("Done.");
