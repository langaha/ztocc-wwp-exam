export function formatDateTimeYmdHms(input: unknown): string {
  const raw = String(input ?? "").trim();
  if (!raw) return "";
  const d = new Date(raw);
  if (!Number.isFinite(d.getTime())) return raw;
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(d);
}

export function getShanghaiTodayRangeDatetimeLocal(): { from: string; to: string } {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const y = get("year");
  const m = get("month");
  const d = get("day");
  const base = `${y}-${m}-${d}`;
  return { from: `${base}T00:00:00`, to: `${base}T23:59:59` };
}

export function getShanghaiLast7DaysRangeDatetimeLocal(): { from: string; to: string } {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const year = Number(get("year"));
  const month = Number(get("month"));
  const day = Number(get("day"));

  const startShanghaiUtcMs = Date.UTC(year, month - 1, day, 0 - 8, 0, 0) - 6 * 24 * 60 * 60 * 1000;
  const start = new Date(startShanghaiUtcMs);
  const startParts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(start);

  const y2 = startParts.find((p) => p.type === "year")?.value ?? "";
  const m2 = startParts.find((p) => p.type === "month")?.value ?? "";
  const d2 = startParts.find((p) => p.type === "day")?.value ?? "";

  const fromBase = `${y2}-${m2}-${d2}`;
  const toBase = `${get("year")}-${get("month")}-${get("day")}`;
  return { from: `${fromBase}T00:00:00`, to: `${toBase}T23:59:59` };
}

export function datetimeLocalShanghaiToIso(input: string): string {
  const v = input.trim();
  const m = v.match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/
  );
  if (!m) return "";
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const hour = Number(m[4]);
  const minute = Number(m[5]);
  const second = Number(m[6] ?? "0");
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    !Number.isFinite(hour) ||
    !Number.isFinite(minute) ||
    !Number.isFinite(second)
  ) {
    return "";
  }
  const utcMs = Date.UTC(year, month - 1, day, hour - 8, minute, second);
  const d = new Date(utcMs);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toISOString();
}
