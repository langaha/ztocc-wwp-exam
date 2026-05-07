import { ensureDb, getDbClient } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  await ensureDb();
  const body = (await req.json().catch(() => null)) as { taskId?: unknown } | null;
  const taskId = String(body?.taskId ?? "").trim();
  if (!taskId) return NextResponse.json({ error: "taskId required" }, { status: 400 });

  const db = getDbClient();
  await db.execute({ sql: "DELETE FROM import_details WHERE task_id = ?", args: [taskId] });
  await db.execute({ sql: "DELETE FROM import_tasks WHERE id = ?", args: [taskId] });

  return NextResponse.json({ ok: true });
}

