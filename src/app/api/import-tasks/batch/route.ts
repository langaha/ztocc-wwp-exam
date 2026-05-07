import { ensureDb, getDbClient } from "@/lib/db";
import { normalizeTempLayer, normalizePhone, validateDraft } from "@/lib/shipment";
import { NextResponse } from "next/server";

type IncomingDraft = Record<string, unknown>;

function toStringValue(v: unknown): string {
  return String(v ?? "").trim();
}

export async function POST(req: Request) {
  await ensureDb();
  const body = (await req.json().catch(() => null)) as
    | { taskId?: unknown; items?: unknown; excelRowNumbers?: unknown }
    | null;

  const taskId = String(body?.taskId ?? "").trim();
  if (!taskId) return NextResponse.json({ error: "taskId required" }, { status: 400 });

  const itemsRaw = Array.isArray(body?.items) ? body?.items : [];
  const rowNosRaw = Array.isArray(body?.excelRowNumbers) ? body?.excelRowNumbers : [];
  if (itemsRaw.length !== rowNosRaw.length) {
    return NextResponse.json({ error: "items/excelRowNumbers length mismatch" }, { status: 400 });
  }

  const drafts = itemsRaw.slice(0, 1000).map((row) => {
    const r = (row ?? {}) as IncomingDraft;
    return {
      externalCode: toStringValue(r.externalCode),
      senderName: toStringValue(r.senderName),
      senderPhone: normalizePhone(toStringValue(r.senderPhone)),
      senderAddress: toStringValue(r.senderAddress),
      receiverName: toStringValue(r.receiverName),
      receiverPhone: normalizePhone(toStringValue(r.receiverPhone)),
      receiverAddress: toStringValue(r.receiverAddress),
      weightKg: toStringValue(r.weightKg),
      pieceCount: toStringValue(r.pieceCount),
      tempLayer: normalizeTempLayer(toStringValue(r.tempLayer)),
      remark: toStringValue(r.remark),
    };
  });

  const excelRowNumbers = rowNosRaw.slice(0, drafts.length).map((n) => Number(n ?? 0));

  const codes = drafts
    .map((d) => d.externalCode)
    .filter((c) => c)
    .slice(0, 2000);

  let existingSet = new Set<string>();
  if (codes.length > 0) {
    const placeholders = codes.map(() => "?").join(",");
    const db = getDbClient();
    const res = await db.execute({
      sql: `SELECT external_code FROM waybills WHERE external_code IN (${placeholders})`,
      args: codes,
    });
    existingSet = new Set(
      res.rows
        .map((r) => String((r as { external_code?: unknown }).external_code ?? "").trim())
        .filter((c) => c)
    );
  }

  const db = getDbClient();
  const now = new Date().toISOString();
  const results: Array<{ index: number; ok: boolean; error?: string }> = [];
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < drafts.length; i++) {
    const draft = drafts[i]!;
    const rowNo = excelRowNumbers[i] || i + 1;
    const weightVal = Number.isFinite(Number(draft.weightKg)) ? Number(draft.weightKg) : null;
    const pieceVal = Number.isFinite(Number(draft.pieceCount)) ? Number(draft.pieceCount) : null;

    const errs = validateDraft(draft);
    if (Object.keys(errs).length > 0) {
      failCount++;
      results.push({ index: i, ok: false, error: "校验失败" });
      await db.execute({
        sql: `
          INSERT INTO import_details (
            id, task_id, row_no,
            external_code,
            sender_name, sender_phone, sender_address,
            receiver_name, receiver_phone, receiver_address,
            weight_kg, piece_count, temp_layer, remark,
            ok, error, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        args: [
          crypto.randomUUID(),
          taskId,
          rowNo,
          draft.externalCode || null,
          draft.senderName || null,
          draft.senderPhone || null,
          draft.senderAddress || null,
          draft.receiverName || null,
          draft.receiverPhone || null,
          draft.receiverAddress || null,
          weightVal,
          pieceVal,
          draft.tempLayer || null,
          draft.remark || null,
          0,
          "校验失败",
          now,
        ],
      });
      continue;
    }

    if (draft.externalCode && existingSet.has(draft.externalCode)) {
      failCount++;
      results.push({ index: i, ok: false, error: "外部编码已存在" });
      await db.execute({
        sql: `
          INSERT INTO import_details (
            id, task_id, row_no,
            external_code,
            sender_name, sender_phone, sender_address,
            receiver_name, receiver_phone, receiver_address,
            weight_kg, piece_count, temp_layer, remark,
            ok, error, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        args: [
          crypto.randomUUID(),
          taskId,
          rowNo,
          draft.externalCode || null,
          draft.senderName || null,
          draft.senderPhone || null,
          draft.senderAddress || null,
          draft.receiverName || null,
          draft.receiverPhone || null,
          draft.receiverAddress || null,
          weightVal,
          pieceVal,
          draft.tempLayer || null,
          draft.remark || null,
          0,
          "外部编码已存在",
          now,
        ],
      });
      continue;
    }

    const weightKg = Number(draft.weightKg);
    const pieceCount = Number(draft.pieceCount);

    try {
      await db.execute({
        sql: `
          INSERT INTO waybills (
            id, external_code,
            sender_name, sender_phone, sender_address,
            receiver_name, receiver_phone, receiver_address,
            weight_kg, piece_count, temp_layer, remark, created_at
          ) VALUES (
            ?, ?,
            ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?, ?, ?
          )
        `,
        args: [
          crypto.randomUUID(),
          draft.externalCode ? draft.externalCode : null,
          draft.senderName,
          draft.senderPhone,
          draft.senderAddress,
          draft.receiverName,
          draft.receiverPhone,
          draft.receiverAddress,
          weightKg,
          pieceCount,
          draft.tempLayer,
          draft.remark || null,
          now,
        ],
      });
      successCount++;
      results.push({ index: i, ok: true });
      await db.execute({
        sql: `
          INSERT INTO import_details (
            id, task_id, row_no,
            external_code,
            sender_name, sender_phone, sender_address,
            receiver_name, receiver_phone, receiver_address,
            weight_kg, piece_count, temp_layer, remark,
            ok, error, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        args: [
          crypto.randomUUID(),
          taskId,
          rowNo,
          draft.externalCode || null,
          draft.senderName || null,
          draft.senderPhone || null,
          draft.senderAddress || null,
          draft.receiverName || null,
          draft.receiverPhone || null,
          draft.receiverAddress || null,
          weightKg,
          pieceCount,
          draft.tempLayer || null,
          draft.remark || null,
          1,
          null,
          now,
        ],
      });
    } catch (e) {
      failCount++;
      results.push({ index: i, ok: false, error: "写入失败" });
      await db.execute({
        sql: `
          INSERT INTO import_details (
            id, task_id, row_no,
            external_code,
            sender_name, sender_phone, sender_address,
            receiver_name, receiver_phone, receiver_address,
            weight_kg, piece_count, temp_layer, remark,
            ok, error, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        args: [
          crypto.randomUUID(),
          taskId,
          rowNo,
          draft.externalCode || null,
          draft.senderName || null,
          draft.senderPhone || null,
          draft.senderAddress || null,
          draft.receiverName || null,
          draft.receiverPhone || null,
          draft.receiverAddress || null,
          weightVal,
          pieceVal,
          draft.tempLayer || null,
          draft.remark || null,
          0,
          "写入失败",
          now,
        ],
      });
    }
  }

  await db.execute({
    sql: `
      UPDATE import_tasks
      SET success_count = success_count + ?, fail_count = fail_count + ?
      WHERE id = ?
    `,
    args: [successCount, failCount, taskId],
  });

  return NextResponse.json({ successCount, failCount, results });
}
