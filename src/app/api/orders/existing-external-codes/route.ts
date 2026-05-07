import { ensureDb, getDbClient } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  await ensureDb();
  const body = (await req.json().catch(() => null)) as { codes?: unknown } | null;
  const codesRaw = Array.isArray(body?.codes) ? body?.codes : [];
  const codes = codesRaw
    .map((c) => String(c ?? "").trim())
    .filter((c) => c)
    .slice(0, 2000);

  if (codes.length === 0) return NextResponse.json({ existing: [] });

  const placeholders = codes.map(() => "?").join(",");
  const db = getDbClient();
  const res = await db.execute({
    sql: `SELECT external_code FROM waybills WHERE external_code IN (${placeholders})`,
    args: codes,
  });

  const existing = res.rows
    .map((r) => String((r as { external_code?: unknown }).external_code ?? "").trim())
    .filter((c) => c);

  return NextResponse.json({ existing });
}

