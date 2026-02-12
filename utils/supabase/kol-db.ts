import { Pool, type PoolClient } from "pg";

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      host: process.env.KOL_DB_HOST,
      port: parseInt(process.env.KOL_DB_PORT || "5432"),
      database: process.env.KOL_DB_NAME,
      user: process.env.KOL_DB_USER,
      password: process.env.KOL_DB_PASSWORD,
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30000,
    });
  }
  return pool;
}

export async function queryKolDb<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  const p = getPool();
  const result = await p.query(sql, params);
  return result.rows as T[];
}

export function getCmcPartitionTable(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `cmc_exchange_market_pairs_y${year}m${month}`;
}
