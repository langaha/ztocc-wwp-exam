import { createClient, type Client } from "@libsql/client";

let client: Client | null = null;
let ready: Promise<void> | null = null;

export function getDbClient(): Client {
  if (client) return client;
  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  client = createClient({ url });
  return client;
}

async function migrate(db: Client) {
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
      weight_kg REAL NOT NULL,
      piece_count INTEGER NOT NULL,
      temp_layer TEXT NOT NULL,
      remark TEXT,
      created_at TEXT NOT NULL
    )
  `);

  await db.execute(`CREATE INDEX IF NOT EXISTS idx_waybills_created_at ON waybills(created_at)`);
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_waybills_receiver_name ON waybills(receiver_name)`
  );
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

  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_import_tasks_created_at ON import_tasks(created_at)`
  );

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
      weight_kg REAL,
      piece_count INTEGER,
      temp_layer TEXT,
      remark TEXT,
      ok INTEGER NOT NULL,
      error TEXT,
      created_at TEXT NOT NULL
    )
  `);

  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_import_details_task_id ON import_details(task_id)`
  );
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_import_details_task_row ON import_details(task_id, row_no)`
  );

  const colsRes = await db.execute(`PRAGMA table_info(import_details)`);
  const existingCols = new Set(
    colsRes.rows.map((r) => String((r as { name?: unknown }).name ?? ""))
  );
  const addCol = async (sql: string) => {
    if (sql.includes("sender_name") && existingCols.has("sender_name")) return;
    if (sql.includes("sender_phone") && existingCols.has("sender_phone")) return;
    if (sql.includes("sender_address") && existingCols.has("sender_address")) return;
    if (sql.includes("receiver_address") && existingCols.has("receiver_address")) return;
    if (sql.includes("weight_kg") && existingCols.has("weight_kg")) return;
    if (sql.includes("piece_count") && existingCols.has("piece_count")) return;
    if (sql.includes("temp_layer") && existingCols.has("temp_layer")) return;
    if (sql.includes("remark") && existingCols.has("remark")) return;
    await db.execute(sql);
  };

  await addCol(`ALTER TABLE import_details ADD COLUMN sender_name TEXT`);
  await addCol(`ALTER TABLE import_details ADD COLUMN sender_phone TEXT`);
  await addCol(`ALTER TABLE import_details ADD COLUMN sender_address TEXT`);
  await addCol(`ALTER TABLE import_details ADD COLUMN receiver_address TEXT`);
  await addCol(`ALTER TABLE import_details ADD COLUMN weight_kg REAL`);
  await addCol(`ALTER TABLE import_details ADD COLUMN piece_count INTEGER`);
  await addCol(`ALTER TABLE import_details ADD COLUMN temp_layer TEXT`);
  await addCol(`ALTER TABLE import_details ADD COLUMN remark TEXT`);
}

export async function ensureDb() {
  if (!ready) {
    ready = migrate(getDbClient());
  }
  await ready;
}

