import { ensureDb, getDbClient } from "@/lib/db";
import { normalizeTempLayer, normalizePhone, validateDraft } from "@/lib/shipment";
import { NextResponse } from "next/server";

type IncomingDraft = Record<string, unknown>;

function toStringValue(v: unknown): string {
  return String(v ?? "").trim();
}

export async function POST(req: Request) {
  await ensureDb();
  const body = (await req.json().catch(() => null)) as { items?: unknown } | null;
  const itemsRaw = Array.isArray(body?.items) ? body?.items : [];

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

  const codes = drafts
    .map((d) => d.externalCode)
    .filter((c) => c)
    .slice(0, 2000);

  const codeToFirstIdx = new Map<string, number>();
  const dupInBatch = new Set<number>();
  for (let i = 0; i < drafts.length; i++) {
    const c = drafts[i]?.externalCode;
    if (!c) continue;
    const prev = codeToFirstIdx.get(c);
    if (prev === undefined) {
      codeToFirstIdx.set(c, i);
    } else {
      dupInBatch.add(i);
      dupInBatch.add(prev);
    }
  }

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
  const results: Array<{ index: number; ok: boolean; error?: string }> = [];
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < drafts.length; i++) {
    const draft = drafts[i]!;

    const errs = validateDraft(draft);
    if (Object.keys(errs).length > 0) {
      failCount++;
      results.push({ index: i, ok: false, error: "校验失败" });
      continue;
    }

    if (draft.externalCode && dupInBatch.has(i)) {
      failCount++;
      results.push({ index: i, ok: false, error: "外部编码在本批次内重复" });
      continue;
    }

    if (draft.externalCode && existingSet.has(draft.externalCode)) {
      failCount++;
      results.push({ index: i, ok: false, error: "外部编码已存在" });
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
          new Date().toISOString(),
        ],
      });
      successCount++;
      results.push({ index: i, ok: true });
    } catch (e) {
      failCount++;
      results.push({ index: i, ok: false, error: "写入失败" });
    }
  }

  return NextResponse.json({ successCount, failCount, results });
}

