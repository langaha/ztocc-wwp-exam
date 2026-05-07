"use client";

import { useRouter, useSearchParams } from "next/navigation";

type Props = {
  paramKey: string;
  resetPageKey: string;
  options?: number[];
  defaultValue?: number;
};

export function PageSizeSelect(props: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const options = props.options ?? [20, 50, 100, 200];
  const defaultValue = props.defaultValue ?? 20;
  const raw = sp.get(props.paramKey);
  const current = Number(raw ?? defaultValue);
  const value = options.includes(current) ? current : defaultValue;

  return (
    <select
      value={value}
      onChange={(e) => {
        const n = Number(e.target.value);
        if (!Number.isFinite(n)) return;
        const next = new URLSearchParams(sp.toString());
        next.set(props.paramKey, String(n));
        next.set(props.resetPageKey, "1");
        router.replace(`${location.pathname}?${next.toString()}`);
      }}
      className="rounded-md border px-2 py-2 text-sm"
    >
      {options.map((n) => (
        <option key={n} value={n}>
          每页 {n}
        </option>
      ))}
    </select>
  );
}

