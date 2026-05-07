import { ensureDb, getDbClient } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  await ensureDb();
  const body = (await req.json().catch(() => null)) as { taskId?: unknown } | null;
  const taskId = String(body?.taskId ?? "").trim();
  if (!taskId) return NextResponse.json({ error: "taskId required" }, { status: 400 });

  const now = new Date().toISOString();
  const db = getDbClient();
  await db.execute({
    sql: `UPDATE import_tasks SET status = ?, finished_at = ? WHERE id = ?`,
    args: ["done", now, taskId],
  });

  const res = await db.execute({
    sql: `SELECT total_count, success_count, fail_count FROM import_tasks WHERE id = ?`,
    args: [taskId],
  });
  const row = res.rows[0] as
    | { total_count?: unknown; success_count?: unknown; fail_count?: unknown }
    | undefined;

  return NextResponse.json({
    ok: true,
    taskId,
    totalCount: Number(row?.total_count ?? 0),
    successCount: Number(row?.success_count ?? 0),
    failCount: Number(row?.fail_count ?? 0),
  });
}

