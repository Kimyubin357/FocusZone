// [STATS] NEW FILE: src/services/lib/time.ts

/** ms -> "HH:mm" */
export function fmtHm(ms: number) {
  const totalMin = Math.max(0, Math.floor(ms / 1000 / 60));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** 날짜 유틸 */
export function toYMD(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
export function addDays(d: Date, n: number) {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}
export function startOfWeek(d: Date) {
  const c = new Date(d);
  const day = c.getDay(); // 0:일
  c.setHours(0, 0, 0, 0);
  c.setDate(c.getDate() - day);
  return c;
}
export function startOfMonth(d: Date) {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  c.setDate(1);
  return c;
}
