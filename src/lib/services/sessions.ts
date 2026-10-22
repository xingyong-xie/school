import "server-only";

import { prisma } from "@/lib/db";
import { verifyPassword, type SessionUser } from "@/lib/auth";

/** 校验账号密码；账号不存在、停用或密码错误统一返回 null。 */
export async function authenticate(
  username: string,
  password: string,
): Promise<SessionUser | null> {
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !user.active) return null;
  if (!verifyPassword(password, user.passwordHash)) return null;
  return { id: user.id, name: user.name, role: user.role };
}
