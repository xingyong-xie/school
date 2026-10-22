import { handle, requireParent } from "@/lib/api";
import { prisma } from "@/lib/db";
import { ok } from "@/lib/json";
import { parentChildIds } from "@/lib/guards";
import {
  ATTENDANCE_LABELS,
  LEAVE_STATUS_LABELS,
  LEAVE_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
  categoryTone,
} from "@/lib/constants";
import { calcAge, fmtDate, monthStartString, todayString } from "@/lib/format";
import { buildChildFees, loadParentFinance } from "@/lib/services/parent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const user = await requireParent();
    const childIds = await parentChildIds(user.id);
    const today = todayString();
    const monthStart = monthStartString();

    const [children, monthAttendance, todayAttendance, pendingLeaves, finance] =
      await Promise.all([
        prisma.student.findMany({
          where: { id: { in: childIds } },
          include: {
            class: { include: { teacher: { include: { user: true } } } },
          },
          orderBy: { name: "asc" },
        }),
        prisma.attendance.findMany({
          where: { studentId: { in: childIds }, date: { gte: monthStart } },
          select: { studentId: true, status: true },
        }),
        prisma.attendance.findMany({
          where: { studentId: { in: childIds }, date: today },
        }),
        prisma.leaveRequest.findMany({
          where: { studentId: { in: childIds }, status: "PENDING" },
          include: { student: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
        }),
        loadParentFinance(childIds),
      ]);

    const todayByStudent = new Map(
      todayAttendance.map((item) => [item.studentId, item]),
    );

    const childCards = children.map((child) => {
      const monthRecords = monthAttendance.filter(
        (item) => item.studentId === child.id,
      );
      const monthPresentDays = monthRecords.filter(
        (item) => item.status === "PRESENT" || item.status === "LATE",
      ).length;
      const fees = buildChildFees(
        finance.feeItems,
        finance.payments,
        child.id,
        today,
      );
      const record = todayByStudent.get(child.id);

      return {
        id: child.id,
        name: child.name,
        studentNo: child.studentNo,
        className: child.class?.name ?? null,
        ageYears: calcAge(child.birthDate),
        teacherName: child.class?.teacher?.user.name ?? null,
        monthPresentDays,
        outstandingCents: fees.summary.totalOutstandingCents,
        todayStatus: record
          ? {
              status: record.status,
              label: ATTENDANCE_LABELS[record.status],
              tone: categoryTone(record.status),
              note: record.note,
            }
          : null,
      };
    });

    const monthPresentDays = childCards.reduce(
      (sum, child) => sum + child.monthPresentDays,
      0,
    );
    const outstandingCents = childCards.reduce(
      (sum, child) => sum + child.outstandingCents,
      0,
    );

    return ok({
      today,
      greetingName: user.name,
      stats: {
        childCount: childCards.length,
        monthPresentDays,
        monthRecordCount: monthAttendance.length,
        pendingLeaveCount: pendingLeaves.length,
        outstandingCents,
      },
      children: childCards,
      pendingLeaves: pendingLeaves.slice(0, 5).map((leave) => ({
        id: leave.id,
        studentName: leave.student.name,
        type: leave.type,
        typeLabel: LEAVE_TYPE_LABELS[leave.type],
        status: leave.status,
        statusLabel: LEAVE_STATUS_LABELS[leave.status],
        tone: categoryTone(leave.status),
        startDate: leave.startDate,
        endDate: leave.endDate,
      })),
      recentPayments: finance.payments.slice(0, 5).map((payment) => ({
        id: payment.id,
        feeItemName: payment.feeItem.name,
        studentName: payment.student.name,
        amountCents: payment.amountCents,
        method: payment.method,
        methodLabel: PAYMENT_METHOD_LABELS[payment.method] ?? payment.method,
        date: fmtDate(payment.paidAt),
      })),
    });
  });
}
