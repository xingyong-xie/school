import "server-only";

import type { AttendanceStatus } from "@prisma/client";
import type { SessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  ATTENDANCE_LABELS,
  ATTENDANCE_OPTIONS,
  LEAVE_STATUS_LABELS,
  LEAVE_TYPE_LABELS,
  categoryTone,
} from "@/lib/constants";
import { diaryScopeWhere } from "@/lib/diary";
import { calcAge, monthStartString, todayString, weekdayLabel } from "@/lib/format";
import { buildChildFees, loadParentFinance } from "@/lib/services/parent";

export async function loadTeacherClasses(userId: number) {
  const teacher = await prisma.teacher.findUnique({
    where: { userId },
    select: {
      classes: {
        select: {
          id: true,
          name: true,
          ageGroup: true,
          room: true,
          _count: { select: { students: { where: { status: "ACTIVE" } } } },
        },
        orderBy: { name: "asc" },
      },
    },
  });

  return (teacher?.classes ?? []).map((item) => ({
    id: item.id,
    name: item.name,
    ageGroup: item.ageGroup,
    room: item.room,
    studentCount: item._count.students,
  }));
}

function summarizeAttendance(
  records: { status: AttendanceStatus }[],
) {
  const summary = {
    presentDays: 0,
    lateDays: 0,
    sickDays: 0,
    personalDays: 0,
    absentDays: 0,
    recordedDays: records.length,
  };
  for (const record of records) {
    switch (record.status) {
      case "PRESENT":
        summary.presentDays += 1;
        break;
      case "LATE":
        summary.lateDays += 1;
        break;
      case "SICK":
        summary.sickDays += 1;
        break;
      case "PERSONAL":
        summary.personalDays += 1;
        break;
      case "ABSENT":
        summary.absentDays += 1;
        break;
    }
  }
  return summary;
}

function leaveView(leave: {
  id: number;
  studentId: number;
  type: "SICK" | "PERSONAL" | "OTHER";
  status: "PENDING" | "APPROVED" | "REJECTED";
  startDate: string;
  endDate: string;
  reason: string;
  createdAt: Date;
  reviewNote: string | null;
  reviewedAt: Date | null;
  student: { name: string; class: { name: string } | null };
  requestedBy: { name: string } | null;
  reviewedBy: { name: string } | null;
}) {
  return {
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
    createdAt: leave.createdAt.toISOString(),
    requestedByName: leave.requestedBy?.name ?? null,
    reviewedByName: leave.reviewedBy?.name ?? null,
    reviewedAt: leave.reviewedAt?.toISOString() ?? null,
    reviewNote: leave.reviewNote,
    canReview: leave.status === "PENDING",
  };
}

export type TeacherLeaveView = ReturnType<typeof leaveView>;
export { leaveView };

