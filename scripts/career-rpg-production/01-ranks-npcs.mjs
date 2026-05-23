/**
 * Career RPG Production Seed: Ranks & NPCs
 * Seeds all 8 career ranks and 12 story NPCs.
 */
import { createClient, upsert } from "./_helpers.mjs";

export async function seedRanksAndNpcs(client) {
  /* ─── Career Ranks (8) ──────────────────────────────────────────────── */
  const ranks = [
    { rc: "R1", ja: "内定者", vi: "Nhân viên dự bị", band: "pre-J5", floor: 0, xp: 60, arcs: 2, scenes: ["email"], order: 1 },
    { rc: "R2", ja: "新入社員", vi: "Nhân viên mới", band: "J5", floor: 30, xp: 120, arcs: 2, scenes: ["email", "chat"], order: 2 },
    { rc: "R3", ja: "一般社員", vi: "Nhân viên chính thức", band: "J4", floor: 45, xp: 320, arcs: 3, scenes: ["email", "chat", "deadline"], order: 3 },
    { rc: "R4", ja: "主任", vi: "Chuyên viên", band: "J3", floor: 60, xp: 600, arcs: 3, scenes: ["email", "chat", "deadline", "meeting", "complaint"], order: 4 },
    { rc: "R5", ja: "係長", vi: "Trưởng nhóm", band: "J3+", floor: 70, xp: 1000, arcs: 3, scenes: ["email", "chat", "deadline", "meeting", "complaint", "report_chart"], order: 5 },
    { rc: "R6", ja: "課長", vi: "Trưởng phòng", band: "J2", floor: 78, xp: 1600, arcs: 3, scenes: ["email", "chat", "deadline", "meeting", "complaint", "report_chart"], order: 6 },
    { rc: "R7", ja: "部長", vi: "Giám đốc bộ phận", band: "J2+", floor: 85, xp: 2400, arcs: 3, scenes: ["email", "chat", "deadline", "meeting", "complaint", "report_chart"], order: 7 },
    { rc: "R8", ja: "グローバル幹部候補", vi: "Ứng viên Lãnh đạo Toàn cầu", band: "J1", floor: 92, xp: 0, arcs: 2, scenes: ["email", "chat", "deadline", "meeting", "complaint", "report_chart"], order: 8 },
  ];

  for (const r of ranks) {
    await upsert(client,
      `INSERT INTO career.career_rank (rank_code, title_ja, title_vi, bjt_band_target, min_skill_floor, required_arc_count, xp_to_next, unlocked_scene_types, display_order, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,now())
       ON CONFLICT (rank_code) DO UPDATE SET title_ja=EXCLUDED.title_ja, title_vi=EXCLUDED.title_vi, bjt_band_target=EXCLUDED.bjt_band_target, min_skill_floor=EXCLUDED.min_skill_floor, required_arc_count=EXCLUDED.required_arc_count, xp_to_next=EXCLUDED.xp_to_next, unlocked_scene_types=EXCLUDED.unlocked_scene_types, display_order=EXCLUDED.display_order, updated_at=now()`,
      [r.rc, r.ja, r.vi, r.band, r.floor, r.arcs, r.xp, JSON.stringify(r.scenes), r.order],
    );
  }
  console.log(`✓ ${ranks.length} career ranks upserted`);

  /* ─── Story NPCs (12) ───────────────────────────────────────────────── */
  const npcs = [
    // Internal — 株式会社ミライ商事
    { slug: "yamada_bucho", ja: "山田 部長", role: "営業部 部長", co: "株式会社ミライ商事", rel: "uchi", avatar: { avatarInitial: "山", avatarTint: "#1B2A4A", bioVi: "Sếp trực tiếp, nghiêm túc nhưng công bằng. Đánh giá cao sự rõ ràng và logic." } },
    { slug: "suzuki_kakaricho", ja: "鈴木 係長", role: "営業部 係長", co: "株式会社ミライ商事", rel: "uchi", avatar: { avatarInitial: "鈴", avatarTint: "#0E7490", bioVi: "Đồng nghiệp ngang hàng, hơi cạnh tranh nhưng tôn trọng năng lực." } },
    { slug: "tanaka_senpai", ja: "田中 先輩", role: "営業部 主任", co: "株式会社ミライ商事", rel: "uchi", avatar: { avatarInitial: "田", avatarTint: "#059669", bioVi: "Tiền bối hướng dẫn, luôn sẵn sàng hỗ trợ. Kỳ vọng bạn tự lập dần." } },
    { slug: "morita_kouhai", ja: "森田 後輩", role: "営業部 一般社員", co: "株式会社ミライ商事", rel: "uchi", avatar: { avatarInitial: "森", avatarTint: "#7C3AED", bioVi: "Hậu bối bạn phụ trách hướng dẫn. Chăm chỉ nhưng hay lo lắng." } },
    { slug: "ogawa_finance", ja: "小川 課長", role: "経理部 課長", co: "株式会社ミライ商事", rel: "uchi", avatar: { avatarInitial: "小", avatarTint: "#CA8A04", bioVi: "Trưởng phòng kế toán. Cẩn thận với số liệu, yêu cầu chính xác tuyệt đối." } },
    { slug: "nakamura_hr", ja: "中村 部長", role: "人事部 部長", co: "株式会社ミライ商事", rel: "uchi", avatar: { avatarInitial: "中", avatarTint: "#DC2626", bioVi: "Giám đốc nhân sự. Quan tâm phát triển con người, đánh giá EQ cao." } },
    { slug: "ito_shachou", ja: "伊藤 社長", role: "代表取締役社長", co: "株式会社ミライ商事", rel: "uchi", avatar: { avatarInitial: "伊", avatarTint: "#1E3A5F", bioVi: "Tổng giám đốc. Tầm nhìn chiến lược, ít nói nhưng sắc bén." } },
    { slug: "watanabe_global", ja: "渡辺 部長", role: "海外事業部 部長", co: "株式会社ミライ商事", rel: "uchi", avatar: { avatarInitial: "渡", avatarTint: "#0369A1", bioVi: "GĐ bộ phận kinh doanh quốc tế. Kinh nghiệm 15 năm làm việc với đối tác nước ngoài." } },
    // External — clients & partners
    { slug: "sato_kokyaku", ja: "佐藤 様", role: "購買担当 課長", co: "東京テクノロジー株式会社", rel: "soto", avatar: { avatarInitial: "佐", avatarTint: "#B45309", bioVi: "Khách hàng chính, quan hệ lâu năm. Lịch sự nhưng kỳ vọng cao." } },
    { slug: "takahashi_clienthq", ja: "高橋 部長", role: "調達部 部長", co: "東京テクノロジー株式会社", rel: "soto", avatar: { avatarInitial: "高", avatarTint: "#9F1239", bioVi: "Lãnh đạo phía khách hàng. Khó tính, đòi hỏi dữ liệu rõ ràng." } },
    { slug: "kim_partner", ja: "金 取締役", role: "パートナーシップ担当取締役", co: "KS Global Co., Ltd.", rel: "soto", avatar: { avatarInitial: "金", avatarTint: "#6D28D9", bioVi: "Giám đốc đối tác Hàn Quốc. Thẳng thắn, coi trọng tốc độ ra quyết định." } },
    { slug: "miller_vp", ja: "ミラー VP", role: "Vice President, APAC Sales", co: "GlobalTech Solutions Inc.", rel: "soto", avatar: { avatarInitial: "M", avatarTint: "#0891B2", bioVi: "Phó chủ tịch phụ trách APAC bên đối tác Mỹ. Giao tiếp trực tiếp, ưu tiên kết quả." } },
  ];

  for (const n of npcs) {
    await upsert(client,
      `INSERT INTO career.story_npc (slug, name_ja, role_ja, company_ja, default_relation, avatar_media, status)
       VALUES ($1,$2,$3,$4,$5,$6,'active')
       ON CONFLICT (slug) DO UPDATE SET name_ja=EXCLUDED.name_ja, role_ja=EXCLUDED.role_ja, company_ja=EXCLUDED.company_ja, default_relation=EXCLUDED.default_relation, avatar_media=EXCLUDED.avatar_media, status='active'`,
      [n.slug, n.ja, n.role, n.co, n.rel, JSON.stringify(n.avatar)],
    );
  }
  console.log(`✓ ${npcs.length} story NPCs upserted`);
}

// Allow direct execution
if (process.argv[1]?.includes("01-ranks-npcs")) {
  const client = await (await import("./_helpers.mjs")).createClient();
  await seedRanksAndNpcs(client);
  await client.end();
}
