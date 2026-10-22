"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/guards";
import { hashPassword } from "@/lib/auth";
import {
  int,
  optionalStr,
  str,
  withError,
  withSuccess,
} from "@/lib/forms";

export async function createTeacher(formData: FormData): Promise<void> {
  await requireAdmin();

  const name = str(formData, "name");
  const employeeNo = str(formData, "employeeNo");
  const phone = optionalStr(formData, "phone");
  const specialty = optionalStr(formData, "specialty");
  const username = str(formData, "username") || phone || employeeNo;
  const password = str(formData, "password") || "123456";

  if (!name) redirect(withError("/teachers", "请填写教师姓名"));
  if (!employeeNo) redirect(withError("/teachers", "请填写工号"));
  if (!username) redirect(withError("/teachers", "请填写登录账号"));
  if (password.length < 6) redirect(withError("/teachers", "密码至少 6 位"));

  const [usernameTaken, employeeTaken] = await Promise.all([
    prisma.user.findUnique({ where: { username }, select: { id: true } }),
    prisma.teacher.findUnique({ where: { employeeNo }, select: { id: true } }),
  ]);
  if (usernameTaken) redirect(withError("/teachers", "登录账号已存在"));
  if (employeeTaken) redirect(withError("/teachers", "工号已存在"));

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        username,
        passwordHash: hashPassword(password),
        name,
        role: "TEACHER",
        phone,
      },
    });
    await tx.teacher.create({
      data: { employeeNo, specialty, phone, userId: user.id },
    });
  });

  revalidatePath("/teachers");
  revalidatePath("/");
  redirect(withSuccess("/teachers", `已添加教师「${name}」`));
}

export async function updateTeacher(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = int(formData, "id");
  if (!id) redirect(withError("/teachers", "参数错误"));

  const teacher = await prisma.teacher.findUnique({
    where: { id },
    include: { user: true },
  });
  if (!teacher) redirect(withError("/teachers", "教师不存在"));

  const name = str(formData, "name");
  const employeeNo = str(formData, "employeeNo");
  const phone = optionalStr(formData, "phone");
  const specialty = optionalStr(formData, "specialty");
  const password = str(formData, "password");

  if (!name) redirect(withError(`/teachers/${id}/edit`, "请填写教师姓名"));
  if (!employeeNo) redirect(withError(`/teachers/${id}/edit`, "请填写工号"));
  if (password && password.length < 6) {
    redirect(withError(`/teachers/${id}/edit`, "新密码至少 6 位"));
  }

  const duplicate = await prisma.teacher.findFirst({
    where: { employeeNo, NOT: { id } },
    select: { id: true },
  });
  if (duplicate) redirect(withError(`/teachers/${id}/edit`, "工号已存在"));

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: teacher.userId },
      data: {
        name,
        phone,
        ...(password ? { passwordHash: hashPassword(password) } : {}),
      },
    });
    await tx.teacher.update({
      where: { id },
      data: { employeeNo, specialty, phone },
    });
  });

  revalidatePath("/teachers");
  revalidatePath(`/teachers/${id}`);
  redirect(withSuccess("/teachers", "教师信息已更新"));
}

export async function deleteTeacher(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = int(formData, "id");
  if (!id) redirect(withError("/teachers", "参数错误"));

  const teacher = await prisma.teacher.findUnique({
    where: { id },
    include: { user: true, classes: { select: { name: true } } },
  });
  if (!teacher) redirect(withError("/teachers", "教师不存在"));

  if (teacher.classes.length > 0) {
    redirect(
      withError(
        "/teachers",
        `该教师仍负责 ${teacher.classes.map((item) => item.name).join("、")}，请先调整班级负责人`,
      ),
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.teacher.delete({ where: { id } });
    await tx.user.delete({ where: { id: teacher.userId } });
  });

  revalidatePath("/teachers");
  redirect(withSuccess("/teachers", `已删除教师「${teacher.user.name}」`));
}
