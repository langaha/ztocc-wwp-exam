"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import * as XLSX from "xlsx";

import { saveImportSession } from "@/lib/importSession";
import { requiredFields, type ShipmentDraft } from "@/lib/shipment";
import {
  autoMapFromColumns,
  buildColumnsForMapping,
  computeFingerprint,
  detectHeaderRow,
  type MappingRule,
} from "@/lib/template";

import { MappingEditor } from "@/components/MappingEditor";
import { ProgressBar } from "@/components/ProgressBar";

type Stage = "idle" | "parsing" | "need-mapping" | "finalizing" | "error";

function hasAllRequired(mapping: MappingRule) {
  return requiredFields.every((k) => (mapping[k]?.length ?? 0) > 0);
}

function validateNoConflicts(mapping: MappingRule) {
  const singleFields = requiredFields.filter(
    (f) => f !== "senderAddress" && f !== "receiverAddress"
  );
  const used = new Map<number, string>();
  for (const f of singleFields) {
    const idx = mapping[f]?.[0];
    if (idx === undefined) continue;
    const prev = used.get(idx);
    if (prev) return `列冲突：${prev} 与 ${f} 选择了同一列`;
    used.set(idx, f);
  }
  return "";
}

export function ImportClient() {
  const router = useRouter();

  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string>("");
  const [progress, setProgress] = useState<number>(0);
  const [progressLabel, setProgressLabel] = useState<string>("");

  const [fileName, setFileName] = useState<string>("");
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [dataStartIndex, setDataStartIndex] = useState<number>(0);
  const [fingerprint, setFingerprint] = useState<string>("");
  const [mapping, setMapping] = useState<MappingRule>({});

  const canAutoProceed = useMemo(() => hasAllRequired(mapping), [mapping]);
  const [dragOver, setDragOver] = useState(false);

  async function fetchSavedMapping(fp: string): Promise<MappingRule | null> {
    const res = await fetch(`/api/template-mappings?fingerprint=${encodeURIComponent(fp)}`, {
      method: "GET",
    });
    const json = (await res.json().catch(() => null)) as { mapping?: unknown } | null;
    if (!json || !json.mapping) return null;
    return json.mapping as MappingRule;
  }

  async function saveMapping(fp: string, m: MappingRule) {
    await fetch("/api/template-mappings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fingerprint: fp, mapping: m }),
    });
  }

  async function finalizeImport(args: {
    mapping: MappingRule;
    rows: string[][];
    dataStartIndex: number;
    columns: string[];
    fileName: string;
    fingerprint: string;
  }) {
    setStage("finalizing");
    setError("");
    setProgress(0);
    const total = Math.max(0, args.rows.length - args.dataStartIndex);
    setProgressLabel(`导入中：0%（0/${total}）`);

    const items: ShipmentDraft[] = [];
    const excelRowNumbers: number[] = [];

    const batchSize = 50;
    let processed = 0;

    for (let r = args.dataStartIndex; r < args.rows.length; r++) {
      const row = args.rows[r] ?? [];
      const draft: ShipmentDraft = {
        externalCode: "",
        senderName: "",
        senderPhone: "",
        senderAddress: "",
        receiverName: "",
        receiverPhone: "",
        receiverAddress: "",
        weightKg: "",
        pieceCount: "",
        tempLayer: "",
        remark: "",
      };

      for (const key of Object.keys(draft) as Array<keyof ShipmentDraft>) {
        const cols = args.mapping[key] ?? [];
        if (cols.length === 0) continue;
        const parts = cols
          .map((idx) => String(row[idx] ?? "").trim())
          .filter((v) => v);
        draft[key] = parts.join("");
      }

      const anyNonEmpty = Object.values(draft).some((v) => String(v ?? "").trim());
      if (anyNonEmpty) {
        items.push(draft);
        excelRowNumbers.push(r + 1);
      }

      processed++;
      if (processed % batchSize === 0 || r === args.rows.length - 1) {
        setProgress(total ? processed / total : 1);
        const pct = total ? Math.round((processed / total) * 100) : 100;
        setProgressLabel(`导入中：${pct}%（${processed}/${total}）`);
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    if (items.length === 0) {
      setStage("error");
      setError("未解析到有效数据，请检查 Excel 内容或 Sheet。");
      return;
    }

    saveImportSession({
      fileName: args.fileName,
      fingerprint: args.fingerprint,
      columns: args.columns,
      items,
      excelRowNumbers,
    });

    setProgress(1);
    router.push("/preview");
  }

  async function handleFile(file: File) {
    setStage("parsing");
    setError("");
    setProgress(0);
    setProgressLabel("读取文件…");
    setFileName(file.name);

    try {
      const buf = await file.arrayBuffer();
      setProgress(0.2);
      setProgressLabel("解析 Excel…");

      const wb = XLSX.read(buf, { type: "array" });
      const sheetName = wb.SheetNames[0];
      if (!sheetName) {
        setStage("error");
        setError("文件中未找到任何 Sheet。");
        return;
      }
      const ws = wb.Sheets[sheetName];
      if (!ws) {
        setStage("error");
        setError("Sheet 读取失败。");
        return;
      }

      const raw = XLSX.utils.sheet_to_json(ws, {
        header: 1,
        raw: false,
        defval: "",
      }) as unknown as unknown[][];

      const rows2d = raw.map((r) => (Array.isArray(r) ? r.map((c) => String(c ?? "")) : []));

      if (rows2d.length === 0) {
        setStage("error");
        setError("文件为空或无有效数据。");
        return;
      }

      setProgress(0.5);
      setProgressLabel("识别表头与模板…");

      const header = detectHeaderRow(rows2d);
      const cols = buildColumnsForMapping(header.headerRow);
      const fp = computeFingerprint(cols);
      const startIdx = header.treatAsHeader ? header.headerRowIndex + 1 : header.headerRowIndex;

      setColumns(cols);
      setRows(rows2d);
      setDataStartIndex(startIdx);
      setFingerprint(fp);

      let m = autoMapFromColumns(cols);
      const saved = await fetchSavedMapping(fp);
      if (saved) m = saved;

      setMapping(m);
      setProgress(0.8);

      if (hasAllRequired(m)) {
        await finalizeImport({
          mapping: m,
          rows: rows2d,
          dataStartIndex: startIdx,
          columns: cols,
          fileName: file.name,
          fingerprint: fp,
        });
      } else {
        setStage("need-mapping");
        setProgress(1);
        setProgressLabel("需要手动列映射");
      }
    } catch (e) {
      setStage("error");
      setError("解析失败：文件格式错误、编码异常或内容损坏。");
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-base font-semibold">Excel 导入</div>
            <div className="mt-1 text-xs text-slate-600">
              支持 .xlsx / .xls；自动识别多模板（列名/列序不同、表头行数不同、地址拆分等），必要时可手动映射并记忆。
            </div>
          </div>
          <a
            className="inline-flex items-center justify-center rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800 hover:bg-teal-100"
            href="/api/template/download"
          >
            下载标准导入模板
          </a>
        </div>

        <div className="mt-4">
          <label
            className={`block cursor-pointer rounded-md border-2 border-dashed px-4 py-6 text-center ${
              dragOver
                ? "border-teal-300 bg-teal-50"
                : "border-slate-200 bg-slate-50 hover:bg-slate-100"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f) void handleFile(f);
            }}
          >
            <div className="text-sm font-medium text-slate-800">拖拽 Excel 到此处，或点击选择文件</div>
            <div className="mt-1 text-xs text-slate-600">仅支持 .xlsx / .xls</div>
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
              }}
              disabled={stage === "parsing" || stage === "finalizing"}
            />
          </label>
        </div>

        {stage === "parsing" || stage === "finalizing" ? (
          <div className="mt-4">
            <ProgressBar value={progress} label={progressLabel} />
          </div>
        ) : null}

        {stage === "error" ? (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {fileName ? (
          <div className="mt-4 text-sm text-slate-700">
            当前文件：<span className="font-medium">{fileName}</span>
          </div>
        ) : null}
      </div>

      {stage === "need-mapping" ? (
        <MappingEditor
          columns={columns}
          initialMapping={mapping}
          onSubmit={async (m) => {
            if (!hasAllRequired(m)) {
              setStage("error");
              setError("请先为所有必填字段完成映射。");
              return;
            }
            const conflict = validateNoConflicts(m);
            if (conflict) {
              setStage("error");
              setError(conflict);
              return;
            }
            await saveMapping(fingerprint, m);
            await finalizeImport({
              mapping: m,
              rows,
              dataStartIndex,
              columns,
              fileName,
              fingerprint,
            });
          }}
        />
      ) : null}

      {stage === "need-mapping" && !canAutoProceed ? (
        <div className="text-sm text-slate-600">
          模板指纹：<span className="font-mono">{fingerprint.slice(0, 48)}</span>
        </div>
      ) : null}
    </div>
  );
}

