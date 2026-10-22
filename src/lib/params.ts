export type SearchParams = {
  [key: string]: string | string[] | undefined;
};

export function getParam(
  searchParams: SearchParams | undefined,
  key: string,
): string | undefined {
  const value = searchParams?.[key];
  return Array.isArray(value) ? value[0] : value;
}

export function getIntParam(
  searchParams: SearchParams | undefined,
  key: string,
): number | undefined {
  const value = getParam(searchParams, key);
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : undefined;
}