/** 教师工作台：班级概览、今日考勤、待审批请假、最近日记。 */
export async function getTeacherDashboard(
  user: SessionUser,
  classId: number | null,
) {
  const today = todayString();
  const classes = await loadTeacherClasses(user.id);
  const selectedClassId = classId ?? classes[0]?.id ?? null;

  if (selectedClassId === null) {
    return {
      today,
      greetingName: user.name,
      classes,
      selectedClassId: null,
      selectedClassName: null,
      stats: {
        studentCount: 0,
        todayRecorded: 0,
        todayUnrecorded: 0,
        todayPresent: 0,
        pendingLeaveCount: 0,
        monthDiaryCount: 0,
      },
      todayStatusBreakdown: ATTENDANCE_OPTIONS.map((status) => ({
        status,
        label: ATTENDANCE_LABELS[status],
        tone: categoryTone(status),
        count: 0,
      })),
      leavesSummary: { pending: 0, approved: 0, rejected: 0, all: 0 },
      unrecorded: [],
      pendingLeaves: [],
      recentDiaries: [],
    };
  }

  const classIds = classes.map((item) => item.id);
  const monthStart = monthStartString();
  const scope = diaryScopeWhere(user);

  const [
    students,
    todayRecords,
    pendingLeaves,
    pendingLeaveCount,
    approvedCount,
    rejectedCount,
    monthDiaryCount,
    recentDiaries,
  ] = await Promise.all([
    prisma.student.findMany({
      where: { classId: selectedClassId, status: "ACTIVE" },
      select: { id: true, name: true, studentNo: true },
      orderBy: { studentNo: "asc" },
    }),
    prisma.attendance.findMany({
      where: { date: today, student: { classId: selectedClassId } },
      select: { studentId: true, status: true },
    }),
    prisma.leaveRequest.findMany({
      where: { status: "PENDING", student: { classId: { in: classIds } } },
      include: {
        student: {
          select: { name: true, class: { select: { name: true } } },
        },
        requestedBy: { select: { name: true } },
        reviewedBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.leaveRequest.count({
      where: { status: "PENDING", student: { classId: { in: classIds } } },
    }),
    prisma.leaveRequest.count({
      where: { status: "APPROVED", student: { classId: { in: classIds } } },
    }),
    prisma.leaveRequest.count({
      where: { status: "REJECTED", student: { classId: { in: classIds } } },
    }),
    prisma.diaryEntry.count({
      where: {
        date: { gte: monthStart },
        ...(scope ? { AND: [scope] } : {}),
      },
    }),
    prisma.diaryEntry.findMany({
      where: {
        OR: [
          { classId: selectedClassId },
          { student: { classId: selectedClassId } },
        ],
        ...(scope ? { AND: [scope] } : {}),
      },
      include: {
        student: { select: { name: true } },
        class: { select: { name: true } },
        _count: { select: { photos: true } },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 3,
    }),
  ]);

  const recordedIds = new Set(todayRecords.map((record) => record.studentId));
  const statusCounts = new Map<AttendanceStatus, number>();
  for (const record of todayRecords) {
    statusCounts.set(record.status, (statusCounts.get(record.status) ?? 0) + 1);
  }

  const unrecorded = students
    .filter((student) => !recordedIds.has(student.id))
    .map((student) => ({
      id: student.id,
      name: student.name,
      studentNo: student.studentNo,
    }));

  return {
    today,
    greetingName: user.name,
    classes,
    selectedClassId,
    selectedClassName:
      classes.find((item) => item.id === selectedClassId)?.name ?? null,
    stats: {
      studentCount: students.length,
      todayRecorded: todayRecords.length,
      todayUnrecorded: unrecorded.length,
      todayPresent: todayRecords.filter(
        (record) => record.status === "PRESENT" || record.status === "LATE",
      ).length,
      pendingLeaveCount,
      monthDiaryCount,
    },
    todayStatusBreakdown: ATTENDANCE_OPTIONS.map((status) => ({
      status,
      label: ATTENDANCE_LABELS[status],
      tone: categoryTone(status),
      count: statusCounts.get(status) ?? 0,
    })),
    leavesSummary: {
      pending: pendingLeaveCount,
      approved: approvedCount,
      rejected: rejectedCount,
      all: pendingLeaveCount + approvedCount + rejectedCount,
    },
    unrecorded,
    pendingLeaves: pendingLeaves.map(leaveView),
    recentDiaries: recentDiaries.map((entry) => ({
      id: entry.id,
      date: entry.date,
      title: entry.title,
      target: entry.classId !== null ? "CLASS" : "CHILD",
      studentName: entry.student?.name ?? null,
      className: entry.class?.name ?? null,
      photoCount: entry._count.photos,
    })),
  };
}

/** 班级花名册（含今日考勤状态）。 */
export async function listTeacherStudents(
  classId: number,
  status: "ACTIVE" | "ALL",
) {
  const today = todayString();
  const [schoolClass, students] = await Promise.all([
    prisma.schoolClass.findUnique({
      where: { id: classId },
      select: { id: true, name: true, ageGroup: true, room: true },
    }),
    prisma.student.findMany({
      where: {
        classId,
        ...(status === "ACTIVE" ? { status: "ACTIVE" } : {}),
      },
      select: {
        id: true,
        name: true,
        studentNo: true,
        gender: true,
        birthDate: true,
        status: true,
      },
      orderBy: { studentNo: "asc" },
    }),
  ]);

  const records = await prisma.attendance.findMany({
    where: { date: today, studentId: { in: students.map((item) => item.id) } },
    select: { studentId: true, status: true, note: true },
  });
  const recordByStudent = new Map(
    records.map((record) => [record.studentId, record]),
  );

  return {
    classId,
    className: schoolClass?.name ?? null,
    ageGroup: schoolClass?.ageGroup ?? null,
    room: schoolClass?.room ?? null,
    today,
    students: students.map((student) => {
      const record = recordByStudent.get(student.id);
      return {
        id: student.id,
        name: student.name,
        studentNo: student.studentNo,
        gender: student.gender,
        ageYears: calcAge(student.birthDate),
        status: student.status,
        todayStatus: record
          ? {
              status: record.status,
              label: ATTENDANCE_LABELS[record.status],
              tone: categoryTone(record.status),
              note: record.note,
            }
          : null,
      };
    }),
  };
}

/** 幼儿详情：档案、家长联系方式、本月考勤、最近日记。 */
export async function getTeacherStudent(userId: number, studentId: number) {
  const today = todayString();
  const monthStart = monthStartString();
  const scope = diaryScopeWhere({ id: userId, role: "TEACHER" });

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      class: {
        select: {
          id: true,
          name: true,
          ageGroup: true,
          room: true,
          teacher: { include: { user: { select: { name: true } } } },
        },
      },
      parent: { select: { name: true, phone: true, active: true } },
    },
  });
  if (!student) return null;

  const [monthRecords, todayRecord, recentDiaries] = await Promise.all([
    prisma.attendance.findMany({
      where: {
        studentId,
        date: { gte: `${monthStart.slice(0, 7)}-01`, lte: `${monthStart.slice(0, 7)}-31` },
      },
      select: { status: true },
    }),
    prisma.attendance.findUnique({
      where: { studentId_date: { studentId, date: today } },
      select: { status: true, note: true },
    }),
    prisma.diaryEntry.findMany({
      where: {
        studentId,
        ...(scope ? { AND: [scope] } : {}),
      },
      select: {
        id: true,
        date: true,
        title: true,
        mood: true,
        _count: { select: { photos: true } },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 3,
    }),
  ]);

  return {
    id: student.id,
    name: student.name,
    studentNo: student.studentNo,
    gender: student.gender,
    birthDate: student.birthDate.toISOString().slice(0, 10),
    ageYears: calcAge(student.birthDate),
    enrollmentDate: student.enrollmentDate.toISOString().slice(0, 10),
    status: student.status,
    phone: student.phone,
    address: student.address,
    notes: student.notes,
    className: student.class?.name ?? null,
    ageGroup: student.class?.ageGroup ?? null,
    room: student.class?.room ?? null,
    teacherName: student.class?.teacher?.user.name ?? null,
    parent: student.parent
      ? {
          name: student.parent.name,
          phone: student.parent.phone ?? student.phone,
          active: student.parent.active,
        }
      : null,
    todayStatus: todayRecord
      ? {
          status: todayRecord.status,
          label: ATTENDANCE_LABELS[todayRecord.status],
          tone: categoryTone(todayRecord.status),
          note: todayRecord.note,
        }
      : null,
    monthSummary: summarizeAttendance(monthRecords),
    recentDiaries: recentDiaries.map((entry) => ({
      id: entry.id,
      date: entry.date,
      title: entry.title,
      mood: entry.mood,
      photoCount: entry._count.photos,
    })),
  };
}

/** 班级周课表（周一至周五）。 */
export async function getTeacherSchedule(classId: number) {
  const [schoolClass, schedules] = await Promise.all([
    prisma.schoolClass.findUnique({
      where: { id: classId },
      select: { id: true, name: true, ageGroup: true },
    }),
    prisma.schedule.findMany({
      where: { classId },
      orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
    }),
  ]);

  return {
    classId,
    className: schoolClass?.name ?? null,
    ageGroup: schoolClass?.ageGroup ?? null,
    weekdays: [1, 2, 3, 4, 5].map((weekday) => ({
      weekday,
      label: weekdayLabel(weekday),
      items: schedules
        .filter((item) => item.weekday === weekday)
        .map((item) => ({
          id: item.id,
          startTime: item.startTime,
          endTime: item.endTime,
          subject: item.subject,
          teacherName: item.teacherName,
        })),
    })),
  };
}

/** 班级收费概览（只读）。 */
export async function getTeacherFinance(classId: number) {
  const [schoolClass, students] = await Promise.all([
    prisma.schoolClass.findUnique({
      where: { id: classId },
      select: { id: true, name: true },
    }),
    prisma.student.findMany({
      where: { classId, status: "ACTIVE" },
      select: { id: true, name: true, studentNo: true },
      orderBy: { studentNo: "asc" },
    }),
  ]);

  const today = todayString();
  const studentIds = students.map((student) => student.id);
  const finance = await loadParentFinance(studentIds);
  const perStudent = students.map((student) => {
    const fees = buildChildFees(
      finance.feeItems,
      finance.payments,
      student.id,
      today,
    );
    return {
      id: student.id,
      name: student.name,
      studentNo: student.studentNo,
      expectedCents: fees.summary.totalAmountCents,
      paidCents: fees.summary.totalPaidCents,
      outstandingCents: fees.summary.totalOutstandingCents,
      items: fees.items,
    };
  });

  const expectedCents =
    finance.feeItems.reduce((sum, item) => sum + item.amountCents, 0) *
    students.length;
  const paidCents = perStudent.reduce(
    (sum, student) => sum + student.paidCents,
    0,
  );
  const outstandingCents = perStudent.reduce(
    (sum, student) => sum + student.outstandingCents,
    0,
  );

  return {
    classId,
    className: schoolClass?.name ?? null,
    summary: {
      studentCount: students.length,
      feeItemCount: finance.feeItems.length,
      expectedCents,
      paidCents,
      outstandingCents,
      collectionRate:
        expectedCents > 0 ? Math.round((paidCents / expectedCents) * 100) : 0,
    },
    feeItems: finance.feeItems.map((item) => ({
      id: item.id,
      name: item.name,
      term: item.term,
      amountCents: item.amountCents,
      dueDate: item.dueDate,
    })),
    students: perStudent,
  };
}
