import { ensureDb, getDbClient } from "@/lib/db";
import { datetimeLocalShanghaiToIso, formatDateTimeYmdHms } from "@/lib/datetime";
import Link from "next/link";

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
  await ensureDb();
  const sp = (await props.searchParams) ?? {};

  const fileNameFilter = asString(sp.fileName).trim();
  const statusFilter = asString(sp.status).trim();
  const fromRaw = toRangeDisplayValue(asString(sp.from));
  const toRaw = toRangeDisplayValue(asString(sp.to));
  const fromIso = fromRaw ? datetimeLocalShanghaiToIso(fromRaw) : "";
  const toIso = toRaw ? datetimeLocalShanghaiToIso(toRaw) : "";

  const taskId = asString(sp.taskId).trim();
  const taskPage = clampPage(Number(asString(sp.page)));
  const detailPage = clampPage(Number(asString(sp.detailPage)));
  const pageSize = 10;
  const detailPageSize = 20;

  const db = getDbClient();

  const where: string[] = [];
  const whereArgs: unknown[] = [];
  if (fileNameFilter) {
    where.push("file_name LIKE ?");
    whereArgs.push(`%${fileNameFilter}%`);
  }
  if (statusFilter) {
    where.push("status = ?");
    whereArgs.push(statusFilter);
  }
  if (fromIso) {
    where.push("created_at >= ?");
    whereArgs.push(fromIso);
  }
  if (toIso) {
    where.push("created_at <= ?");
    whereArgs.push(toIso);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const countRes = await db.execute({
    sql: `SELECT COUNT(*) as cnt FROM import_tasks ${whereSql}`,
    args: whereArgs,
  });
  const total = Number((countRes.rows[0] as { cnt?: unknown } | undefined)?.cnt ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(taskPage, totalPages);

  const taskRes = await db.execute({
    sql: `
      SELECT id, file_name, fingerprint, total_count, success_count, fail_count, status, created_at, finished_at
      FROM import_tasks
      ${whereSql}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `,
    args: [...whereArgs, pageSize, (safePage - 1) * pageSize],
  });
  const tasks = taskRes.rows as Array<Record<string, unknown>>;

  const selectedTaskId = taskId || (tasks[0]?.id ? String(tasks[0].id) : "");

  let detailRows: Array<Record<string, unknown>> = [];
  let detailTotal = 0;
  let detailTotalPages = 1;
  let safeDetailPage = 1;

  if (selectedTaskId) {
    const detailCountRes = await db.execute({
      sql: `SELECT COUNT(*) as cnt FROM import_details WHERE task_id = ?`,
      args: [selectedTaskId],
    });
    detailTotal = Number(
      (detailCountRes.rows[0] as { cnt?: unknown } | undefined)?.cnt ?? 0
    );
    detailTotalPages = Math.max(1, Math.ceil(detailTotal / detailPageSize));
    safeDetailPage = Math.min(detailPage, detailTotalPages);

    const detailRes = await db.execute({
      sql: `
        SELECT
          id, task_id, row_no,
          external_code,
          sender_name, sender_phone, sender_address,
          receiver_name, receiver_phone, receiver_address,
          weight_kg, piece_count, temp_layer, remark,
          ok, error, created_at
        FROM import_details
        WHERE task_id = ?
        ORDER BY row_no ASC
        LIMIT ? OFFSET ?
      `,
      args: [selectedTaskId, detailPageSize, (safeDetailPage - 1) * detailPageSize],
    });
    detailRows = detailRes.rows as Array<Record<string, unknown>>;
  }

  const taskBaseParams = new URLSearchParams();
  taskBaseParams.set("page", String(safePage));
  if (fileNameFilter) taskBaseParams.set("fileName", fileNameFilter);
  if (statusFilter) taskBaseParams.set("status", statusFilter);
  if (fromRaw) taskBaseParams.set("from", fromRaw);
  if (toRaw) taskBaseParams.set("to", toRaw);
  if (selectedTaskId) taskBaseParams.set("taskId", selectedTaskId);
  taskBaseParams.set("detailPage", String(safeDetailPage));

  const taskPageLink = (p: number) => {
    const qp = new URLSearchParams(taskBaseParams);
    qp.set("page", String(p));
    return `/imports?${qp.toString()}`;
  };

  const detailPageLink = (p: number) => {
    const qp = new URLSearchParams(taskBaseParams);
    qp.set("detailPage", String(p));
    return `/imports?${qp.toString()}`;
  };

  const selectTaskLink = (id: string) => {
    const qp = new URLSearchParams(taskBaseParams);
    qp.set("taskId", id);
    qp.set("detailPage", "1");
    return `/imports?${qp.toString()}`;
  };

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

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="text-base font-semibold">导入任务</div>
          <div className="text-sm text-slate-600">
            共 <span className="font-medium text-slate-900">{total}</span> 条
          </div>
        </div>
        <div className="overflow-auto">
          <table className="min-w-[1100px] w-full text-sm">
            <thead className="sticky top-0 bg-slate-50">
              <tr>
                <th className="border-b px-3 py-2 text-left font-medium text-slate-700">创建时间</th>
                <th className="border-b px-3 py-2 text-left font-medium text-slate-700">文件名</th>
                <th className="border-b px-3 py-2 text-left font-medium text-slate-700">总行数</th>
                <th className="border-b px-3 py-2 text-left font-medium text-slate-700">成功</th>
                <th className="border-b px-3 py-2 text-left font-medium text-slate-700">失败</th>
                <th className="border-b px-3 py-2 text-left font-medium text-slate-700">状态</th>
                <th className="border-b px-3 py-2 text-left font-medium text-slate-700">任务ID</th>
              </tr>
            </thead>
            <tbody>
              {tasks.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-center text-slate-600" colSpan={7}>
                    暂无导入任务
                  </td>
                </tr>
              ) : (
                tasks.map((t) => {
                  const id = String(t.id ?? "");
                  const active = selectedTaskId && id === selectedTaskId;
                  const rowClass = active
                    ? "bg-blue-50"
                    : "hover:bg-slate-50 even:bg-slate-50/40";
                  const href = selectTaskLink(id);
                  return (
                    <tr key={id} className={`cursor-pointer ${rowClass}`}>
                      <td className="border-b">
                        <Link href={href} className="block px-3 py-2 text-slate-700">
                          {formatDateTimeYmdHms(t.created_at)}
                        </Link>
                      </td>
                      <td className="border-b">
                        <Link href={href} className="block px-3 py-2 text-slate-700">
                          {String(t.file_name ?? "")}
                        </Link>
                      </td>
                      <td className="border-b">
                        <Link href={href} className="block px-3 py-2 text-slate-700">
                          {String(t.total_count ?? "")}
                        </Link>
                      </td>
                      <td className="border-b">
                        <Link href={href} className="block px-3 py-2 text-slate-700">
                          {String(t.success_count ?? "")}
                        </Link>
                      </td>
                      <td className="border-b">
                        <Link href={href} className="block px-3 py-2 text-slate-700">
                          {String(t.fail_count ?? "")}
                        </Link>
                      </td>
                      <td className="border-b">
                        <Link href={href} className="block px-3 py-2 text-slate-700">
                          {(() => {
                            const s = String(t.status ?? "");
                            const cls =
                              s === "done"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : s === "running"
                                  ? "bg-amber-50 text-amber-700 border-amber-200"
                                  : "bg-slate-50 text-slate-700 border-slate-200";
                            return (
                              <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${cls}`}>
                                {s || "-"}
                              </span>
                            );
                          })()}
                        </Link>
                      </td>
                      <td className="border-b">
                        <Link href={href} className="block px-3 py-2 font-mono text-xs text-slate-700">
                          {id}
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 text-sm">
          <Link
            href={taskPageLink(Math.max(1, safePage - 1))}
            className="rounded-lg border px-3 py-2 hover:bg-slate-50"
          >
            上一页
          </Link>
          <div className="text-slate-700">
            第 <span className="font-medium">{safePage}</span> /{" "}
            <span className="font-medium">{totalPages}</span> 页
          </div>
          <Link
            href={taskPageLink(Math.min(totalPages, safePage + 1))}
            className="rounded-lg border px-3 py-2 hover:bg-slate-50"
          >
            下一页
          </Link>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="text-base font-semibold">导入明细</div>
          <div className="text-sm text-slate-600">
            任务：<span className="font-mono text-xs">{selectedTaskId || "-"}</span>，共{" "}
            <span className="font-medium text-slate-900">{detailTotal}</span> 条
          </div>
        </div>
        <div className="overflow-auto">
          <table className="w-max text-sm">
            <thead className="sticky top-0 bg-slate-50">
              <tr>
                <th className="border-b px-3 py-2 text-left font-medium text-slate-700">行号</th>
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
                <th className="border-b px-3 py-2 text-left font-medium text-slate-700">结果</th>
                <th className="border-b px-3 py-2 text-left font-medium text-slate-700">错误原因</th>
              </tr>
            </thead>
            <tbody>
              {selectedTaskId && detailRows.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-center text-slate-600" colSpan={14}>
                    暂无明细
                  </td>
                </tr>
              ) : (
                detailRows.map((d) => {
                  const ok = Number(d.ok ?? 0) === 1;
                  return (
                    <tr key={String(d.id ?? "")} className={ok ? "" : "bg-red-50/40"}>
                      <td className="border-b px-3 py-2 text-slate-700 whitespace-nowrap">
                        {String(d.row_no ?? "")}
                      </td>
                      <td className="border-b px-3 py-2 text-slate-700 whitespace-nowrap">
                        {String(d.external_code ?? "")}
                      </td>
                      <td className="border-b px-3 py-2 text-slate-700 whitespace-nowrap">
                        {String(d.sender_name ?? "")}
                      </td>
                      <td className="border-b px-3 py-2 text-slate-700 whitespace-nowrap">
                        {String(d.sender_phone ?? "")}
                      </td>
                      <td className="border-b px-3 py-2 text-slate-700 whitespace-nowrap">
                        {String(d.sender_address ?? "")}
                      </td>
                      <td className="border-b px-3 py-2 text-slate-700 whitespace-nowrap">
                        {String(d.receiver_name ?? "")}
                      </td>
                      <td className="border-b px-3 py-2 text-slate-700 whitespace-nowrap">
                        {String(d.receiver_phone ?? "")}
                      </td>
                      <td className="border-b px-3 py-2 text-slate-700 whitespace-nowrap">
                        {String(d.receiver_address ?? "")}
                      </td>
                      <td className="border-b px-3 py-2 text-slate-700 whitespace-nowrap">
                        {String(d.weight_kg ?? "")}
                      </td>
                      <td className="border-b px-3 py-2 text-slate-700 whitespace-nowrap">
                        {String(d.piece_count ?? "")}
                      </td>
                      <td className="border-b px-3 py-2 text-slate-700 whitespace-nowrap">
                        {String(d.temp_layer ?? "")}
                      </td>
                      <td className="border-b px-3 py-2 text-slate-700 whitespace-nowrap">
                        {String(d.remark ?? "")}
                      </td>
                      <td className="border-b px-3 py-2 text-slate-700 whitespace-nowrap">
                        {ok ? "成功" : "失败"}
                      </td>
                      <td className="border-b px-3 py-2 text-slate-700 whitespace-nowrap">
                        {String(d.error ?? "")}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 text-sm">
          <Link
            href={detailPageLink(Math.max(1, safeDetailPage - 1))}
            className="rounded-lg border px-3 py-2 hover:bg-slate-50"
          >
            上一页
          </Link>
          <div className="text-slate-700">
            第 <span className="font-medium">{safeDetailPage}</span> /{" "}
            <span className="font-medium">{detailTotalPages}</span> 页
          </div>
          <Link
            href={detailPageLink(Math.min(detailTotalPages, safeDetailPage + 1))}
            className="rounded-lg border px-3 py-2 hover:bg-slate-50"
          >
            下一页
          </Link>
        </div>
      </div>
    </div>
  );
}
