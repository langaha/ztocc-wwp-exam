"use client";

import { shipmentFieldMeta, type ShipmentDraft, type ShipmentField } from "@/lib/shipment";

type Props = {
  items: ShipmentDraft[];
  excelRowNumbers: number[];
  fieldErrorsByRow: Array<Partial<Record<ShipmentField, string>>>;
  duplicateRowSet: Set<number>;
  existingRowSet: Set<number>;
  submitFailedRowSet: Set<number>;
  onChange: (rowIndex: number, field: ShipmentField, value: string) => void;
  onDeleteRow: (rowIndex: number) => void;
  onAddRow: () => void;
};

export function DataGrid(props: Props) {
  const fields = shipmentFieldMeta.map((f) => f.key);

  function focusCell(r: number, c: number) {
    const el = document.querySelector<HTMLInputElement>(
      `input[data-r="${r}"][data-c="${c}"]`
    );
    el?.focus();
    el?.select?.();
  }

  function handleKeyDown(
    e: React.KeyboardEvent<HTMLInputElement>,
    rowIndex: number,
    colIndex: number
  ) {
    if (e.key !== "Enter" && e.key !== "Tab") return;
    e.preventDefault();

    const cols = fields.length;
    let nextR = rowIndex;
    let nextC = colIndex;

    if (e.key === "Enter") {
      nextR = rowIndex + 1;
      nextC = colIndex;
    } else {
      if (e.shiftKey) {
        nextC = colIndex - 1;
        if (nextC < 0) {
          nextC = cols - 1;
          nextR = rowIndex - 1;
        }
      } else {
        nextC = colIndex + 1;
        if (nextC >= cols) {
          nextC = 0;
          nextR = rowIndex + 1;
        }
      }
    }

    nextR = Math.max(0, Math.min(props.items.length - 1, nextR));
    nextC = Math.max(0, Math.min(cols - 1, nextC));
    focusCell(nextR, nextC);
  }

  return (
    <div className="rounded-xl border bg-white">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="text-base font-semibold">数据预览与编辑</div>
        <button
          type="button"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800"
          onClick={props.onAddRow}
        >
          新增空行
        </button>
      </div>

      <div className="overflow-auto">
        <table className="min-w-[1200px] w-full table-fixed text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50">
            <tr>
              <th className="w-16 border-b px-2 py-2 text-left font-medium text-slate-700">
                行号
              </th>
              {shipmentFieldMeta.map((f) => (
                <th
                  key={f.key}
                  className="border-b px-2 py-2 text-left font-medium text-slate-700"
                >
                  {f.label}
                  {f.required ? <span className="ml-1 text-red-600">*</span> : null}
                </th>
              ))}
              <th className="w-20 border-b px-2 py-2 text-left font-medium text-slate-700">
                操作
              </th>
            </tr>
          </thead>
          <tbody>
            {props.items.map((row, rIdx) => {
              const rowNo = props.excelRowNumbers[rIdx] ?? rIdx + 1;
              const isDup = props.duplicateRowSet.has(rIdx);
              const isExisting = props.existingRowSet.has(rIdx);
              const isSubmitFailed = props.submitFailedRowSet.has(rIdx);
              const rowWarn = isDup || isExisting || isSubmitFailed;

              return (
                <tr key={rIdx} className={rowWarn ? "bg-amber-50/40" : ""}>
                  <td className="border-b px-2 py-2 align-top text-slate-600">{rowNo}</td>
                  {fields.map((field, cIdx) => {
                    const msg = props.fieldErrorsByRow[rIdx]?.[field];
                    const hasErr = Boolean(msg);
                    const base =
                      "w-full rounded-md border px-2 py-1 outline-none focus:ring-2 focus:ring-slate-300";
                    const errCls = hasErr ? "border-red-300 bg-red-50" : "border-slate-200";
                    return (
                      <td key={field} className="border-b px-2 py-2 align-top">
                        <input
                          className={`${base} ${errCls}`}
                          value={row[field] ?? ""}
                          title={msg ?? ""}
                          data-r={rIdx}
                          data-c={cIdx}
                          onChange={(e) => props.onChange(rIdx, field, e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, rIdx, cIdx)}
                        />
                        {hasErr ? (
                          <div className="mt-1 text-xs text-red-700">{msg}</div>
                        ) : null}
                      </td>
                    );
                  })}
                  <td className="border-b px-2 py-2 align-top">
                    <button
                      type="button"
                      className="rounded-md border px-3 py-1 text-xs hover:bg-slate-50"
                      onClick={() => props.onDeleteRow(rIdx)}
                    >
                      删除
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

