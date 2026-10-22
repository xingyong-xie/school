"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/guards";
import { int, optionalStr, str, withError, withSuccess } from "@/lib/forms";

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function createSchedule(formData: FormData): Promise<void> {
  await requireAdmin();

  const classId = int(formData, "classId");
  const weekday = int(formData, "weekday");
  const startTime = str(formData, "startTime");
  const endTime = str(formData, "endTime");
  const subject = str(formData, "subject");
  const teacherName = optionalStr(formData, "teacherName");

  const back = `/schedule?classId=${classId ?? ""}`;

  if (!classId) redirect(withError("/schedule", "请选择班级"));
  if (!weekday || weekday < 1 || weekday > 5) {
    redirect(withError(back, "请选择工作日"));
  }
  if (!TIME_PATTERN.test(startTime) || !TIME_PATTERN.test(endTime)) {
    redirect(withError(back, "请填写正确的上课时间"));
  }
  if (endTime <= startTime) redirect(withError(back, "结束时间必须晚于开始时间"));
  if (!subject) redirect(withError(back, "请填写课程名称"));

  const schoolClass = await prisma.schoolClass.findUnique({
    where: { id: classId },
    select: { id: true },
  });
  if (!schoolClass) redirect(withError("/schedule", "班级不存在"));

  await prisma.schedule.create({
    data: { classId, weekday, startTime, endTime, subject, teacherName },
  });

  revalidatePath("/schedule");
  redirect(withSuccess(back, "课程已添加"));
}

export async function deleteSchedule(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = int(formData, "id");
  if (!id) redirect(withError("/schedule", "参数错误"));

  const schedule = await prisma.schedule.findUnique({ where: { id } });
  if (!schedule) redirect(withError("/schedule", "课程不存在"));

  await prisma.schedule.delete({ where: { id } });

  revalidatePath("/schedule");
  redirect(withSuccess(`/schedule?classId=${schedule.classId}`, "课程已删除"));
}
