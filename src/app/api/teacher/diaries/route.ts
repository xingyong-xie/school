import type { DiaryMood } from "@prisma/client";
import {
  ApiError,
  assertOneOf,
  dateField,
  handle,
  idField,
  intParam,
  monthParam,
  readJson,
  requireTeacher,
  requireTeacherClass,
  requireTeacherStudent,
  stringField,
} from "@/lib/api";
import { signMediaToken } from "@/lib/auth";
import { DIARY_MOODS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import {
  diaryScopeWhere,
  diaryTargetWhere,
} from "@/lib/diary";
import { ok } from "@/lib/json";
import { createDiaryEntry } from "@/lib/services/diaries";
import { diaryEntryInclude, diaryEntryView } from "./_view";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handle(async () => {
    const user = await requireTeacher();
    const params = new URL(request.url).searchParams;
    const month = monthParam(params.get("month"));

    const rawStudentId = params.get("studentId");
    const rawClassId = params.get("classId");
    if (Boolean(rawStudentId) === Boolean(rawClassId)) {
      throw new ApiError(
        "VALIDATION",
        "请指定一个班级或一名幼儿",
        400,
      );
    }

    const studentId = rawStudentId
      ? await requireTeacherStudent(user, intParam(rawStudentId, "幼儿 ID"))
      : null;
    const classId = rawClassId
      ? await requireTeacherClass(user, intParam(rawClassId, "班级 ID"))
      : null;

    const scope = diaryScopeWhere(user);
    const where = {
      AND: [
        ...diaryTargetWhere({
          studentId: studentId ?? undefined,
          classId: classId ?? undefined,
        }),
        ...(scope ? [scope] : []),
        { date: { gte: `${month}-01`, lte: `${month}-31` } },
      ],
    };

    const entries = await prisma.diaryEntry.findMany({
      where,
      include: diaryEntryInclude,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 100,
    });

    const mediaToken = signMediaToken(user);
    const views = await Promise.all(
      entries.map((entry) => diaryEntryView(entry, user, mediaToken)),
    );

    return ok({
      month,
      target: {
        type: classId ? "CLASS" : "CHILD",
        classId,
        studentId,
      },
      summary: {
        entryCount: views.length,
        photoCount: views.reduce((sum, entry) => sum + entry.photos.length, 0),
        mineCount: views.filter((entry) => entry.isMine).length,
        lastEntryDate: views[0]?.date ?? null,
      },
      entries: views,
    });
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireTeacher();
    const body = await readJson(request);

    const hasStudent = body.studentId !== undefined && body.studentId !== null;
    const hasClass = body.classId !== undefined && body.classId !== null;
    if (hasStudent === hasClass) {
      throw new ApiError("VALIDATION", "请只选择一名幼儿或一个班级", 400);
    }
    const studentId = hasStudent ? idField(body, "studentId") : null;
    const classId = hasClass ? idField(body, "classId") : null;

    const moodRaw = stringField(body, "mood", { optional: true });
    const mood = moodRaw
      ? (assertOneOf(moodRaw, DIARY_MOODS, "mood") as DiaryMood)
      : null;

    const created = await createDiaryEntry({
      author: user,
      target: { studentId, classId },
      fields: {
        date: dateField(body, "date"),
        title: stringField(body, "title", { max: 60, optional: true }) || null,
        content: stringField(body, "content", { max: 2000 }),
        mood,
      },
    });

    const entry = await prisma.diaryEntry.findUnique({
      where: { id: created.id },
      include: diaryEntryInclude,
    });
    if (!entry) throw new ApiError("NOT_FOUND", "成长日记不存在", 404);

    return ok(
      await diaryEntryView(entry, user, signMediaToken(user)),
      201,
    );
  });
}
