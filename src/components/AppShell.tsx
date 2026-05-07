"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type MouseEvent } from "react";
import { clearImportSession } from "@/lib/importSession";
import type { ShipmentDraft } from "@/lib/shipment";

type NavItem = { href: string; label: string };

const navItems: NavItem[] = [
  { href: "/", label: "导入" },
  { href: "/preview", label: "预览与编辑" },
  { href: "/imports", label: "导入记录" },
  { href: "/orders", label: "已导入运单" },
];

type SubmitProgress = { running: boolean; value: number; label: string };

type SubmitTaskState = {
  running: boolean;
  background: boolean;
  progress: SubmitProgress;
  summary: string;
  clearToken: number;
};

type SubmitTaskStartArgs = {
  fileName: string;
  fingerprint: string;
  items: ShipmentDraft[];
  excelRowNumbers: number[];
};

type SubmitTaskStartOptions = {
  onRowFail?: (globalIndex: number, rowNo: number, error: string) => void;
};

type SubmitTaskContextValue = SubmitTaskState & {
  start: (args: SubmitTaskStartArgs, opts?: SubmitTaskStartOptions) => Promise<void>;
  detachToBackground: () => void;
  clearSummary: () => void;
};

const SubmitTaskContext = createContext<SubmitTaskContextValue | null>(null);

export function useSubmitTask() {
  const ctx = useContext(SubmitTaskContext);
  if (!ctx) throw new Error("useSubmitTask must be used within AppShell");
  return ctx;
}

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isModifiedClick(e: MouseEvent) {
  return e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0;
}

