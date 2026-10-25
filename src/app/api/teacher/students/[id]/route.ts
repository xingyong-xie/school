import {
  ApiError,
  handle,
  intParam,
  requireTeacher,
  requireTeacherStudent,
} from "@/lib/api";
import { ok } from "@/lib/json";
import { getTeacherStudent } from "@/lib/services/teacher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  return handle(async () => {
    const user = await requireTeacher();
    const studentId = await requireTeacherStudent(
      user,
      intParam(params.id, "幼儿 ID"),
    );

    const data = await getTeacherStudent(user.id, studentId);
    if (!data) throw new ApiError("NOT_FOUND", "幼儿档案不存在", 404);
    return ok(data);
  });
}
