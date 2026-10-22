const moneyFormatter = new Intl.NumberFormat("zh-CN", {
  style: "currency",
  currency: "CNY",
  minimumFractionDigits: 2,
});

export function fmtMoney(cents: number): string {
  return moneyFormatter.format(cents / 100);
}

/** 将 YYYY-MM-DD 或 Date 格式化为 YYYY-MM-DD。 */
export function fmtDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

export function fmtDateTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** 服务器本地时区的今天，格式 YYYY-MM-DD。 */
export function todayString(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}`;
}

export function monthStartString(date = new Date()): string {
  return `${todayString(date).slice(0, 7)}-01`;
}

export function calcAge(birthDate: Date): number {
  const now = new Date();
  let age = now.getFullYear() - birthDate.getUTCFullYear();
  const month = now.getMonth() - birthDate.getUTCMonth();
  if (month < 0 || (month === 0 && now.getDate() < birthDate.getUTCDate())) {
    age -= 1;
  }
  return age;
}

export function yuanToCents(value: string): number {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100);
}

export function centsToYuan(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function weekdayLabel(weekday: number): string {
  return ["", "周一", "周二", "周三", "周四", "周五", "周六", "周日"][weekday] ?? "";
}
