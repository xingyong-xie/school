export function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export function optionalStr(formData: FormData, key: string): string | null {
  const value = str(formData, key);
  return value === "" ? null : value;
}

export function int(formData: FormData, key: string): number | null {
  const raw = str(formData, key);
  if (raw === "") return null;
  const value = Number(raw);
  return Number.isInteger(value) ? value : null;
}

export function dateString(formData: FormData, key: string): string {
  return str(formData, key).slice(0, 10);
}

/** 构造带回显错误信息的跳转地址。 */
export function withError(path: string, message: string): string {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}error=${encodeURIComponent(message)}`;
}

export function withSuccess(path: string, message: string): string {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}success=${encodeURIComponent(message)}`;
}
