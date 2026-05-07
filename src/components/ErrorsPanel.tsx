"use client";

import type { FieldErrorMap } from "@/lib/shipment";
import { shipmentFieldMeta, type ShipmentField } from "@/lib/shipment";

type Props = {
  excelRowNumbers: number[];
  fieldErrorsByRow: Array<FieldErrorMap>;
  duplicateInfoByRow: Array<string | null>;
  existingInfoByRow: Array<string | null>;
  submitInfoByRow: Array<string | null>;
};

const labelByField: Record<ShipmentField, string> = Object.fromEntries(
  shipmentFieldMeta.map((f) => [f.key, f.label])
) as Record<ShipmentField, string>;

export function ErrorsPanel(props: Props) {
  const items: Array<{ row: number; message: string }> = [];

  for (let i = 0; i < props.fieldErrorsByRow.length; i++) {
    const rowNo = props.excelRowNumbers[i] ?? i + 1;
    const fe = props.fieldErrorsByRow[i] ?? {};
    for (const k of Object.keys(fe) as ShipmentField[]) {
      items.push({ row: rowNo, message: `第 ${rowNo} 行，${labelByField[k]}：${fe[k]}` });
    }

    if (props.duplicateInfoByRow[i]) items.push({ row: rowNo, message: props.duplicateInfoByRow[i]! });
    if (props.existingInfoByRow[i]) items.push({ row: rowNo, message: props.existingInfoByRow[i]! });
    if (props.submitInfoByRow[i]) items.push({ row: rowNo, message: props.submitInfoByRow[i]! });
  }

  const count = items.length;

  return (
    <div className="rounded-xl border bg-white p-5">
      <div className="flex items-center justify-between">
        <div className="text-base font-semibold">错误与提示</div>
        <div className="text-sm text-slate-600">{count} 条</div>
      </div>
      <div className="mt-3 max-h-[520px] overflow-auto pr-1">
        {count === 0 ? (
          <div className="text-sm text-slate-600">当前无错误，可以提交下单。</div>
        ) : (
          <ul className="space-y-2 text-sm text-slate-700">
            {items.map((it, idx) => (
              <li key={idx} className="rounded-lg bg-slate-50 px-3 py-2">
                {it.message}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

