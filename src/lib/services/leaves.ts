import "server-only";

import type { LeaveType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api";

export const LEAVE_TYPES: LeaveType[] = ["SICK", "PERSONAL", "OTHER"];

export type NewParentLeave = {
  studentId: number;
  type: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
};

export async function createLeaveForParent(
  userId: number,
  input: NewParentLeave,
) {
  return prisma.leaveRequest.create({
    data: {
      studentId: input.studentId,
      type: input.type,
      startDate: input.startDate,
      endDate: input.endDate,
      reason: input.reason,
      requestedById: userId,
    },
  });
}

/** 撤销家长本人的待审批申请；非本人或不存在 → 404，非待审批 → 409。 */
export async function cancelLeaveForParent(userId: number, leaveId: number) {
  const leave = await prisma.leaveRequest.findFirst({
    where: { id: leaveId, student: { parentId: userId } },
    include: { student: { select: { name: true } } },
  });
  if (!leave) throw new ApiError("NOT_FOUND", "请假申请不存在", 404);
  if (leave.status !== "PENDING") {
    throw new ApiError("CONFLICT", "只能撤销待审批的申请", 409);
  }

  await prisma.leaveRequest.delete({ where: { id: leaveId } });
  return leave;
}
