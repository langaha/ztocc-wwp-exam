"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";

import { DataGrid } from "@/components/DataGrid";
import { ErrorsPanel } from "@/components/ErrorsPanel";
import { ProgressBar } from "@/components/ProgressBar";
import { useSubmitTask } from "@/components/AppShell";
import { clearImportSession, loadImportSession, saveImportSession } from "@/lib/importSession";
import { createEmptyDraft, validateDraft, type ShipmentDraft } from "@/lib/shipment";

export default function PreviewPage() {
  const submitTask = useSubmitTask();
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
    if (submitTask.clearToken === 0) return;
    setItems([]);
    setExcelRowNumbers([]);
    setFieldErrorsByRow([]);
    setSubmitInfoByRow([]);
    setExistingCodes(new Set());
    setExternalCodesVersion((v) => v + 1);
  }, [loaded, submitTask.clearToken]);

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
  const hasBlockingIssues = loaded && items.length > 0 && (hasAnyFieldError || hasDup || hasExisting);
  const canSubmit =
    loaded &&
    items.length > 0 &&
    !hasAnyFieldError &&
    !hasDup &&
    !hasExisting &&
    !submitTask.running;

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

  if (!loaded) return null;

  if (items.length === 0) {
    if (submitTask.summary) {
      return (
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-base font-semibold">提交完成</div>
          <div className="mt-3 rounded-lg border bg-slate-50 px-3 py-2 text-sm text-slate-800">
            {submitTask.summary}{" "}
            <Link href="/imports" className="ml-2 underline">
              查看导入记录
            </Link>
            <Link href="/orders" className="ml-2 underline">
              查看已导入运单
            </Link>
          </div>
          <div className="mt-4 text-sm text-slate-600">
            导入数据已清空，可返回 <Link className="text-slate-900 underline" href="/">导入</Link>{" "}
            页面继续上传 Excel。
          </div>
          <div className="mt-4">
            <button
              type="button"
              className="rounded-md border px-4 py-2 text-sm hover:bg-slate-50"
              onClick={submitTask.clearSummary}
            >
              关闭提示
            </button>
          </div>
        </div>
      );
    }
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
            <div
              className="relative group"
              title={
                submitTask.running
                  ? "提交任务正在进行"
                  : !canSubmit
                    ? "不能提交，请查看右侧错误提示"
                    : ""
              }
            >
              <button
                type="button"
                className={`rounded-md px-4 py-2 text-sm text-white ${
                  canSubmit ? "bg-teal-600 hover:bg-teal-700" : "bg-slate-400"
                }`}
                disabled={!canSubmit}
                onClick={() => {
                  setSubmitInfoByRow(new Array(items.length).fill(null));
                  void submitTask.start(
                    { fileName, fingerprint, items, excelRowNumbers },
                    {
                      onRowFail: (globalIndex, rowNo, error) => {
                        setSubmitInfoByRow((prev) => {
                          const next = prev.slice();
                          next[globalIndex] = `第 ${rowNo} 行，提交失败：${error}`;
                          return next;
                        });
                      },
                    }
                  );
                }}
              >
                提交下单
              </button>
              {!submitTask.running && !canSubmit ? (
                <div className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 w-max -translate-x-1/2 rounded-md border bg-white px-3 py-2 text-xs text-slate-700 shadow-sm opacity-0 transition-opacity group-hover:opacity-100">
                  查看右侧错误提示
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {submitTask.progress.running ? (
          <div className="mt-4">
            <ProgressBar value={submitTask.progress.value} label={submitTask.progress.label} />
          </div>
        ) : null}

        {submitTask.summary ? (
          <div className="mt-4 rounded-lg border bg-slate-50 px-3 py-2 text-sm text-slate-800">
            {submitTask.summary}{" "}
            <Link href="/imports" className="ml-2 underline">
              查看导入记录
            </Link>
            <Link href="/orders" className="ml-2 underline">
              查看已导入运单
            </Link>
          </div>
        ) : null}

        {!submitTask.running && hasBlockingIssues ? (
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

