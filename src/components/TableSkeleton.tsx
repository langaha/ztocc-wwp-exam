export function TableSkeleton(props: { columns: number; rows?: number }) {
  const rows = props.rows ?? 8;
  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-max text-sm">
          <thead className="sticky top-0 bg-slate-50">
            <tr>
              {new Array(props.columns).fill(null).map((_, i) => (
                <th key={i} className="border-b px-3 py-2">
                  <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {new Array(rows).fill(null).map((_, r) => (
              <tr key={r} className="even:bg-slate-50/40">
                {new Array(props.columns).fill(null).map((__, c) => (
                  <td key={c} className="border-b px-3 py-2">
                    <div
                      className={`h-4 animate-pulse rounded bg-slate-100 ${
                        c % 3 === 0 ? "w-28" : c % 3 === 1 ? "w-44" : "w-20"
                      }`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

