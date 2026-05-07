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
    <div className="min-h-dvh bg-slate-100">
      <header className="h-12 bg-teal-700 text-white">
        <div className="mx-auto flex h-12 w-full max-w-[1400px] items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="h-7 w-7 rounded bg-white/15" />
            <div className="text-sm font-semibold tracking-wide">万能导入</div>
          </div>
          <div className="text-xs text-white/80">导入任务 / 运单管理</div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1400px] gap-4 px-4 py-4">
        <aside className="w-56 shrink-0">
          <div className="rounded-lg bg-slate-900 p-2 text-slate-200">
            <div className="px-3 py-2 text-xs font-semibold text-slate-300">
              导航菜单
            </div>
            <nav className="mt-1 space-y-1">
              {navItems.map((it) => {
                const active = it.href === activeHref;
                const base =
                  "block rounded-md px-3 py-2 text-sm transition-colors";
                const cls = active
                  ? "bg-teal-600 text-white"
                  : "text-slate-200 hover:bg-slate-800";
                return (
                  <Link key={it.href} href={it.href} className={`${base} ${cls}`}>
                    {it.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </aside>

        <section className="min-w-0 flex-1">
          {props.children}
        </section>
      </div>
    </div>
  );
}
