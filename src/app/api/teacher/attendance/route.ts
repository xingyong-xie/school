import type { AttendanceStatus } from "@prisma/client";
import {
  ApiError,
  assertOneOf,
  dateField,
  handle,
  idField,
  readJson,
  requireTeacher,
  requireTeacherClass,
  stringField,
} from "@/lib/api";
import { ok } from "@/lib/json";
import { ATTENDANCE_OPTIONS } from "@/lib/constants";
import {
  listAttendanceForDate,
  saveClassAttendance,
} from "@/lib/services/attendance";
import { dateParam, resolveTeacherClass } from "../_utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handle(async () => {
    const user = await requireTeacher();
    const url = new URL(request.url);
    const { classes, classId } = await resolveTeacherClass(
      user,
      url.searchParams.get("classId"),
    );
    if (classId === null) {
      return ok({
        classId: null,
        className: null,
        date: dateParam(url.searchParams.get("date")),
        classes,
        students: [],
        summary: { total: 0, recorded: 0, presentOrLate: 0 },
      });
    }

    const date = dateParam(url.searchParams.get("date"));
    const data = await listAttendanceForDate(classId, date);

    return ok({
      classId,
      className: classes.find((item) => item.id === classId)?.name ?? null,
      date,
      classes,
      ...data,
    });
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireTeacher();
    const body = await readJson(request);

    const classId = await requireTeacherClass(user, idField(body, "classId"));
    const date = dateField(body, "date");

    const rawRows = body.rows;
    if (!Array.isArray(rawRows) || rawRows.length === 0) {
      throw new ApiError("VALIDATION", "请至少提交一条考勤记录", 400);
    }

    const rows = rawRows.map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        throw new ApiError("VALIDATION", "考勤记录格式不正确", 400);
      }
      const row = item as Record<string, unknown>;
      const studentId = idField(row, "studentId");
      const status = assertOneOf(
        stringField(row, "status"),
        ATTENDANCE_OPTIONS,
        "status",
      ) as AttendanceStatus;
      const note = stringField(row, "note", { max: 200, optional: true }) || null;
      return { studentId, status, note };
    });

    const saved = await saveClassAttendance({
      classId,
      date,
      rows,
      recordedById: user.id,
    });

    return ok({ saved, classId, date });
  });
}
