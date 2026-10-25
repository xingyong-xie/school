"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { LeaveType } from "@prisma/client";
import { ApiError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { requireUser, userCanAccessStudent } from "@/lib/guards";
import { int, str, withError, withSuccess } from "@/lib/forms";
import { isValidDateString } from "@/lib/format";
import {
  LEAVE_TYPES,
  reviewLeaveRequest,
} from "@/lib/services/leaves";

export async function createLeave(formData: FormData): Promise<void> {
  const user = await requireUser();

  const studentId = int(formData, "studentId");
  const type = str(formData, "type") as LeaveType;
  const startDate = str(formData, "startDate");
  const endDate = str(formData, "endDate");
  const reason = str(formData, "reason");

  if (!studentId) redirect(withError("/leaves", "请选择幼儿"));
  if (!LEAVE_TYPES.includes(type)) redirect(withError("/leaves", "请选择请假类型"));
  if (!isValidDateString(startDate) || !isValidDateString(endDate)) {
    redirect(withError("/leaves", "请选择有效的请假日期"));
  }
  if (endDate < startDate) redirect(withError("/leaves", "结束日期不能早于开始日期"));
  if (!reason) redirect(withError("/leaves", "请填写请假事由"));

  if (!(await userCanAccessStudent(user, studentId))) {
    redirect(withError("/leaves", "无权为该幼儿提交请假"));
  }

  await prisma.leaveRequest.create({
    data: {
      studentId,
      type,
      startDate,
      endDate,
      reason,
      requestedById: user.id,
    },
  });

  revalidatePath("/leaves");
  revalidatePath("/");
  redirect(withSuccess("/leaves", "请假申请已提交，等待审核"));
}

export async function reviewLeave(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (user.role === "PARENT") {
    redirect(withError("/leaves", "家长无权审批请假"));
  }

  const id = int(formData, "id");
  const decision = str(formData, "decision");
  const reviewNote = str(formData, "reviewNote") || null;

  if (!id) redirect(withError("/leaves", "参数错误"));
  if (decision !== "APPROVED" && decision !== "REJECTED") {
    redirect(withError("/leaves", "审批结果无效"));
  }

  let result: Awaited<ReturnType<typeof reviewLeaveRequest>>;
  try {
    result = await reviewLeaveRequest({
      leaveId: id,
      decision,
      reviewNote,
      reviewer: user,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      redirect(withError("/leaves", error.message));
    }
    throw error;
  }

  revalidatePath("/leaves");
  revalidatePath("/");
  redirect(
    withSuccess(
      "/leaves",
      `${result.studentName} 的请假申请已${decision === "APPROVED" ? "批准" : "驳回"}`,
    ),
  );
}

export async function cancelLeave(formData: FormData): Promise<void> {
  const user = await requireUser();

  const id = int(formData, "id");
  if (!id) redirect(withError("/leaves", "参数错误"));

  const leave = await prisma.leaveRequest.findUnique({
    where: { id },
    include: { student: { select: { parentId: true, name: true } } },
  });
  if (!leave) redirect(withError("/leaves", "请假申请不存在"));
  if (leave.status !== "PENDING") redirect(withError("/leaves", "只能撤销待审批的申请"));
  if (user.role === "PARENT" && leave.student.parentId !== user.id) {
    redirect(withError("/leaves", "无权撤销该申请"));
  }
  if (user.role === "TEACHER") {
    redirect(withError("/leaves", "教师请在审批流程中处理申请"));
  }

  await prisma.leaveRequest.delete({ where: { id } });

  revalidatePath("/leaves");
  revalidatePath("/");
  redirect(withSuccess("/leaves", `已撤销 ${leave.student.name} 的请假申请`));
}
