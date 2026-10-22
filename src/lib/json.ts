import "server-only";

export type JsonErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "CONFLICT"
  | "INTERNAL";

export type JsonErrorDetail = {
  field: string;
  message: string;
};

const NO_STORE = { "Cache-Control": "no-store" };

/** 统一成功响应：{ ok: true, data } */
export function ok<T>(data: T, status = 200): Response {
  return Response.json({ ok: true, data }, { status, headers: NO_STORE });
}

/** 统一错误响应：{ ok: false, error: { code, message, details? } } */
export function fail(
  code: JsonErrorCode,
  message: string,
  status: number,
  details?: JsonErrorDetail[],
): Response {
  return Response.json(
    { ok: false, error: { code, message, ...(details?.length ? { details } : {}) } },
    { status, headers: NO_STORE },
  );
}
