import "server-only";

import { headers } from "next/headers";
import { Prisma, type Student } from "@prisma/client";
import { prisma } from "@/lib/db";
import { verifySession, type SessionUser } from "@/lib/auth";
import { todayString } from "@/lib/format";
import { fail, type JsonErrorCode, type JsonErrorDetail } from "@/lib/json";

const MAX_BODY_BYTES = 16 * 1024;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export class ApiError extends Error {
  constructor(
    public code: JsonErrorCode,
    message: string,
    public status: number,
    public details?: JsonErrorDetail[],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** 路由统一错误处理：ApiError → 标准 JSON；其余 → 500。 */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof ApiError) {
      return fail(error.code, error.message, error.status, error.details);
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return fail("NOT_FOUND", "资源不存在", 404);
    }
    console.error("[api]", error);
    return fail("INTERNAL", "服务器开小差了，请稍后再试", 500);
  }
}

function bearerToken(): string {
  const header = headers().get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match ? match[1].trim() : "";
}

/**
 * 校验 Bearer token，并回查数据库确认账号仍启用。
 * token 载荷里的角色不可全信，以数据库当前角色为准。
 */
export async function requireApiUser(): Promise<SessionUser> {
  const token = bearerToken();
  if (!token) throw new ApiError("UNAUTHORIZED", "请先登录", 401);

  const session = verifySession(token);
  if (!session) throw new ApiError("UNAUTHORIZED", "登录已过期，请重新登录", 401);

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { name: true, role: true, active: true },
  });
  if (!user || !user.active) {
    throw new ApiError("UNAUTHORIZED", "账号已停用，请联系园务", 401);
  }
  return { id: session.id, name: user.name, role: user.role };
}

/** 小程序家长端专用：非家长一律 403。 */
export async function requireParent(): Promise<SessionUser> {
  const user = await requireApiUser();
  if (user.role !== "PARENT") {
    throw new ApiError("FORBIDDEN", "家长端仅供家长账号使用", 403);
  }
  return user;
}

/** 校验孩子属于当前家长；不存在或不属于本人时统一返回 404。 */
export async function requireChild(
  user: SessionUser,
  childId: number,
): Promise<Student> {
  if (!Number.isInteger(childId) || childId <= 0) {
    throw new ApiError("VALIDATION", "孩子 ID 无效", 400);
  }
  const child = await prisma.student.findFirst({
    where: { id: childId, parentId: user.id },
  });
  if (!child) throw new ApiError("NOT_FOUND", "孩子档案不存在", 404);
  return child;
}

/** 读取 JSON 请求体，限制大小与内容类型。 */
export async function readJson(req: Request): Promise<Record<string, unknown>> {
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new ApiError("VALIDATION", "请求格式不正确", 400);
  }
  const text = await req.text();
  if (!text) return {};
  if (text.length > MAX_BODY_BYTES) {
    throw new ApiError("VALIDATION", "请求内容过大", 400);
  }
  try {
    const value = JSON.parse(text) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("not an object");
    }
    return value as Record<string, unknown>;
  } catch {
    throw new ApiError("VALIDATION", "请求格式不正确", 400);
  }
}

function invalid(field: string, message: string): ApiError {
  return new ApiError("VALIDATION", message, 400, [{ field, message }]);
}

export function stringField(
  body: Record<string, unknown>,
  key: string,
  options: { max?: number; optional?: boolean; trim?: boolean } = {},
): string {
  const raw = body[key];
  if (raw === undefined || raw === null) {
    if (options.optional) return "";
    throw invalid(key, "不能为空");
  }
  if (typeof raw !== "string") throw invalid(key, "格式不正确");
  const value = options.trim === false ? raw : raw.trim();
  if (!value && !options.optional) throw invalid(key, "不能为空");
  if (options.max && value.length > options.max) {
    throw invalid(key, `不能超过 ${options.max} 个字符`);
  }
  return value;
}

export function idField(
  body: Record<string, unknown>,
  key: string,
): number {
  const raw = body[key];
  const value =
    typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  if (!Number.isInteger(value) || value <= 0) throw invalid(key, "请选择有效项");
  return value;
}

export function dateField(
  body: Record<string, unknown>,
  key: string,
): string {
  const value = stringField(body, key, { max: 10 });
  if (!DATE_PATTERN.test(value)) throw invalid(key, "日期格式应为 YYYY-MM-DD");
  return value;
}

export function assertOneOf<T extends string>(
  value: string,
  allowed: readonly T[],
  field: string,
): T {
  if (!allowed.includes(value as T)) throw invalid(field, "选项无效");
  return value as T;
}

export function intParam(raw: string | undefined, name = "id"): number {
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new ApiError("VALIDATION", `${name} 无效`, 400);
  }
  return value;
}

/** 校验 ?month=YYYY-MM，缺省为当月。 */
export function monthParam(raw: string | null): string {
  if (raw === null || raw === "") return todayString().slice(0, 7);
  if (!MONTH_PATTERN.test(raw)) {
    throw new ApiError("VALIDATION", "月份格式应为 YYYY-MM", 400);
  }
  return raw;
}
