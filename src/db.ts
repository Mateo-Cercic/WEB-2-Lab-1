import { Pool } from "pg";

export type PassStatus = "ACTIVE" | "CANCELLED";

export interface Pass {
  id: string;
  name: string;
  document: string;
  issued_at: Date;
  status: PassStatus;
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
});

export async function initDb(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS passes (
      id        UUID PRIMARY KEY,
      name      TEXT NOT NULL,
      document  TEXT NOT NULL,
      issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      status    TEXT NOT NULL DEFAULT 'ACTIVE'
    )
  `);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s: string): boolean => UUID_RE.test(s);

export async function getCounts(): Promise<{ total: number; active: number }> {
  const r = await pool.query(
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE status = 'ACTIVE')::int AS active
     FROM passes`
  );
  return r.rows[0];
}

export async function listPasses(): Promise<Pass[]> {
  const r = await pool.query<Pass>(`SELECT * FROM passes ORDER BY issued_at DESC`);
  return r.rows;
}

export async function getPass(id: string): Promise<Pass | null> {
  const r = await pool.query<Pass>(`SELECT * FROM passes WHERE id = $1`, [id]);
  return r.rows[0] ?? null;
}

export async function createPass(id: string, name: string, document: string): Promise<void> {
  await pool.query(`INSERT INTO passes (id, name, document) VALUES ($1, $2, $3)`, [id, name, document]);
}

export async function cancelPass(id: string): Promise<void> {
  await pool.query(`UPDATE passes SET status = 'CANCELLED' WHERE id = $1`, [id]);
}

export async function deletePass(id: string): Promise<void> {
  await pool.query(`DELETE FROM passes WHERE id = $1`, [id]);
}
