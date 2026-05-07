export function ProgressBar(props: { value: number; label?: string }) {
  const v = Math.max(0, Math.min(1, props.value));
  return (
    <div className="w-full">
      {props.label ? (
        <div className="mb-2 text-sm text-slate-600">{props.label}</div>
      ) : null}
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
        <div className="h-full bg-slate-900" style={{ width: `${v * 100}%` }} />
      </div>
    </div>
  );
}

