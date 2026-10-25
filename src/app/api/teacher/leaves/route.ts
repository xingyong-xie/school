import {
  assertOneOf,
  handle,
  intParam,
  requireTeacher,
  requireTeacherClass,
} from "@/lib/api";
import { ok } from "@/lib/json";
import {
  listTeacherLeaves,
  type TeacherLeaveStatus,
} from "@/lib/services/leaves";
import { leaveView } from "@/lib/services/teacher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES = ["ALL", "PENDING", "APPROVED", "REJECTED"] as const;

export async function GET(request: Request) {
  return handle(async () => {
    const user = await requireTeacher();
    const params = new URL(request.url).searchParams;

    const status = assertOneOf(
      (params.get("status") ?? "ALL").toUpperCase(),
      STATUSES,
      "status",
    ) as TeacherLeaveStatus;

    const rawClassId = params.get("classId");
    const classId =
      rawClassId === null || rawClassId === ""
        ? null
        : await requireTeacherClass(user, intParam(rawClassId, "classId"));

    const { leaves, counts } = await listTeacherLeaves(
      user.id,
      status,
      classId,
    );

    return ok({
      status,
      counts,
      leaves: leaves.map(leaveView),
    });
  });
}
