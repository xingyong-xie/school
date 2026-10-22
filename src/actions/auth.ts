"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { clearSession, setSession, verifyPassword } from "@/lib/auth";
import { str, withError } from "@/lib/forms";

export async function loginAction(formData: FormData): Promise<void> {
  const username = str(formData, "username");
  const password = str(formData, "password");

  if (!username || !password) {
    redirect(withError("/login", "请输入账号和密码"));
  }

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !user.active || !verifyPassword(password, user.passwordHash)) {
    redirect(withError("/login", "账号或密码不正确"));
  }

  await setSession({ id: user.id, name: user.name, role: user.role });
  redirect("/");
}

export async function logoutAction(): Promise<void> {
  await clearSession();
  redirect("/login");
}
