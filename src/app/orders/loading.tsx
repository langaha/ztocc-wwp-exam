import { TableSkeleton } from "@/components/TableSkeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-base font-semibold">已导入运单列表</div>
      </div>
      <div className="space-y-4">
        <div className="text-sm text-slate-600">加载中…</div>
        <TableSkeleton columns={13} />
      </div>
    </div>
  );
}
