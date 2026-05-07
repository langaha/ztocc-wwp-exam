import { ensureDb, getDbClient } from "@/lib/db";
import { datetimeLocalShanghaiToIso, formatDateTimeYmdHms } from "@/lib/datetime";
import Link from "next/link";
import { DeleteTaskButton } from "./DeleteTaskButton";
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

export async function ImportsDataSection(props: {
  fileNameFilter: string;
  statusFilter: string;
  fromRaw: string;
  toRaw: string;
  taskId: string;
  page: string;
  detailPage: string;
  pageSize: string;
  detailPageSize: string;
}) {
  await ensureDb();
  const db = getDbClient();

  const taskPage = clampPage(Number(props.page));
  const detailPage = clampPage(Number(props.detailPage));
  const pageSize = clampPageSize(Number(props.pageSize));
  const detailPageSize = clampPageSize(Number(props.detailPageSize));

  const fromIso = props.fromRaw ? datetimeLocalShanghaiToIso(props.fromRaw) : "";
  const toIso = props.toRaw ? datetimeLocalShanghaiToIso(props.toRaw) : "";

  const where: string[] = [];
  const whereArgs: Array<string | number | null> = [];
  if (props.fileNameFilter) {
    where.push("file_name LIKE ?");
    whereArgs.push(`%${props.fileNameFilter}%`);
  }
  if (props.statusFilter) {
    where.push("status = ?");
    whereArgs.push(props.statusFilter);
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

  const taskIdSet = new Set(tasks.map((t) => String(t.id ?? "")));
  const selectedTaskId =
    props.taskId && taskIdSet.has(props.taskId) ? props.taskId : tasks[0]?.id ? String(tasks[0].id) : "";

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
  taskBaseParams.set("pageSize", String(pageSize));
  if (props.fileNameFilter) taskBaseParams.set("fileName", props.fileNameFilter);
  if (props.statusFilter) taskBaseParams.set("status", props.statusFilter);
  if (props.fromRaw) taskBaseParams.set("from", props.fromRaw);
  if (props.toRaw) taskBaseParams.set("to", props.toRaw);
  if (selectedTaskId) taskBaseParams.set("taskId", selectedTaskId);
  taskBaseParams.set("detailPage", String(safeDetailPage));
  taskBaseParams.set("detailPageSize", String(detailPageSize));

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
                <th className="border-b px-3 py-2 text-left font-medium text-slate-700">操作</th>
              </tr>
            </thead>
            <tbody>
              {tasks.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-center text-slate-600" colSpan={8}>
                    暂无导入任务
                  </td>
                </tr>
              ) : (
                tasks.map((t) => {
                  const id = String(t.id ?? "");
                  const active = selectedTaskId && id === selectedTaskId;
                  const rowClass = active ? "bg-blue-50" : "hover:bg-slate-50 even:bg-slate-50/40";
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
                      <td className="border-b px-3 py-2">
                        <DeleteTaskButton taskId={id} />
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
          <PageSizeSelect
            paramKey="pageSize"
            resetPageKey="page"
            defaultValue={20}
            options={[20, 50, 100, 200]}
          />
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
          <PageSizeSelect
            paramKey="detailPageSize"
            resetPageKey="detailPage"
            defaultValue={20}
            options={[20, 50, 100, 200]}
          />
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

