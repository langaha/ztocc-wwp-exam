"use client";

import { formatDateTimeYmdHms } from "@/lib/datetime";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export type WaybillRow = {
  id: string;
  externalCode: string;
  senderName: string;
  senderPhone: string;
  senderAddress: string;
  receiverName: string;
  receiverPhone: string;
  receiverAddress: string;
  weightKg: string;
  pieceCount: string;
  tempLayer: string;
  remark: string;
  createdAt: string;
};

export function OrdersTableClient(props: { rows: WaybillRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [deleting, setDeleting] = useState(false);

  const ids = useMemo(() => props.rows.map((r) => r.id), [props.rows]);

  useEffect(() => {
    setSelected((prev) => {
      const next = new Set<string>();
      for (const id of prev) if (ids.includes(id)) next.add(id);
      return next;
    });
  }, [ids]);

  const allChecked = ids.length > 0 && ids.every((id) => selected.has(id));
  const anyChecked = selected.size > 0;

  const toggleAll = (checked: boolean) => {
    if (!checked) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(ids));
  };

  const toggleOne = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const onDelete = async () => {
    if (deleting) return;
    const idsToDelete = Array.from(selected);
    if (idsToDelete.length === 0) return;

    setDeleting(true);
    try {
      const res = await fetch("/api/orders/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids: idsToDelete }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: unknown } | null;
        throw new Error(String(j?.error ?? "删除失败"));
      }
      setSelected(new Set());
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "删除失败");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div className="text-sm text-slate-700">
          已选 <span className="font-medium text-slate-900">{selected.size}</span> 条
        </div>
        <button
          type="button"
          disabled={!anyChecked || deleting}
          onClick={onDelete}
          className="rounded-md bg-rose-600 px-4 py-2 text-sm text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {deleting ? "删除中..." : "删除选中"}
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-max text-sm">
          <thead className="sticky top-0 bg-slate-50">
            <tr>
              <th className="border-b px-3 py-2 text-left font-medium text-slate-700">
                <input
                  aria-label="全选"
                  type="checkbox"
                  checked={allChecked}
                  onChange={(e) => toggleAll(e.target.checked)}
                />
              </th>
              <th className="border-b px-3 py-2 text-left font-medium text-slate-700">提交时间</th>
              <th className="border-b px-3 py-2 text-left font-medium text-slate-700">外部编码</th>
              <th className="border-b px-3 py-2 text-left font-medium text-slate-700">发件人姓名</th>
              <th className="border-b px-3 py-2 text-left font-medium text-slate-700">发件人电话</th>
              <th className="border-b px-3 py-2 text-left font-medium text-slate-700">发件人地址</th>
              <th className="border-b px-3 py-2 text-left font-medium text-slate-700">收件人姓名</th>
              <th className="border-b px-3 py-2 text-left font-medium text-slate-700">收件人电话</th>
              <th className="border-b px-3 py-2 text-left font-medium text-slate-700">收件人地址</th>
              <th className="border-b px-3 py-2 text-left font-medium text-slate-700">重量(kg)</th>
              <th className="border-b px-3 py-2 text-left font-medium text-slate-700">件数</th>
              <th className="border-b px-3 py-2 text-left font-medium text-slate-700">温层</th>
              <th className="border-b px-3 py-2 text-left font-medium text-slate-700">备注</th>
            </tr>
          </thead>
          <tbody>
            {props.rows.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-center text-slate-600" colSpan={13}>
                  暂无数据
                </td>
              </tr>
            ) : (
              props.rows.map((r) => {
                const checked = selected.has(r.id);
                return (
                  <tr key={r.id} className={checked ? "bg-teal-50" : undefined}>
                    <td className="border-b px-3 py-2 text-slate-700 whitespace-nowrap">
                      <input
                        aria-label="选择"
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => toggleOne(r.id, e.target.checked)}
                      />
                    </td>
                    <td className="border-b px-3 py-2 text-slate-700 whitespace-nowrap">
                      {formatDateTimeYmdHms(r.createdAt)}
                    </td>
                    <td className="border-b px-3 py-2 text-slate-700 whitespace-nowrap">{r.externalCode}</td>
                    <td className="border-b px-3 py-2 text-slate-700 whitespace-nowrap">{r.senderName}</td>
                    <td className="border-b px-3 py-2 text-slate-700 whitespace-nowrap">{r.senderPhone}</td>
                    <td className="border-b px-3 py-2 text-slate-700 whitespace-nowrap">{r.senderAddress}</td>
                    <td className="border-b px-3 py-2 text-slate-700 whitespace-nowrap">{r.receiverName}</td>
                    <td className="border-b px-3 py-2 text-slate-700 whitespace-nowrap">{r.receiverPhone}</td>
                    <td className="border-b px-3 py-2 text-slate-700 whitespace-nowrap">{r.receiverAddress}</td>
                    <td className="border-b px-3 py-2 text-slate-700 whitespace-nowrap">{r.weightKg}</td>
                    <td className="border-b px-3 py-2 text-slate-700 whitespace-nowrap">{r.pieceCount}</td>
                    <td className="border-b px-3 py-2 text-slate-700 whitespace-nowrap">{r.tempLayer}</td>
                    <td className="border-b px-3 py-2 text-slate-700 whitespace-nowrap">{r.remark}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

