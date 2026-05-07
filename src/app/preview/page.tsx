"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";

import { DataGrid } from "@/components/DataGrid";
import { ErrorsPanel } from "@/components/ErrorsPanel";
import { ProgressBar } from "@/components/ProgressBar";
import { clearImportSession, loadImportSession, saveImportSession } from "@/lib/importSession";
import { createEmptyDraft, validateDraft, type ShipmentDraft } from "@/lib/shipment";

export default function PreviewPage() {
  const [loaded, setLoaded] = useState(false);
  const [fileName, setFileName] = useState<string>("");
  const [fingerprint, setFingerprint] = useState<string>("");
  const [columns, setColumns] = useState<string[]>([]);
  const [items, setItems] = useState<ShipmentDraft[]>([]);
  const [excelRowNumbers, setExcelRowNumbers] = useState<number[]>([]);
  const [fieldErrorsByRow, setFieldErrorsByRow] = useState<
    Array<Partial<Record<keyof ShipmentDraft, string>>>
  >([]);
  const [externalCodesVersion, setExternalCodesVersion] = useState(0);

  const [existingCodes, setExistingCodes] = useState<Set<string>>(new Set());
  const [submitInfoByRow, setSubmitInfoByRow] = useState<Array<string | null>>([]);
  const [submitProgress, setSubmitProgress] = useState<{ running: boolean; value: number; label: string }>({
    running: false,
    value: 0,
    label: "",
  });
  const [submitSummary, setSubmitSummary] = useState<string>("");

  useEffect(() => {
    const session = loadImportSession();
    if (session) {
      setFileName(session.fileName);
      setFingerprint(session.fingerprint);
      setColumns(session.columns);
      setItems(session.items);
      setExcelRowNumbers(session.excelRowNumbers);
      setFieldErrorsByRow(session.items.map((d) => validateDraft(d)));
      setSubmitInfoByRow(new Array(session.items.length).fill(null));
      setExternalCodesVersion((v) => v + 1);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => {
      const run = () =>
        saveImportSession({
          fileName,
          fingerprint,
          columns,
          items,
          excelRowNumbers,
        });
      const ric = (globalThis as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number })
        .requestIdleCallback;
      if (ric) ric(run, { timeout: 800 });
      else run();
    }, 600);
    return () => clearTimeout(t);
  }, [loaded, fileName, fingerprint, columns, items, excelRowNumbers]);

  const { duplicateInfoByRow, duplicateRowSet } = useMemo(() => {
    const info = new Array<string | null>(items.length).fill(null);
    const dup = new Set<number>();
    const codeToIdxs = new Map<string, number[]>();
    for (let i = 0; i < items.length; i++) {
      const code = String(items[i]?.externalCode ?? "").trim();
      if (!code) continue;
      const arr = codeToIdxs.get(code) ?? [];
      arr.push(i);
      codeToIdxs.set(code, arr);
    }

    for (const [code, idxs] of codeToIdxs) {
      if (idxs.length <= 1) continue;
      for (const idx of idxs) dup.add(idx);
      const firstIdx = idxs[0]!;
      const rowA = excelRowNumbers[firstIdx] ?? firstIdx + 1;
      const others = idxs.slice(1).map((x) => excelRowNumbers[x] ?? x + 1).join("、");
      info[firstIdx] = `第 ${rowA} 行，外部编码：与第 ${others} 行重复`;
      for (const idx of idxs.slice(1)) {
        const rowNo = excelRowNumbers[idx] ?? idx + 1;
        info[idx] = `第 ${rowNo} 行，外部编码：与第 ${rowA} 行重复`;
      }
      void code;
    }

    return { duplicateInfoByRow: info, duplicateRowSet: dup };
  }, [excelRowNumbers, items]);

  useEffect(() => {
    if (!loaded) return;
    const codes = Array.from(
      new Set(items.map((d) => String(d.externalCode ?? "").trim()).filter((c) => c))
    ).slice(0, 2000);

    const t = setTimeout(() => {
      void (async () => {
        if (codes.length === 0) {
          setExistingCodes(new Set());
          return;
        }
        const res = await fetch("/api/orders/existing-external-codes", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ codes }),
        });
        const json = (await res.json().catch(() => null)) as { existing?: unknown } | null;
        const existing = Array.isArray(json?.existing) ? json!.existing : [];
        setExistingCodes(new Set(existing.map((c) => String(c ?? "").trim()).filter((c) => c)));
      })();
    }, 300);

    return () => clearTimeout(t);
  }, [loaded, externalCodesVersion, items]);

  const { existingInfoByRow, existingRowSet } = useMemo(() => {
    const info = new Array<string | null>(items.length).fill(null);
    const set = new Set<number>();
    for (let i = 0; i < items.length; i++) {
      const code = String(items[i]?.externalCode ?? "").trim();
      if (!code) continue;
      if (existingCodes.has(code)) {
        const rowNo = excelRowNumbers[i] ?? i + 1;
        info[i] = `第 ${rowNo} 行，外部编码：已存在于历史数据`;
        set.add(i);
      }
    }
    return { existingInfoByRow: info, existingRowSet: set };
  }, [items, existingCodes, excelRowNumbers]);

  const submitFailedRowSet = useMemo(() => {
    const set = new Set<number>();
    for (let i = 0; i < submitInfoByRow.length; i++) {
      if (submitInfoByRow[i]) set.add(i);
    }
    return set;
  }, [submitInfoByRow]);

  const hasAnyFieldError = useMemo(
    () => fieldErrorsByRow.some((m) => Object.keys(m).length > 0),
    [fieldErrorsByRow]
  );

  const hasDup = duplicateRowSet.size > 0;
  const hasExisting = existingRowSet.size > 0;
  const canSubmit = loaded && items.length > 0 && !hasAnyFieldError && !hasDup && !hasExisting;

  function exportExcel() {
    const rows = items.map((d) => ({
      外部编码: d.externalCode,
      发件人姓名: d.senderName,
      发件人电话: d.senderPhone,
      发件人地址: d.senderAddress,
      收件人姓名: d.receiverName,
      收件人电话: d.receiverPhone,
      收件人地址: d.receiverAddress,
      "重量(kg)": d.weightKg,
      件数: d.pieceCount,
      温层: d.tempLayer,
      备注: d.remark,
    }));
    const ws = XLSX.utils.json_to_sheet(rows, { skipHeader: false });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "preview");
    XLSX.writeFile(wb, "preview_export.xlsx");
  }

  async function submit() {
    setSubmitSummary("");
    setSubmitInfoByRow(new Array(items.length).fill(null));
    setSubmitProgress({ running: true, value: 0, label: "创建导入任务…" });

    const chunkSize = 100;
    let ok = 0;
    let fail = 0;

    const startRes = await fetch("/api/import-tasks/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fileName, fingerprint, totalCount: items.length }),
    });
    const startJson = (await startRes.json().catch(() => null)) as { taskId?: unknown } | null;
    const taskId = String(startJson?.taskId ?? "").trim();
    if (!taskId) {
      setSubmitProgress({ running: false, value: 0, label: "" });
      setSubmitSummary("创建导入任务失败");
      return;
    }

    for (let start = 0; start < items.length; start += chunkSize) {
      const end = Math.min(items.length, start + chunkSize);
      const chunk = items.slice(start, end);
      const rowNos = excelRowNumbers.slice(start, end);

      setSubmitProgress({
        running: true,
        value: start / items.length,
        label: `提交中：${Math.round((start / items.length) * 100)}%（${start}/${items.length}）`,
      });

      const res = await fetch("/api/import-tasks/batch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ taskId, items: chunk, excelRowNumbers: rowNos }),
      });
      const json = (await res.json().catch(() => null)) as
        | { successCount?: number; failCount?: number; results?: Array<{ index: number; ok: boolean; error?: string }> }
        | null;

      ok += Number(json?.successCount ?? 0);
      fail += Number(json?.failCount ?? 0);

      const results = Array.isArray(json?.results) ? json!.results : [];
      if (results.length > 0) {
        setSubmitInfoByRow((prev) => {
          const next = prev.slice();
          for (const r of results) {
            if (r.ok) continue;
            const globalIdx = start + Number(r.index ?? 0);
            const rowNo = excelRowNumbers[globalIdx] ?? globalIdx + 1;
            next[globalIdx] = `第 ${rowNo} 行，提交失败：${r.error ?? "未知原因"}`;
          }
          return next;
        });
      }
    }

    setSubmitProgress({ running: true, value: 1, label: "完成任务…" });
    const finishRes = await fetch("/api/import-tasks/finish", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ taskId }),
    });
    const finishJson = (await finishRes.json().catch(() => null)) as
      | { successCount?: unknown; failCount?: unknown; taskId?: unknown }
      | null;

    const ok2 = Number(finishJson?.successCount ?? ok);
    const fail2 = Number(finishJson?.failCount ?? fail);
    setSubmitProgress({ running: false, value: 1, label: "" });
    setSubmitSummary(`提交结果：成功 ${ok2} 条，失败 ${fail2} 条（任务：${taskId.slice(0, 8)}）`);
  }

  if (!loaded) return null;

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="text-base font-semibold">暂无导入数据</div>
        <div className="mt-2 text-sm text-slate-600">
          请先在 <Link className="text-slate-900 underline" href="/">导入</Link> 页面上传 Excel。
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-base font-semibold">导入信息</div>
            <div className="mt-1 text-sm text-slate-600">
              文件：<span className="font-medium text-slate-900">{fileName}</span>，共{" "}
              <span className="font-medium text-slate-900">{items.length}</span> 行
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="rounded-md border px-4 py-2 text-sm hover:bg-slate-50"
              onClick={exportExcel}
            >
              导出 Excel
            </button>
            <button
              type="button"
              className="rounded-md border px-4 py-2 text-sm hover:bg-slate-50"
              onClick={() => {
                clearImportSession();
                setItems([]);
                setExcelRowNumbers([]);
              }}
            >
              清空导入
            </button>
            <button
              type="button"
              className={`rounded-md px-4 py-2 text-sm text-white ${
                canSubmit && !submitProgress.running
                  ? "bg-teal-600 hover:bg-teal-700"
                  : "bg-slate-400"
              }`}
              disabled={!canSubmit || submitProgress.running}
              onClick={() => void submit()}
            >
              提交下单
            </button>
          </div>
        </div>

        {submitProgress.running ? (
          <div className="mt-4">
            <ProgressBar value={submitProgress.value} label={submitProgress.label} />
          </div>
        ) : null}

        {submitSummary ? (
          <div className="mt-4 rounded-lg border bg-slate-50 px-3 py-2 text-sm text-slate-800">
            {submitSummary}{" "}
            <Link href="/imports" className="ml-2 underline">
              查看导入记录
            </Link>
            <Link href="/orders" className="ml-2 underline">
              查看已导入运单
            </Link>
          </div>
        ) : null}

        {!canSubmit ? (
          <div className="mt-3 text-sm text-slate-600">
            有错误/重复/已存在的数据时不允许提交；请先修正或删除对应行。
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        <DataGrid
          items={items}
          excelRowNumbers={excelRowNumbers}
          fieldErrorsByRow={fieldErrorsByRow}
          duplicateRowSet={duplicateRowSet}
          existingRowSet={existingRowSet}
          submitFailedRowSet={submitFailedRowSet}
          onChange={(rowIndex, field, value) => {
            setItems((prev) => {
              const next = prev.slice();
              const updated = { ...next[rowIndex], [field]: value };
              next[rowIndex] = updated;
              setFieldErrorsByRow((prevErr) => {
                const eNext = prevErr.slice();
                eNext[rowIndex] = validateDraft(updated);
                return eNext;
              });
              if (field === "externalCode") setExternalCodesVersion((v) => v + 1);
              return next;
            });
          }}
          onDeleteRow={(rowIndex) => {
            setItems((prev) => prev.filter((_, idx) => idx !== rowIndex));
            setExcelRowNumbers((prev) => prev.filter((_, idx) => idx !== rowIndex));
            setFieldErrorsByRow((prev) => prev.filter((_, idx) => idx !== rowIndex));
            setSubmitInfoByRow((prev) => prev.filter((_, idx) => idx !== rowIndex));
            setExternalCodesVersion((v) => v + 1);
          }}
          onAddRow={() => {
            setItems((prev) => [...prev, createEmptyDraft()]);
            setExcelRowNumbers((prev) => [...prev, (prev[prev.length - 1] ?? prev.length) + 1]);
            setFieldErrorsByRow((prev) => [...prev, validateDraft(createEmptyDraft())]);
            setSubmitInfoByRow((prev) => [...prev, null]);
            setExternalCodesVersion((v) => v + 1);
          }}
        />

        <ErrorsPanel
          excelRowNumbers={excelRowNumbers}
          fieldErrorsByRow={fieldErrorsByRow}
          duplicateInfoByRow={duplicateInfoByRow}
          existingInfoByRow={existingInfoByRow}
          submitInfoByRow={submitInfoByRow}
        />
      </div>

      <div className="text-xs text-slate-500">
        模板指纹：<span className="font-mono">{fingerprint.slice(0, 80)}</span>
      </div>
    </div>
  );
}

