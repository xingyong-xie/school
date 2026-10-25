import { assertOneOf, handle, requireTeacher } from "@/lib/api";
import { ok } from "@/lib/json";
import { listTeacherStudents } from "@/lib/services/teacher";
import { resolveTeacherClass } from "../_utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES = ["ACTIVE", "ALL"] as const;

export async function GET(request: Request) {
  return handle(async () => {
    const user = await requireTeacher();
    const params = new URL(request.url).searchParams;
    const { classes, classId } = await resolveTeacherClass(
      user,
      params.get("classId"),
    );
    const status = assertOneOf(
      (params.get("status") ?? "ACTIVE").toUpperCase(),
      STATUSES,
      "status",
    );

    if (classId === null) {
      return ok({
        classId: null,
        className: null,
        ageGroup: null,
        room: null,
        today: null,
        classes,
        students: [],
      });
    }

    const data = await listTeacherStudents(classId, status);
    return ok({ ...data, classes });
  });
}
