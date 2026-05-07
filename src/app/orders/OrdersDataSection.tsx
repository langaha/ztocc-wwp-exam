import { ensureDb, getDbClient } from "@/lib/db";
import { datetimeLocalShanghaiToIso } from "@/lib/datetime";
import { OrdersTableClient, type WaybillRow } from "./OrdersTableClient";
import Link from "next/link";
import { PageSizeSelect } from "@/components/PageSizeSelect";

function clampPage(n: number) {
  if (!Number.isFinite(n) || n <= 0) return 1;
  return Math.floor(n);
}

function clampPageSize(n: number) {
  const allowed = [20, 50, 100, 200];
  if (!Number.isFinite(n)) return 20;
  const v = Math.floor(n);
  return allowed.includes(v) ? v : 20;
}

export async function OrdersDataSection(props: {
  keyword: string;
  fromRaw: string;
  toRaw: string;
  page: string;
  pageSize: string;
}) {
  await ensureDb();

  const page = clampPage(Number(props.page));
  const pageSize = clampPageSize(Number(props.pageSize));

  const from = props.fromRaw ? datetimeLocalShanghaiToIso(props.fromRaw) : "";
  const to = props.toRaw ? datetimeLocalShanghaiToIso(props.toRaw) : "";

  const where: string[] = [];
  const args: Array<string | number | null> = [];

  if (props.keyword) {
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
    const like = `%${props.keyword}%`;
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
  if (props.keyword) baseParams.set("q", props.keyword);
  if (props.fromRaw) baseParams.set("from", props.fromRaw);
  if (props.toRaw) baseParams.set("to", props.toRaw);
  baseParams.set("pageSize", String(pageSize));

  const pageLink = (p: number) => {
    const qp = new URLSearchParams(baseParams);
    qp.set("page", String(p));
    return `/orders?${qp.toString()}`;
  };

  return (
    <div className="space-y-4">
      <div className="text-sm text-slate-600">
        共 <span className="font-medium text-slate-900">{total}</span> 条
      </div>

      <OrdersTableClient rows={list} />

      <div className="flex items-center justify-between text-sm">
        <Link
          href={pageLink(Math.max(1, safePage - 1))}
          className="rounded-lg border px-3 py-2 hover:bg-slate-50"
        >
          上一页
        </Link>
        <div className="text-slate-700">
          第 <span className="font-medium">{safePage}</span> /{" "}
          <span className="font-medium">{totalPages}</span> 页
        </div>
        <PageSizeSelect
          paramKey="pageSize"
          resetPageKey="page"
          defaultValue={20}
          options={[20, 50, 100, 200]}
        />
        <Link
          href={pageLink(Math.min(totalPages, safePage + 1))}
          className="rounded-lg border px-3 py-2 hover:bg-slate-50"
        >
          下一页
        </Link>
      </div>
    </div>
  );
}

