import { Pool } from "pg";

export type DbValue = string | number | bigint | boolean | null | Uint8Array | Date;
export type DbArgs = Array<DbValue>;
export type DbStatement = { sql: string; args?: DbArgs } | string;
export type DbResultSet = { rows: Array<Record<string, unknown>> };

export type DbClient = {
  execute(stmtOrSql: DbStatement, args?: DbArgs): Promise<DbResultSet>;
};

let pool: Pool | null = null;
let ready: Promise<void> | null = null;

function getDatabaseUrl(): string {
  const url =
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.PRISMA_DATABASE_URL ??
    "";
  return String(url).trim();
}

function shouldUseSsl(url: string) {
  const u = url.toLowerCase();
  return u.includes("sslmode=require") || u.includes("ssl=true");
}

function getPool(): Pool {
  if (pool) return pool;
  const url = getDatabaseUrl();
  if (!url) {
    throw new Error("DATABASE_URL/POSTGRES_URL/PRISMA_DATABASE_URL is required");
  }
  pool = new Pool({
    connectionString: url,
    ssl: shouldUseSsl(url) ? { rejectUnauthorized: false } : undefined,
    max: 5,
  });
  return pool;
}

function convertQuestionMarksToPostgres(sql: string): string {
  let out = "";
  let inSingle = false;
  let paramIndex = 0;

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i]!;

    if (ch === "'") {
      if (inSingle && sql[i + 1] === "'") {
        out += "''";
        i++;
        continue;
      }
      inSingle = !inSingle;
      out += ch;
      continue;
    }

    if (ch === "?" && !inSingle) {
      paramIndex++;
      out += `$${paramIndex}`;
      continue;
    }

    out += ch;
  }

  return out;
}

const client: DbClient = {
  async execute(stmtOrSql: DbStatement, args?: DbArgs) {
    const p = getPool();

    if (typeof stmtOrSql === "string") {
      const res = await p.query(stmtOrSql);
      return { rows: res.rows as Array<Record<string, unknown>> };
    }

    const sql = convertQuestionMarksToPostgres(stmtOrSql.sql);
    const a = stmtOrSql.args ?? args ?? [];
    const res = await p.query(sql, a);
    return { rows: res.rows as Array<Record<string, unknown>> };
  },
};

export function getDbClient(): DbClient {
  return client;
}

async function migrate(db: DbClient) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS waybills (
      id TEXT PRIMARY KEY,
      external_code TEXT UNIQUE,
      sender_name TEXT NOT NULL,
      sender_phone TEXT NOT NULL,
      sender_address TEXT NOT NULL,
      receiver_name TEXT NOT NULL,
      receiver_phone TEXT NOT NULL,
      receiver_address TEXT NOT NULL,
      weight_kg DOUBLE PRECISION NOT NULL,
      piece_count INTEGER NOT NULL,
      temp_layer TEXT NOT NULL,
      remark TEXT,
      created_at TEXT NOT NULL
    )
  `);

  await db.execute(`CREATE INDEX IF NOT EXISTS idx_waybills_created_at ON waybills(created_at)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_waybills_receiver_name ON waybills(receiver_name)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_waybills_external_code ON waybills(external_code)`);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS template_mappings (
      fingerprint TEXT PRIMARY KEY,
      mapping_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS import_tasks (
      id TEXT PRIMARY KEY,
      file_name TEXT NOT NULL,
      fingerprint TEXT NOT NULL,
      total_count INTEGER NOT NULL,
      success_count INTEGER NOT NULL,
      fail_count INTEGER NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      finished_at TEXT
    )
  `);

  await db.execute(`CREATE INDEX IF NOT EXISTS idx_import_tasks_created_at ON import_tasks(created_at)`);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS import_details (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      row_no INTEGER NOT NULL,
      external_code TEXT,
      sender_name TEXT,
      sender_phone TEXT,
      sender_address TEXT,
      receiver_name TEXT,
      receiver_phone TEXT,
      receiver_address TEXT,
      weight_kg DOUBLE PRECISION,
      piece_count INTEGER,
      temp_layer TEXT,
      remark TEXT,
      ok INTEGER NOT NULL,
      error TEXT,
      created_at TEXT NOT NULL
    )
  `);

  await db.execute(`CREATE INDEX IF NOT EXISTS idx_import_details_task_id ON import_details(task_id)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_import_details_task_row ON import_details(task_id, row_no)`);

  await db.execute(`ALTER TABLE import_details ADD COLUMN IF NOT EXISTS sender_name TEXT`);
  await db.execute(`ALTER TABLE import_details ADD COLUMN IF NOT EXISTS sender_phone TEXT`);
  await db.execute(`ALTER TABLE import_details ADD COLUMN IF NOT EXISTS sender_address TEXT`);
  await db.execute(`ALTER TABLE import_details ADD COLUMN IF NOT EXISTS receiver_address TEXT`);
  await db.execute(`ALTER TABLE import_details ADD COLUMN IF NOT EXISTS weight_kg DOUBLE PRECISION`);
  await db.execute(`ALTER TABLE import_details ADD COLUMN IF NOT EXISTS piece_count INTEGER`);
  await db.execute(`ALTER TABLE import_details ADD COLUMN IF NOT EXISTS temp_layer TEXT`);
  await db.execute(`ALTER TABLE import_details ADD COLUMN IF NOT EXISTS remark TEXT`);
}

export async function ensureDb() {
  if (!ready) ready = migrate(getDbClient());
  await ready;
}

