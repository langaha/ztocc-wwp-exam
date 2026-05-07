import { ensureDb, getDbClient } from "@/lib/db";
import { datetimeLocalShanghaiToIso, getShanghaiTodayRangeDatetimeLocal } from "@/lib/datetime";
import Link from "next/link";
import { OrdersTableClient, type WaybillRow } from "./OrdersTableClient";

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
  await ensureDb();
  const sp = (await props.searchParams) ?? {};

  const keyword = asString(sp.q).trim();

  const hasFrom = typeof sp.from !== "undefined";
  const hasTo = typeof sp.to !== "undefined";
  const defaults = getShanghaiTodayRangeDatetimeLocal();
  const fromRaw = toRangeDisplayValue(hasFrom ? asString(sp.from) : defaults.from);
  const toRaw = toRangeDisplayValue(hasTo ? asString(sp.to) : defaults.to);
  const from = fromRaw ? datetimeLocalShanghaiToIso(fromRaw) : "";
  const to = toRaw ? datetimeLocalShanghaiToIso(toRaw) : "";
  const page = clampPage(Number(asString(sp.page)));
  const pageSize = 20;

  const where: string[] = [];
  const args: unknown[] = [];

  if (keyword) {
    where.push(
      "(" +
        [
          "external_code LIKE ?",
          "sender_name LIKE ?",
          "sender_phone LIKE ?",
          "sender_address LIKE ?",
          "receiver_name LIKE ?",
          "receiver_phone LIKE ?",
          "receiver_address LIKE ?",
          "remark LIKE ?",
        ].join(" OR ") +
        ")"
    );
    const like = `%${keyword}%`;
    args.push(like, like, like, like, like, like, like, like);
  }

  if (from) {
    where.push("created_at >= ?");
    args.push(from);
  }

  if (to) {
    where.push("created_at <= ?");
    args.push(to);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const db = getDbClient();

  const countRes = await db.execute({
    sql: `SELECT COUNT(*) as cnt FROM waybills ${whereSql}`,
    args,
  });
  const total = Number((countRes.rows[0] as { cnt?: unknown } | undefined)?.cnt ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);

  const listRes = await db.execute({
    sql: `
      SELECT
        id, external_code,
        sender_name, sender_phone, sender_address,
        receiver_name, receiver_phone, receiver_address,
        weight_kg, piece_count, temp_layer, remark, created_at
      FROM waybills
      ${whereSql}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `,
    args: [...args, pageSize, (safePage - 1) * pageSize],
  });

  const rows = listRes.rows as Array<Record<string, unknown>>;
  const list: WaybillRow[] = rows.map((r) => ({
    id: String(r.id ?? ""),
    externalCode: String(r.external_code ?? ""),
    senderName: String(r.sender_name ?? ""),
    senderPhone: String(r.sender_phone ?? ""),
    senderAddress: String(r.sender_address ?? ""),
    receiverName: String(r.receiver_name ?? ""),
    receiverPhone: String(r.receiver_phone ?? ""),
    receiverAddress: String(r.receiver_address ?? ""),
    weightKg: String(r.weight_kg ?? ""),
    pieceCount: String(r.piece_count ?? ""),
    tempLayer: String(r.temp_layer ?? ""),
    remark: String(r.remark ?? ""),
    createdAt: String(r.created_at ?? ""),
  }));

  const baseParams = new URLSearchParams();
  if (keyword) baseParams.set("q", keyword);
  if (hasFrom) baseParams.set("from", fromRaw);
  if (hasTo) baseParams.set("to", toRaw);

  const pageLink = (p: number) => {
    const qp = new URLSearchParams(baseParams);
    qp.set("page", String(p));
    return `/orders?${qp.toString()}`;
  };

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
            <div className="mr-auto text-sm text-slate-600">
              共 <span className="font-medium text-slate-900">{total}</span> 条
            </div>
            <button
              type="submit"
              className="rounded-md bg-teal-600 px-4 py-2 text-sm text-white hover:bg-teal-700"
            >
              查询
            </button>
          </div>
        </form>
      </div>

      <OrdersTableClient rows={list} />

      <div className="flex items-center justify-between text-sm">
        <Link href={pageLink(Math.max(1, safePage - 1))} className="rounded-lg border px-3 py-2 hover:bg-slate-50">
          上一页
        </Link>
        <div className="text-slate-700">
          第 <span className="font-medium">{safePage}</span> /{" "}
          <span className="font-medium">{totalPages}</span> 页
        </div>
        <Link href={pageLink(Math.min(totalPages, safePage + 1))} className="rounded-lg border px-3 py-2 hover:bg-slate-50">
          下一页
        </Link>
      </div>
    </div>
  );
}

