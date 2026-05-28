/**
 * Shared helpers for Career RPG production seed.
 * Provides DB connection and upsert utilities.
 */
import pg from "pg";

export async function createClient() {
  const client = new pg.Client(
    process.env.DATABASE_URL ??
      "postgresql://postgres:postgres@127.0.0.1:15432/nihongo_bjt",
  );
  await client.connect();
  return client;
}

export async function upsert(client, sql, params) {
  await client.query(sql, params);
}

export async function upsertArc(client, arc) {
  const res = await client.query(
    `INSERT INTO career.mission_arc (slug, title_ja, title_vi, rank_code_entry, story_payload, status, display_order, updated_at)
     VALUES ($1,$2,$3,$4,$5,'published',$6,now())
     ON CONFLICT (slug) DO UPDATE SET title_ja=EXCLUDED.title_ja, title_vi=EXCLUDED.title_vi, rank_code_entry=EXCLUDED.rank_code_entry, story_payload=EXCLUDED.story_payload, status='published', display_order=EXCLUDED.display_order, updated_at=now()
     RETURNING id`,
    [arc.slug, arc.ja, arc.vi, arc.rank, JSON.stringify(arc.story), arc.order],
  );
  return res.rows[0].id;
}

export async function upsertChapters(client, arcId, chapters) {
  for (const ch of chapters) {
    await client.query(
      `INSERT INTO career.mission_chapter (arc_id, slug, title_ja, title_vi, display_order, is_boss, briefing_payload, scenario_payload, rewards_payload)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (arc_id, slug) DO UPDATE SET title_ja=EXCLUDED.title_ja, title_vi=EXCLUDED.title_vi, display_order=EXCLUDED.display_order, is_boss=EXCLUDED.is_boss, briefing_payload=EXCLUDED.briefing_payload, scenario_payload=EXCLUDED.scenario_payload, rewards_payload=EXCLUDED.rewards_payload`,
      [arcId, ch.slug, ch.ja, ch.vi, ch.order, ch.boss, JSON.stringify(ch.briefing), JSON.stringify(ch.scenario), JSON.stringify(ch.rewards)],
    );
  }
}
