import "server-only";

import type { AttendanceStatus } from "@prisma/client";
import { ApiError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { ATTENDANCE_LABELS, ATTENDANCE_OPTIONS, categoryTone } from "@/lib/constants";
import { isValidDateString } from "@/lib/format";

export type AttendanceRow = {
  studentId: number;
  status: AttendanceStatus;
  note: string | null;
};

/** 登记某班某天的考勤；调用方负责鉴权与班级范围校验。 */
export async function saveClassAttendance(input: {
  classId: number;
  date: string;
  rows: AttendanceRow[];
  recordedById: number;
}): Promise<number> {
  const { classId, date, rows, recordedById } = input;

  if (!isValidDateString(date)) {
    throw new ApiError("VALIDATION", "日期无效，请重新选择", 400);
  }
  if (rows.length === 0) {
    throw new ApiError("VALIDATION", "没有可保存的考勤数据", 400);
  }
  if (rows.length > 200) {
    throw new ApiError("VALIDATION", "一次最多保存 200 条考勤记录", 400);
  }

  const seen = new Set<number>();
  for (const row of rows) {
    if (!Number.isInteger(row.studentId) || row.studentId <= 0) {
      throw new ApiError("VALIDATION", "幼儿 ID 无效", 400);
    }
    if (seen.has(row.studentId)) {
      throw new ApiError("VALIDATION", "考勤记录中存在重复幼儿", 400);
    }
    seen.add(row.studentId);
    if (!ATTENDANCE_OPTIONS.includes(row.status)) {
      throw new ApiError("VALIDATION", "考勤状态无效", 400);
    }
    if (row.note !== null && row.note.length > 200) {
      throw new ApiError("VALIDATION", "备注不能超过 200 个字符", 400);
    }
  }

  const students = await prisma.student.findMany({
    where: { classId, status: "ACTIVE" },
    select: { id: true },
  });
  if (students.length === 0) {
    throw new ApiError("VALIDATION", "该班级暂无在园幼儿", 400);
  }
  const allowed = new Set(students.map((student) => student.id));
  for (const row of rows) {
    if (!allowed.has(row.studentId)) {
      throw new ApiError("VALIDATION", "考勤记录中包含非本班在园幼儿", 400);
    }
  }

  await prisma.$transaction(
    rows.map((row) =>
      prisma.attendance.upsert({
        where: { studentId_date: { studentId: row.studentId, date } },
        create: {
          studentId: row.studentId,
          date,
          status: row.status,
          note: row.note,
          recordedById,
        },
        update: {
          status: row.status,
          note: row.note,
          recordedById,
        },
      }),
    ),
  );

  return rows.length;
}

/** 某班某天的花名册与已登记考勤。 */
export async function listAttendanceForDate(classId: number, date: string) {
  const students = await prisma.student.findMany({
    where: { classId, status: "ACTIVE" },
    select: { id: true, name: true, studentNo: true },
    orderBy: { studentNo: "asc" },
  });
  const records = await prisma.attendance.findMany({
    where: { studentId: { in: students.map((student) => student.id) }, date },
    include: { recordedBy: { select: { name: true } } },
  });
  const recordByStudent = new Map(
    records.map((record) => [record.studentId, record]),
  );

  const roster = students.map((student) => {
    const record = recordByStudent.get(student.id);
    return {
      id: student.id,
      name: student.name,
      studentNo: student.studentNo,
      status: record?.status ?? null,
      statusLabel: record ? ATTENDANCE_LABELS[record.status] : null,
      tone: record ? categoryTone(record.status) : "gray",
      note: record?.note ?? null,
      recorded: Boolean(record),
      recordedByName: record?.recordedBy?.name ?? null,
    };
  });

  return {
    students: roster,
    summary: {
      total: roster.length,
      recorded: roster.filter((item) => item.recorded).length,
      presentOrLate: roster.filter(
        (item) => item.status === "PRESENT" || item.status === "LATE",
      ).length,
    },
  };
}
