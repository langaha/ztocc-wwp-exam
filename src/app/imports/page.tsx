import { getShanghaiLast7DaysRangeDatetimeLocal } from "@/lib/datetime";
import Link from "next/link";
import { Suspense } from "react";
import { ImportsDataSection } from "./ImportsDataSection";
import { TableSkeleton } from "@/components/TableSkeleton";

export const dynamic = "force-dynamic";

function asString(v: string | string[] | undefined): string {
  if (typeof v === "string") return v;
  return "";
}

function clampPage(n: number) {
  if (!Number.isFinite(n) || n <= 0) return 1;
  return Math.floor(n);
}

function toRangeDisplayValue(v: string) {
  const s = v.trim();
  if (!s) return "";
  return s.includes("T") ? s.replace("T", " ") : s;
}

export default async function ImportsPage(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await props.searchParams) ?? {};

  const fileNameFilter = asString(sp.fileName).trim();
  const statusFilter = asString(sp.status).trim();
  const hasFrom = typeof sp.from !== "undefined";
  const hasTo = typeof sp.to !== "undefined";
  const defaults = getShanghaiLast7DaysRangeDatetimeLocal();
  const fromRaw = toRangeDisplayValue(hasFrom ? asString(sp.from) : defaults.from);
  const toRaw = toRangeDisplayValue(hasTo ? asString(sp.to) : defaults.to);

  const taskId = asString(sp.taskId).trim();
  const taskPage = clampPage(Number(asString(sp.page)));
  const detailPage = clampPage(Number(asString(sp.detailPage)));
  const pageSize = asString(sp.pageSize).trim();
  const detailPageSize = asString(sp.detailPageSize).trim();
  const suspenseKey = `imports:${fileNameFilter}:${statusFilter}:${fromRaw}:${toRaw}:${taskId}:${taskPage}:${detailPage}:${pageSize}:${detailPageSize}`;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="text-base font-semibold">导入记录</div>
          <Link
            href="/imports"
            className="rounded-md border px-3 py-2 text-sm hover:bg-slate-50"
          >
            重置
          </Link>
        </div>
        <div className="mt-1 text-xs text-slate-600">
          每次点击“提交下单”都会创建一个导入任务；任务内每一行数据都会写入导入明细。
        </div>

        <form className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-6" method="GET">
          <input
            name="fileName"
            placeholder="文件名"
            defaultValue={fileNameFilter}
            className="rounded-md border px-3 py-2 text-sm"
          />
          <select
            name="status"
            defaultValue={statusFilter}
            className="rounded-md border px-3 py-2 text-sm"
          >
            <option value="">全部状态</option>
            <option value="running">running</option>
            <option value="done">done</option>
          </select>
          <div className="md:col-span-4 flex items-center gap-3">
            <div className="text-sm text-slate-700 whitespace-nowrap">创建时间</div>
            <div className="flex w-full items-center rounded-md border bg-white px-2">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="h-4 w-4 flex-none text-slate-400"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <input
                name="from"
                defaultValue={fromRaw}
                placeholder="YYYY-MM-DD HH:mm:ss"
                className="min-w-[170px] flex-1 bg-transparent px-2 py-2 text-sm outline-none"
              />
              <div className="px-2 text-sm text-slate-500">至</div>
              <input
                name="to"
                defaultValue={toRaw}
                placeholder="YYYY-MM-DD HH:mm:ss"
                className="min-w-[170px] flex-1 bg-transparent px-2 py-2 text-sm outline-none"
              />
            </div>
          </div>
          <input type="hidden" name="page" value="1" />
          <div className="md:col-span-2 flex items-center justify-end gap-2">
            <button
              type="submit"
              className="rounded-md bg-teal-600 px-4 py-2 text-sm text-white hover:bg-teal-700"
            >
              查询
            </button>
          </div>
        </form>
      </div>
      <Suspense
        key={suspenseKey}
        fallback={
          <div className="space-y-6">
            <div className="text-sm text-slate-600">加载中…</div>
            <TableSkeleton columns={8} />
            <TableSkeleton columns={14} />
          </div>
        }
      >
        <ImportsDataSection
          fileNameFilter={fileNameFilter}
          statusFilter={statusFilter}
          fromRaw={fromRaw}
          toRaw={toRaw}
          taskId={taskId}
          page={String(taskPage)}
          detailPage={String(detailPage)}
          pageSize={pageSize}
          detailPageSize={detailPageSize}
        />
      </Suspense>
    </div>
  );
}
