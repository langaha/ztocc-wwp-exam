import { getShanghaiTodayRangeDatetimeLocal } from "@/lib/datetime";
import Link from "next/link";
import { Suspense } from "react";
import { OrdersDataSection } from "./OrdersDataSection";
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

export default async function OrdersPage(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await props.searchParams) ?? {};

  const keyword = asString(sp.q).trim();

  const hasFrom = typeof sp.from !== "undefined";
  const hasTo = typeof sp.to !== "undefined";
  const defaults = getShanghaiTodayRangeDatetimeLocal();
  const fromRaw = toRangeDisplayValue(hasFrom ? asString(sp.from) : defaults.from);
  const toRaw = toRangeDisplayValue(hasTo ? asString(sp.to) : defaults.to);
  const page = clampPage(Number(asString(sp.page)));
  const pageSize = asString(sp.pageSize).trim();
  const suspenseKey = `orders:${keyword}:${fromRaw}:${toRaw}:${page}:${pageSize}`;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="text-base font-semibold">已导入运单列表</div>
          <Link
            href="/orders"
            className="rounded-md border px-3 py-2 text-sm hover:bg-slate-50"
          >
            重置
          </Link>
        </div>
        <form className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-6" method="GET">
          <input
            name="q"
            placeholder="模糊搜索（外部编码/姓名/电话/地址/备注）"
            defaultValue={keyword}
            className="rounded-md border px-3 py-2 text-sm md:col-span-2"
          />
          <div className="md:col-span-4 flex items-center gap-3">
            <div className="text-sm text-slate-700 whitespace-nowrap">寄件时间</div>
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
          <div className="md:col-span-6 flex items-center justify-end gap-2">
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
          <div className="space-y-4">
            <div className="text-sm text-slate-600">加载中…</div>
            <TableSkeleton columns={13} />
          </div>
        }
      >
        <OrdersDataSection
          keyword={keyword}
          fromRaw={fromRaw}
          toRaw={toRaw}
          page={String(page)}
          pageSize={pageSize}
        />
      </Suspense>
    </div>
  );
}

