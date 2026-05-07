"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

type NavItem = { href: string; label: string };

const navItems: NavItem[] = [
  { href: "/", label: "导入" },
  { href: "/preview", label: "预览与编辑" },
  { href: "/imports", label: "导入记录" },
  { href: "/orders", label: "已导入运单" },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell(props: { children: React.ReactNode }) {
  const pathname = usePathname();

  const activeHref = useMemo(() => {
    for (const it of navItems) {
      if (isActivePath(pathname, it.href)) return it.href;
    }
    return "/";
  }, [pathname]);

  return (
    <div className="flex h-dvh flex-col bg-slate-100">
      <header className="shrink-0 border-b bg-white">
        <div className="flex h-12 w-full items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="h-7 w-7 rounded bg-slate-900" />
            <div className="text-sm font-semibold tracking-wide text-slate-900">
              ztocc-wwp-exam
            </div>
          </div>
          <div className="text-xs text-slate-500">万能导入 / 运单管理</div>
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
                  <Link key={it.href} href={it.href} className={`${base} ${cls}`}>
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
  );
}
