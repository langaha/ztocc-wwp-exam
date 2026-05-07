import Link from "next/link";

export function TopNav() {
  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-base font-semibold tracking-tight">
          万能导入
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/" className="text-slate-700 hover:text-slate-900">
            导入
          </Link>
          <Link href="/preview" className="text-slate-700 hover:text-slate-900">
            预览与编辑
          </Link>
          <Link href="/imports" className="text-slate-700 hover:text-slate-900">
            导入记录
          </Link>
          <Link href="/orders" className="text-slate-700 hover:text-slate-900">
            已导入运单
          </Link>
        </nav>
      </div>
    </header>
  );
}

