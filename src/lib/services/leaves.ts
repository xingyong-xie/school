import "server-only";

import type { LeaveStatus, LeaveType } from "@prisma/client";
import { ApiError } from "@/lib/api";
import type { SessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  teacherClassIds,
  userCanAccessStudent,
} from "@/lib/guards";

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

export type TeacherLeaveStatus = LeaveStatus | "ALL";

/** 教师负责班级范围内的请假列表与各状态计数。 */
export async function listTeacherLeaves(
  userId: number,
  status: TeacherLeaveStatus,
  classId?: number | null,
) {
  const classIds = await teacherClassIds(userId);
  const counts = { pending: 0, approved: 0, rejected: 0, all: 0 };
  if (classIds.length === 0) return { leaves: [], counts };

  const scope = {
    student: { classId: classId ?? { in: classIds } },
  };

  const [leaves, pending, approved, rejected, all] = await Promise.all([
    prisma.leaveRequest.findMany({
      where: {
        ...scope,
        ...(status === "ALL" ? {} : { status }),
      },
      include: {
        student: {
          select: {
            name: true,
            class: { select: { name: true } },
          },
        },
        requestedBy: { select: { name: true } },
        reviewedBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.leaveRequest.count({ where: { ...scope, status: "PENDING" } }),
    prisma.leaveRequest.count({ where: { ...scope, status: "APPROVED" } }),
    prisma.leaveRequest.count({ where: { ...scope, status: "REJECTED" } }),
    prisma.leaveRequest.count({ where: scope }),
  ]);

  counts.pending = pending;
  counts.approved = approved;
  counts.rejected = rejected;
  counts.all = all;

  // 待审批排在最前面，其余按创建时间倒序。
  leaves.sort((a, b) => {
    const rank = (item: typeof a) => (item.status === "PENDING" ? 0 : 1);
    return rank(a) - rank(b);
  });

  return { leaves, counts };
}

/** 审批请假；用条件更新避免并发重复审批。 */
export async function reviewLeaveRequest(input: {
  leaveId: number;
  decision: "APPROVED" | "REJECTED";
  reviewNote: string | null;
  reviewer: SessionUser;
}) {
  const { leaveId, decision, reviewNote, reviewer } = input;

  if (reviewer.role === "PARENT") {
    throw new ApiError("FORBIDDEN", "家长无权审批请假", 403);
  }
  if (reviewNote !== null && reviewNote.length > 200) {
    throw new ApiError("VALIDATION", "审批备注不能超过 200 个字符", 400);
  }

  const leave = await prisma.leaveRequest.findUnique({
    where: { id: leaveId },
    select: { id: true, studentId: true, status: true, student: { select: { name: true } } },
  });
  if (!leave) throw new ApiError("NOT_FOUND", "请假申请不存在", 404);
  if (leave.status !== "PENDING") {
    throw new ApiError("CONFLICT", "该申请已处理", 409);
  }
  if (!(await userCanAccessStudent(reviewer, leave.studentId))) {
    throw new ApiError("FORBIDDEN", "无权审批该申请", 403);
  }

  const result = await prisma.leaveRequest.updateMany({
    where: { id: leaveId, status: "PENDING" },
    data: {
      status: decision,
      reviewedById: reviewer.id,
      reviewedAt: new Date(),
      reviewNote,
    },
  });
  if (result.count === 0) {
    throw new ApiError("CONFLICT", "该申请已处理", 409);
  }

  return {
    id: leave.id,
    studentName: leave.student.name,
    decision,
  };
}
