"use client";

import type { MappingRule } from "@/lib/template";
import { shipmentFieldMeta, type ShipmentField } from "@/lib/shipment";
import { useMemo, useState } from "react";

type Props = {
  columns: string[];
  initialMapping: MappingRule;
  onSubmit: (mapping: MappingRule) => void;
};

const multiSelectFields: ShipmentField[] = ["senderAddress", "receiverAddress"];

function isMulti(key: ShipmentField) {
  return multiSelectFields.includes(key);
}

export function MappingEditor(props: Props) {
  const [mapping, setMapping] = useState<MappingRule>(props.initialMapping);
  const [error, setError] = useState<string>("");

  const columns = useMemo(
    () => props.columns.map((c, idx) => ({ idx, label: c || `列${idx + 1}` })),
    [props.columns]
  );

  return (
    <div className="rounded-xl border bg-white p-5">
      <div className="mb-4">
        <div className="text-base font-semibold">手动列映射</div>
        <div className="mt-1 text-sm text-slate-600">
          自动识别未覆盖全部必填字段时，请手动选择 Excel 列与系统字段的对应关系。地址字段支持多列拼接。
        </div>
      </div>

      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {shipmentFieldMeta.map((f) => {
          const selected = mapping[f.key] ?? [];
          if (isMulti(f.key)) {
            return (
              <div key={f.key} className="rounded-lg border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-sm font-medium">
                    {f.label}
                    {f.required ? <span className="ml-1 text-red-600">*</span> : null}
                  </div>
                  <button
                    type="button"
                    className="text-xs text-slate-600 hover:text-slate-900"
                    onClick={() => {
                      setMapping((m) => ({ ...m, [f.key]: [] }));
                    }}
                  >
                    清空
                  </button>
                </div>
                <div className="max-h-40 space-y-2 overflow-auto pr-1">
                  {columns.map((c) => {
                    const checked = selected.includes(c.idx);
                    return (
                      <label
                        key={c.idx}
                        className="flex cursor-pointer items-center gap-2 text-sm text-slate-700"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            setMapping((m) => {
                              const cur = m[f.key] ?? [];
                              if (e.target.checked) return { ...m, [f.key]: [...cur, c.idx] };
                              return { ...m, [f.key]: cur.filter((x) => x !== c.idx) };
                            });
                          }}
                        />
                        <span className="truncate">{c.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          }

          return (
            <div key={f.key} className="rounded-lg border p-3">
              <div className="mb-2 text-sm font-medium">
                {f.label}
                {f.required ? <span className="ml-1 text-red-600">*</span> : null}
              </div>
              <select
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={selected[0] ?? -1}
                onChange={(e) => {
                  const idx = Number(e.target.value);
                  setMapping((m) => ({ ...m, [f.key]: idx >= 0 ? [idx] : [] }));
                }}
              >
                <option value={-1}>未选择</option>
                {columns.map((c) => (
                  <option key={c.idx} value={c.idx}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex items-center justify-end gap-3">
        <button
          type="button"
          className="rounded-lg border px-4 py-2 text-sm hover:bg-slate-50"
          onClick={() => {
            setError("");
            setMapping({});
          }}
        >
          重置
        </button>
        <button
          type="button"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800"
          onClick={() => {
            setError("");
            props.onSubmit(mapping);
          }}
        >
          确认映射并导入
        </button>
      </div>
    </div>
  );
}

