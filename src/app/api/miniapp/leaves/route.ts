import type { LeaveStatus } from "@prisma/client";
import {
  ApiError,
  assertOneOf,
  dateField,
  handle,
  idField,
  readJson,
  requireChild,
  requireParent,
  stringField,
} from "@/lib/api";
import { prisma } from "@/lib/db";
import { ok } from "@/lib/json";
import {
  LEAVE_STATUS_LABELS,
  LEAVE_TYPE_LABELS,
  categoryTone,
} from "@/lib/constants";
import { fmtDate } from "@/lib/format";
import {
  LEAVE_TYPES,
  createLeaveForParent,
} from "@/lib/services/leaves";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS_FILTERS = ["ALL", "PENDING", "APPROVED", "REJECTED"] as const;

export async function GET(request: Request) {
  return handle(async () => {
    const user = await requireParent();
    const rawStatus =
      new URL(request.url).searchParams.get("status")?.toUpperCase() ?? "ALL";
    const status = assertOneOf(rawStatus, STATUS_FILTERS, "status");
    const statusWhere: LeaveStatus | undefined =
      status === "ALL" ? undefined : status;

    const [pending, approved, rejected, total, children, leaves] =
      await Promise.all([
        prisma.leaveRequest.count({
          where: { student: { parentId: user.id }, status: "PENDING" },
        }),
        prisma.leaveRequest.count({
          where: { student: { parentId: user.id }, status: "APPROVED" },
        }),
        prisma.leaveRequest.count({
          where: { student: { parentId: user.id }, status: "REJECTED" },
        }),
        prisma.leaveRequest.count({
          where: { student: { parentId: user.id } },
        }),
        prisma.student.findMany({
          where: { parentId: user.id },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        }),
        prisma.leaveRequest.findMany({
          where: {
            student: { parentId: user.id },
            ...(statusWhere ? { status: statusWhere } : {}),
          },
          include: {
            student: {
              select: { name: true, class: { select: { name: true } } },
            },
            reviewedBy: { select: { name: true } },
          },
          orderBy: { createdAt: "desc" },
        }),
      ]);

    return ok({
      status,
      counts: { pending, approved, rejected, all: total },
      children,
      leaves: leaves.map((leave) => ({
        id: leave.id,
        studentId: leave.studentId,
        studentName: leave.student.name,
        className: leave.student.class?.name ?? null,
        type: leave.type,
        typeLabel: LEAVE_TYPE_LABELS[leave.type],
        status: leave.status,
        statusLabel: LEAVE_STATUS_LABELS[leave.status],
        tone: categoryTone(leave.status),
        startDate: leave.startDate,
        endDate: leave.endDate,
        reason: leave.reason,
        createdAt: fmtDate(leave.createdAt),
        reviewedByName: leave.reviewedBy?.name ?? null,
        reviewedAt: leave.reviewedAt ? fmtDate(leave.reviewedAt) : null,
        reviewNote: leave.reviewNote,
        canCancel: leave.status === "PENDING",
      })),
    });
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireParent();
    const body = await readJson(request);

    const studentId = idField(body, "studentId");
    const type = assertOneOf(
      stringField(body, "type", { max: 16 }),
      LEAVE_TYPES,
      "type",
    );
    const startDate = dateField(body, "startDate");
    const endDate = dateField(body, "endDate");
    const reason = stringField(body, "reason", { max: 200 });

    if (endDate < startDate) {
      throw new ApiError("VALIDATION", "结束日期不能早于开始日期", 400, [
        { field: "endDate", message: "结束日期不能早于开始日期" },
      ]);
    }

    const child = await requireChild(user, studentId);
    const leave = await createLeaveForParent(user.id, {
      studentId,
      type,
      startDate,
      endDate,
      reason,
    });

    return ok(
      {
        leave: {
          id: leave.id,
          studentId: child.id,
          studentName: child.name,
          type: leave.type,
          typeLabel: LEAVE_TYPE_LABELS[leave.type],
          status: leave.status,
          statusLabel: LEAVE_STATUS_LABELS[leave.status],
          tone: categoryTone(leave.status),
          startDate: leave.startDate,
          endDate: leave.endDate,
          reason: leave.reason,
          canCancel: true,
        },
      },
      201,
    );
  });
}
