import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import {
  SESSION_COOKIE,
  verifyMediaToken,
  verifySession,
  type SessionUser,
} from "@/lib/auth";
import { diaryScopeWhere } from "@/lib/diary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function notFound(): Response {
  return new Response("Not Found", { status: 404 });
}

/**
 * 支持四种身份来源：
 * - Authorization: Bearer token（普通接口调用）
 * - ?token=...（小程序 <image> 无法携带请求头）
 * - ?mt=...（Web 端图片的短时媒体令牌，避免 Cookie 未随图片请求发送）
 * - kg_session Cookie（Web 端 <img>）
 */
async function resolveUser(request: Request): Promise<SessionUser | null> {
  const url = new URL(request.url);
  const mediaIdRaw = url.searchParams.get("mt");
  let userId: number | null = null;

  if (mediaIdRaw) {
    userId = verifyMediaToken(mediaIdRaw);
  } else {
    const match = /^Bearer\s+(.+)$/i.exec(request.headers.get("authorization") ?? "");
    const token =
      match?.[1]?.trim() ||
      url.searchParams.get("token") ||
      cookies().get(SESSION_COOKIE)?.value ||
      "";
    if (token) {
      const session = verifySession(token);
      userId = session?.id ?? null;
    }
  }
  if (userId === null) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, role: true, active: true },
  });
  if (!user || !user.active) return null;
  return { id: userId, name: user.name, role: user.role };
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return notFound();

  const user = await resolveUser(request);
  if (!user) {
    return new Response("Unauthorized", {
      status: 401,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const photo = await prisma.diaryPhoto.findUnique({
    where: { id },
    select: {
      data: true,
      mimeType: true,
      size: true,
      entry: { select: { id: true } },
    },
  });
  if (!photo) return notFound();

  const scope = diaryScopeWhere(user);
  if (scope) {
    const visible = await prisma.diaryEntry.count({
      where: { id: photo.entry.id, AND: [scope] },
    });
    if (visible === 0) return notFound();
  }

  // 复制到独立的 ArrayBuffer，避免 Buffer 底层内存池影响响应体类型。
  const body = Uint8Array.from(photo.data);

  return new Response(body.buffer, {
    status: 200,
    headers: {
      "Content-Type": photo.mimeType,
      "Content-Length": String(photo.size),
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    },
  });
}
