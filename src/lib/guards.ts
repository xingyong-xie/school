import "server-only";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession, type SessionUser } from "@/lib/auth";

export async function requireUser(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/?error=" + encodeURIComponent("无权访问该页面"));
  return user;
}

export async function requireStaff(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role === "PARENT") {
    redirect("/?error=" + encodeURIComponent("无权访问该页面"));
  }
  return user;
}

/** 教师负责的班级 ID；非教师返回空数组。 */
export async function teacherClassIds(userId: number): Promise<number[]> {
  const teacher = await prisma.teacher.findUnique({
    where: { userId },
    select: { classes: { select: { id: true } } },
  });
  return teacher?.classes.map((item) => item.id) ?? [];
}

/**
 * 当前用户可见的学生范围：
 * - 管理员：null（全部）
 * - 教师：所负责班级的学生 ID
 * - 家长：自己的孩子的 ID
 */
export async function visibleStudentIds(
  user: SessionUser,
): Promise<number[] | null> {
  if (user.role === "ADMIN") return null;

  if (user.role === "TEACHER") {
    const classes = await teacherClassIds(user.id);
    if (classes.length === 0) return [];
    const students = await prisma.student.findMany({
      where: { classId: { in: classes } },
      select: { id: true },
    });
    return students.map((item) => item.id);
  }

  const children = await prisma.student.findMany({
    where: { parentId: user.id },
    select: { id: true },
  });
  return children.map((item) => item.id);
}

/** 家长账号关联的孩子 ID（小程序家长端与接口共用）。 */
export async function parentChildIds(userId: number): Promise<number[]> {
  const children = await prisma.student.findMany({
    where: { parentId: userId },
    select: { id: true },
  });
  return children.map((item) => item.id);
}

/** 按当前角色判断能否访问某名幼儿（管理员全部、教师本班、家长本人孩子）。 */
export async function userCanAccessStudent(
  user: SessionUser,
  studentId: number,
): Promise<boolean> {
  if (user.role === "ADMIN") return true;
  if (user.role === "TEACHER") {
    return teacherCanAccessStudent(user.id, studentId);
  }
  const student = await prisma.student.findFirst({
    where: { id: studentId, parentId: user.id },
    select: { id: true },
  });
  return Boolean(student);
}

/** 校验教师是否负责该学生所在班级。 */
export async function teacherCanAccessStudent(
  userId: number,
  studentId: number,
): Promise<boolean> {
  const classes = await teacherClassIds(userId);
  if (classes.length === 0) return false;
  const student = await prisma.student.findFirst({
    where: { id: studentId, classId: { in: classes } },
    select: { id: true },
  });
  return Boolean(student);
}

/** 校验教师是否负责该班级。 */
export async function teacherCanAccessClass(
  userId: number,
  classId: number,
): Promise<boolean> {
  const classes = await teacherClassIds(userId);
  return classes.includes(classId);
}
