import { ensureDb, getDbClient } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  await ensureDb();
  const body = (await req.json().catch(() => null)) as
    | { fileName?: unknown; fingerprint?: unknown; totalCount?: unknown }
    | null;

  const fileName = String(body?.fileName ?? "").trim();
  const fingerprint = String(body?.fingerprint ?? "").trim();
  const totalCount = Number(body?.totalCount ?? 0);

  if (!fileName) return NextResponse.json({ error: "fileName required" }, { status: 400 });
  if (!fingerprint)
    return NextResponse.json({ error: "fingerprint required" }, { status: 400 });
  if (!Number.isFinite(totalCount) || totalCount <= 0) {
    return NextResponse.json({ error: "totalCount invalid" }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const db = getDbClient();
  await db.execute({
    sql: `
      INSERT INTO import_tasks (
        id, file_name, fingerprint, total_count,
        success_count, fail_count, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    args: [id, fileName, fingerprint, totalCount, 0, 0, "running", now],
  });

  return NextResponse.json({ taskId: id });
}