export function AppShell(props: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const runningRef = useRef(false);

  const activeHref = useMemo(() => {
    for (const it of navItems) {
      if (isActivePath(pathname, it.href)) return it.href;
    }
    return "/";
  }, [pathname]);

  const [task, setTask] = useState<SubmitTaskState>({
    running: false,
    background: false,
    progress: { running: false, value: 0, label: "" },
    summary: "",
    clearToken: 0,
  });

  const detachToBackground = useCallback(() => {
    setTask((prev) => (prev.running ? { ...prev, background: true } : prev));
  }, []);

  const clearSummary = useCallback(() => {
    setTask((prev) => ({ ...prev, summary: "" }));
  }, []);

  const start = useCallback(
    async (args: SubmitTaskStartArgs, opts?: SubmitTaskStartOptions) => {
      if (runningRef.current) return;
      runningRef.current = true;

      setTask((prev) => ({
        ...prev,
        running: true,
        background: false,
        summary: "",
        progress: { running: true, value: 0, label: "创建导入任务…" },
      }));

      const chunkSize = 100;
      let ok = 0;
      let fail = 0;

      try {
        const startRes = await fetch("/api/import-tasks/start", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            fileName: args.fileName,
            fingerprint: args.fingerprint,
            totalCount: args.items.length,
          }),
        });

        const startJson = (await startRes.json().catch(() => null)) as { taskId?: unknown } | null;
        const taskId = String(startJson?.taskId ?? "").trim();
        if (!taskId) {
          setTask((prev) => ({
            ...prev,
            running: false,
            progress: { running: false, value: 0, label: "" },
            summary: "创建导入任务失败",
          }));
          return;
        }

        for (let startIndex = 0; startIndex < args.items.length; startIndex += chunkSize) {
          const end = Math.min(args.items.length, startIndex + chunkSize);
          const chunk = args.items.slice(startIndex, end);
          const rowNos = args.excelRowNumbers.slice(startIndex, end);

          setTask((prev) => ({
            ...prev,
            running: true,
            progress: {
              running: true,
              value: startIndex / args.items.length,
              label: `提交中：${Math.round((startIndex / args.items.length) * 100)}%（${startIndex}/${args.items.length}）`,
            },
          }));

          const res = await fetch("/api/import-tasks/batch", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ taskId, items: chunk, excelRowNumbers: rowNos }),
          });

          const json = (await res.json().catch(() => null)) as
            | { successCount?: number; failCount?: number; results?: Array<{ index: number; ok: boolean; error?: string }> }
            | null;

          ok += Number(json?.successCount ?? 0);
          fail += Number(json?.failCount ?? 0);

          const results = Array.isArray(json?.results) ? json!.results : [];
          if (results.length > 0 && opts?.onRowFail) {
            for (const r of results) {
              if (r.ok) continue;
              const globalIndex = startIndex + Number(r.index ?? 0);
              const rowNo = args.excelRowNumbers[globalIndex] ?? globalIndex + 1;
              opts.onRowFail(globalIndex, rowNo, String(r.error ?? "未知原因"));
            }
          }
        }

        setTask((prev) => ({
          ...prev,
          running: true,
          progress: { running: true, value: 1, label: "完成任务…" },
        }));

        const finishRes = await fetch("/api/import-tasks/finish", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ taskId }),
        });

        const finishJson = (await finishRes.json().catch(() => null)) as
          | { successCount?: unknown; failCount?: unknown; taskId?: unknown }
          | null;

        const ok2 = Number(finishJson?.successCount ?? ok);
        const fail2 = Number(finishJson?.failCount ?? fail);

        clearImportSession();

        setTask((prev) => ({
          ...prev,
          running: false,
          background: false,
          clearToken: prev.clearToken + 1,
          progress: { running: false, value: 1, label: "" },
          summary: `提交结果：成功 ${ok2} 条，失败 ${fail2} 条（任务：${taskId.slice(0, 8)}）`,
        }));
      } catch (err) {
        const msg = err instanceof Error ? err.message : "未知错误";
        setTask((prev) => ({
          ...prev,
          running: false,
          background: false,
          progress: { running: false, value: 0, label: "" },
          summary: `提交中断：${msg}`,
        }));
      } finally {
        runningRef.current = false;
      }
    },
    []
  );

  const onNavClick = useCallback(
    (e: MouseEvent, href: string) => {
      if (isModifiedClick(e)) return;
      if (href === activeHref) {
        e.preventDefault();
        return;
      }

      if (task.running && !task.background) {
        e.preventDefault();
        const ok = globalThis.confirm(
          "当前有提交任务正在进行，是否转入后台继续执行？\n\n- 选择“确定”：转入后台并继续执行\n- 选择“取消”：留在当前页面"
        );
        if (!ok) return;
        detachToBackground();
        router.push(href);
        return;
      }

      e.preventDefault();
      router.push(href);
    },
    [activeHref, detachToBackground, router, task.background, task.running]
  );

  const ctxValue = useMemo<SubmitTaskContextValue>(
    () => ({
      ...task,
      start,
      detachToBackground,
      clearSummary,
    }),
    [clearSummary, detachToBackground, start, task]
  );

  return (
    <SubmitTaskContext.Provider value={ctxValue}>
      <div className="flex h-dvh flex-col bg-slate-100">
        <header className="shrink-0 border-b bg-white">
          <div className="flex h-12 w-full items-center justify-between px-4">
            <div className="flex items-center gap-3">
              <div className="h-7 w-7 rounded bg-slate-900" />
              <div className="text-sm font-semibold tracking-wide text-slate-900">
                ztocc-wwp-exam
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              {task.running ? (
                <div className="inline-flex items-center gap-2 rounded-full border bg-slate-50 px-3 py-1">
                  <div className="h-2 w-2 rounded-full bg-amber-500" />
                  <div className="text-slate-700">
                    {task.background ? "后台提交中" : "提交中"}{" "}
                    {task.progress.value > 0 ? `${Math.round(task.progress.value * 100)}%` : ""}
                  </div>
                </div>
              ) : null}
              <div>万能导入 / 运单管理</div>
            </div>
          </div>
        </header>

        <div className="flex flex-1 min-h-0">
          <aside className="w-60 shrink-0 border-r bg-white">
            <div className="h-full overflow-y-auto p-2">
              <div className="px-3 py-2 text-xs font-semibold text-slate-500">
                导航
              </div>
              <nav className="mt-1 space-y-1">
                {navItems.map((it) => {
                  const active = it.href === activeHref;
                  const base =
                    "block rounded-md px-3 py-2 text-sm transition-colors";
                  const cls = active
                    ? "bg-slate-900 text-white"
                    : "text-slate-700 hover:bg-slate-100 hover:text-slate-900";
                  return (
                    <Link
                      key={it.href}
                      href={it.href}
                      onClick={(e) => onNavClick(e, it.href)}
                      className={`${base} ${cls}`}
                    >
                      {it.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
          </aside>

          <section className="min-w-0 flex-1 overflow-y-auto">
            <div className="p-4">{props.children}</div>
          </section>
        </div>
      </div>
    </SubmitTaskContext.Provider>
  );
}
