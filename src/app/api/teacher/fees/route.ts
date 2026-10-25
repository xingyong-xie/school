import { handle, requireTeacher } from "@/lib/api";
import { ok } from "@/lib/json";
import { getTeacherFinance } from "@/lib/services/teacher";
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
        classes,
        summary: {
          studentCount: 0,
          feeItemCount: 0,
          expectedCents: 0,
          paidCents: 0,
          outstandingCents: 0,
          collectionRate: 0,
        },
        feeItems: [],
        students: [],
      });
    }

    const data = await getTeacherFinance(classId);
    return ok({ ...data, classes });
  });
}
