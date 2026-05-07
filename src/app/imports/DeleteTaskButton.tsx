"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export function DeleteTaskButton(props: { taskId: string }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [loading, setLoading] = useState(false);

  async function onDelete() {
    if (loading) return;
    if (!confirm("确认删除该导入任务？将同时删除任务关联的导入明细。")) return;
    setLoading(true);
    try {
      const res = await fetch("/api/import-tasks/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ taskId: props.taskId }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: unknown } | null;
        throw new Error(String(j?.error ?? "删除失败"));
      }
      const cur = sp.get("taskId");
      if (cur && cur === props.taskId) {
        const next = new URLSearchParams(sp.toString());
        next.delete("taskId");
        next.set("detailPage", "1");
        router.replace(`/imports?${next.toString()}`);
      } else {
        router.refresh();
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "删除失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void onDelete()}
      disabled={loading}
      className="rounded-md border border-rose-200 bg-rose-50 px-3 py-1 text-xs text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {loading ? "删除中..." : "删除"}
    </button>
  );
}

