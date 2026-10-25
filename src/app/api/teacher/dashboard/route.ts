import { handle, intParam, requireTeacher, requireTeacherClass } from "@/lib/api";
import { ok } from "@/lib/json";
import { getTeacherDashboard } from "@/lib/services/teacher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handle(async () => {
    const user = await requireTeacher();
    const rawClassId = new URL(request.url).searchParams.get("classId");
    const classId =
      rawClassId === null || rawClassId === ""
        ? null
        : await requireTeacherClass(user, intParam(rawClassId, "classId"));

    const data = await getTeacherDashboard(user, classId);
    return ok(data);
  });
}
