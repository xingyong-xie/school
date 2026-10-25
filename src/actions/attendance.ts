"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { AttendanceStatus } from "@prisma/client";
import { ApiError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { requireStaff, teacherCanAccessClass } from "@/lib/guards";
import { int, str, withError, withSuccess } from "@/lib/forms";
import { ATTENDANCE_OPTIONS } from "@/lib/constants";
import { saveClassAttendance } from "@/lib/services/attendance";
import { isValidDateString } from "@/lib/format";

export async function saveAttendance(formData: FormData): Promise<void> {
  const user = await requireStaff();

  const classId = int(formData, "classId");
  const date = str(formData, "date");

  if (!classId) redirect(withError("/attendance", "请选择班级"));
  if (!isValidDateString(date)) {
    redirect(withError("/attendance", "请选择有效日期"));
  }

  if (user.role === "TEACHER" && !(await teacherCanAccessClass(user.id, classId))) {
    redirect(withError("/attendance", "只能登记自己负责班级的考勤"));
  }

  const students = await prisma.student.findMany({
    where: { classId, status: "ACTIVE" },
    select: { id: true, name: true },
  });
  if (students.length === 0) {
    redirect(withError(`/attendance?classId=${classId}&date=${date}`, "该班级暂无在园幼儿"));
  }

  const rows: { studentId: number; status: AttendanceStatus; note: string | null }[] = [];
  for (const student of students) {
    const rawStatus = str(formData, `status_${student.id}`) as AttendanceStatus;
    if (!ATTENDANCE_OPTIONS.includes(rawStatus)) continue;
    const note = str(formData, `note_${student.id}`) || null;
    rows.push({ studentId: student.id, status: rawStatus, note });
  }

  if (rows.length === 0) {
    redirect(withError(`/attendance?classId=${classId}&date=${date}`, "没有可保存的考勤数据"));
  }

  try {
    await saveClassAttendance({
      classId,
      date,
      rows,
      recordedById: user.id,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      redirect(withError(`/attendance?classId=${classId}&date=${date}`, error.message));
    }
    throw error;
  }

  revalidatePath("/attendance");
  revalidatePath("/");
  redirect(
    withSuccess(
      `/attendance?classId=${classId}&date=${date}`,
      `已保存 ${date} 的考勤记录`,
    ),
  );
}
