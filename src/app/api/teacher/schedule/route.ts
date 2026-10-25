import { handle, requireTeacher } from "@/lib/api";
import { ok } from "@/lib/json";
import { getTeacherSchedule } from "@/lib/services/teacher";
import { resolveTeacherClass } from "../_utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handle(async () => {
    const user = await requireTeacher();
    const { classes, classId } = await resolveTeacherClass(
      user,
      new URL(request.url).searchParams.get("classId"),
    );

    if (classId === null) {
      return ok({
        classId: null,
        className: null,
        ageGroup: null,
        classes,
        weekdays: [1, 2, 3, 4, 5].map((weekday) => ({
          weekday,
          label: ["", "周一", "周二", "周三", "周四", "周五"][weekday],
          items: [],
        })),
      });
    }

    const data = await getTeacherSchedule(classId);
    return ok({ ...data, classes });
  });
}
