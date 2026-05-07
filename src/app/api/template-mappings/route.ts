import { ensureDb, getDbClient } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  await ensureDb();
  const { searchParams } = new URL(req.url);
  const fingerprint = searchParams.get("fingerprint") ?? "";
  if (!fingerprint) {
    return NextResponse.json({ error: "fingerprint required" }, { status: 400 });
  }

  const db = getDbClient();
  const res = await db.execute({
    sql: "SELECT mapping_json FROM template_mappings WHERE fingerprint = ?",
    args: [fingerprint],
  });
  const row = res.rows[0] as { mapping_json?: string } | undefined;
  if (!row?.mapping_json) return NextResponse.json({ mapping: null });
  try {
    return NextResponse.json({ mapping: JSON.parse(row.mapping_json) });
  } catch {
    return NextResponse.json({ mapping: null });
  }
}

export async function POST(req: Request) {
  await ensureDb();
  const body = (await req.json().catch(() => null)) as
    | { fingerprint?: string; mapping?: unknown }
    | null;

  const fingerprint = body?.fingerprint ?? "";
  if (!fingerprint) {
    return NextResponse.json({ error: "fingerprint required" }, { status: 400 });
  }

  const mappingJson = JSON.stringify(body?.mapping ?? null);
  const now = new Date().toISOString();

  const db = getDbClient();
  await db.execute({
    sql: `
      INSERT INTO template_mappings (fingerprint, mapping_json, created_at, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(fingerprint) DO UPDATE SET
        mapping_json = excluded.mapping_json,
        updated_at = excluded.updated_at
    `,
    args: [fingerprint, mappingJson, now, now],
  });

  return NextResponse.json({ ok: true });
}

