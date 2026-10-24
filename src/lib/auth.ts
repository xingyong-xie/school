import "server-only";

import crypto from "node:crypto";
import { cookies } from "next/headers";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db";

export const SESSION_COOKIE = "kg_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export type SessionUser = {
  id: number;
  name: string;
  role: Role;
};

type SessionPayload = SessionUser & { exp: number };

function secret(): string {
  return process.env.AUTH_SECRET ?? "kindergarten-dev-secret";
}

function sign(value: string): string {
  return crypto.createHmac("sha256", secret()).update(value).digest("base64url");
}

function encode(payload: SessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

const MAX_TOKEN_LENGTH = 2048;

function decode(token: string): SessionPayload | null {
  if (!token || token.length > MAX_TOKEN_LENGTH) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, signature] = parts;
  if (!body || !signature) return null;

  const expected = sign(body);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as SessionPayload;
    if (
      typeof payload.id !== "number" ||
      typeof payload.name !== "string" ||
      typeof payload.role !== "string" ||
      typeof payload.exp !== "number" ||
      payload.exp * 1000 < Date.now()
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

/** 生成与 Cookie 会话同格式的签名 token（供小程序 Bearer 鉴权）。 */
export function signSession(user: SessionUser): { token: string; exp: number } {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  return { token: encode({ ...user, exp }), exp };
}

/** 校验 Bearer token，返回会话用户；无效或过期返回 null。 */
export function verifySession(token: string): SessionUser | null {
  const payload = decode(token);
  if (!payload) return null;
  return { id: payload.id, name: payload.name, role: payload.role };
}

const MEDIA_TOKEN_TTL_SECONDS = 60 * 60 * 6;

function mediaSignature(userId: number, exp: number): string {
  return crypto
    .createHmac("sha256", secret())
    .update(`media:${userId}:${exp}`)
    .digest("base64url");
}

/**
 * 生成短时媒体访问令牌，用于 <img> 等无法携带自定义请求头的场景。
 * 与登录会话分离，泄露影响范围仅为图片读取，且 2 小时后失效。
 */
export function signMediaToken(user: { id: number }): string {
  const exp = Math.floor(Date.now() / 1000) + MEDIA_TOKEN_TTL_SECONDS;
  return `${user.id}.${exp}.${mediaSignature(user.id, exp)}`;
}

/** 校验媒体令牌，返回用户 ID；无效或过期返回 null。 */
export function verifyMediaToken(token: string): number | null {
  if (!token || token.length > 512) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const id = Number(parts[0]);
  const exp = Number(parts[1]);
  if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(exp)) return null;
  if (exp * 1000 < Date.now()) return null;

  const expected = Buffer.from(mediaSignature(id, exp));
  const actual = Buffer.from(parts[2]);
  if (expected.length !== actual.length) return null;
  if (!crypto.timingSafeEqual(expected, actual)) return null;
  return id;
}

/**
 * 读取当前 Web 会话。签名校验后回查数据库，避免账号删除/停用/改角色后
 * 旧 Cookie 继续生效（例如重置演示数据后旧的用户 ID 已不存在）。
 */
export async function getSession(): Promise<SessionUser | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = decode(token);
  if (!payload) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.id },
    select: { name: true, role: true, active: true },
  });
  if (!user || !user.active) return null;
  return { id: payload.id, name: user.name, role: user.role };
}

export async function setSession(user: SessionUser): Promise<void> {
  const { token } = signSession(user);
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSession(): Promise<void> {
  cookies().delete(SESSION_COOKIE);
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = crypto.scryptSync(password, salt, 64);
  return (
    expected.length === actual.length &&
    crypto.timingSafeEqual(expected, actual)
  );
}
