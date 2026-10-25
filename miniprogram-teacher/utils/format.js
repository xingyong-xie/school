function pad(n) {
  return n < 10 ? "0" + n : String(n);
}

/** 本地时区的今天，YYYY-MM-DD（与后端 todayString 一致）。 */
function todayString() {
  const now = new Date();
  return now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate());
}

function monthString() {
  return todayString().slice(0, 7);
}

/** 月份加减，输入输出 YYYY-MM。 */
function shiftMonth(month, delta) {
  const year = Number(month.slice(0, 4));
  const monthIndex = Number(month.slice(5, 7)) - 1 + delta;
  const date = new Date(year, monthIndex, 1);
  return date.getFullYear() + "-" + pad(date.getMonth() + 1);
}

/** 分 → ¥1,234.00 */
function fmtMoney(cents) {
  const value = Number(cents || 0) / 100;
  const parts = value.toFixed(2).split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return "¥" + parts.join(".");
}

function fmtDate(value) {
  if (!value) return "—";
  return String(value).slice(0, 10);
}

function dateRangeText(startDate, endDate) {
  if (!startDate) return "—";
  if (!endDate || endDate === startDate) return startDate;
  return startDate + " 至 " + endDate;
}

module.exports = {
  todayString,
  monthString,
  shiftMonth,
  fmtMoney,
  fmtDate,
  dateRangeText,
};
