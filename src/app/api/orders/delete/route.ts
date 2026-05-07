import { ensureDb, getDbClient } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  await ensureDb();
  const body = (await req.json().catch(() => null)) as { ids?: unknown } | null;
  const idsRaw = Array.isArray(body?.ids) ? body?.ids : [];
  const ids = idsRaw.map((x) => String(x ?? "").trim()).filter((x) => x).slice(0, 500);
  if (ids.length === 0) return NextResponse.json({ error: "ids required" }, { status: 400 });

  const placeholders = ids.map(() => "?").join(",");
  const db = getDbClient();
  await db.execute({
    sql: `DELETE FROM waybills WHERE id IN (${placeholders})`,
    args: ids,
  });

  return NextResponse.json({ ok: true, deletedCount: ids.length });
}

