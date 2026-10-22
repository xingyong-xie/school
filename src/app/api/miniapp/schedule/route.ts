import { ApiError, handle, requireParent } from "@/lib/api";
import { prisma } from "@/lib/db";
import { ok } from "@/lib/json";
import { weekdayLabel } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ClassView = {
  id: number;
  name: string;
  ageGroup: string;
  childNames: string[];
};

export async function GET(request: Request) {
  return handle(async () => {
    const user = await requireParent();
    const rawClassId = new URL(request.url).searchParams.get("classId");

    const children = await prisma.student.findMany({
      where: { parentId: user.id, classId: { not: null } },
      select: {
        name: true,
        class: { select: { id: true, name: true, ageGroup: true } },
      },
      orderBy: { name: "asc" },
    });

    const classMap = new Map<number, ClassView>();
    for (const child of children) {
      if (!child.class) continue;
      const existing = classMap.get(child.class.id);
      if (existing) {
        existing.childNames.push(child.name);
      } else {
        classMap.set(child.class.id, {
          id: child.class.id,
          name: child.class.name,
          ageGroup: child.class.ageGroup,
          childNames: [child.name],
        });
      }
    }
    const classes = Array.from(classMap.values());

    let classId: number | null = classes[0]?.id ?? null;
    if (rawClassId) {
      const parsed = Number(rawClassId);
      if (!Number.isInteger(parsed) || !classMap.has(parsed)) {
        throw new ApiError("NOT_FOUND", "班级不存在", 404);
      }
      classId = parsed;
    }

    const schedules = classId
      ? await prisma.schedule.findMany({
          where: { classId },
          orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
        })
      : [];
    const selected = classId ? classMap.get(classId) : null;

    return ok({
      classes,
      classId,
      className: selected?.name ?? null,
      ageGroup: selected?.ageGroup ?? null,
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
    });
  });
}
