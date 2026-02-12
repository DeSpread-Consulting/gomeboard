import { Pool } from "pg";

const pool = new Pool({
  host: process.env.KOL_DB_HOST,
  port: Number(process.env.KOL_DB_PORT) || 5432,
  database: process.env.KOL_DB_NAME,
  user: process.env.KOL_DB_USER,
  password: process.env.KOL_DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
  max: 5,
});

export async function queryKolNodes() {
  const { rows } = await pool.query(
    `SELECT channel_id, title, username, calculated_tier, main_group,
            total_cited, cited_by_ap_count, cited_by_a_count, noble_score,
            subscriber_count, profile_image_url
     FROM kol.nodes
     ORDER BY total_cited DESC NULLS LAST`
  );
  return rows.map((r) => ({
    ...r,
    channel_id: Number(r.channel_id),
    total_cited: r.total_cited ?? 0,
    cited_by_ap_count: r.cited_by_ap_count ?? 0,
    cited_by_a_count: r.cited_by_a_count ?? 0,
    noble_score: r.noble_score ?? 0,
    subscriber_count: r.subscriber_count ?? 0,
  }));
}

export async function queryKolEdges() {
  const { rows } = await pool.query(
    `SELECT source_id, target_id, weight, is_golden_link
     FROM kol.edges
     WHERE weight >= 2`
  );
  return rows.map((r) => ({
    ...r,
    source_id: Number(r.source_id),
    target_id: Number(r.target_id),
    weight: r.weight ?? 0,
    is_golden_link: r.is_golden_link ?? false,
  }));
}
