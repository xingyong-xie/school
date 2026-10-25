import {
  ApiError,
  assertOneOf,
  handle,
  intParam,
  readJson,
  requireTeacher,
  stringField,
} from "@/lib/api";
import { prisma } from "@/lib/db";
import { ok } from "@/lib/json";
import { reviewLeaveRequest } from "@/lib/services/leaves";
import { leaveView } from "@/lib/services/teacher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DECISIONS = ["APPROVED", "REJECTED"] as const;

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  return handle(async () => {
    const user = await requireTeacher();
    const leaveId = intParam(params.id, "请假 ID");
    const body = await readJson(request);

    const decision = assertOneOf(
      stringField(body, "decision"),
      DECISIONS,
      "decision",
    );
    const reviewNote =
      stringField(body, "reviewNote", { max: 200, optional: true }) || null;

    await reviewLeaveRequest({
      leaveId,
      decision,
      reviewNote,
      reviewer: user,
    });

    const updated = await prisma.leaveRequest.findUnique({
      where: { id: leaveId },
      include: {
        student: {
          select: { name: true, class: { select: { name: true } } },
        },
        requestedBy: { select: { name: true } },
        reviewedBy: { select: { name: true } },
      },
    });
    if (!updated) {
      throw new ApiError("NOT_FOUND", "请假申请不存在", 404);
    }

    return ok({ leave: leaveView(updated) });
  });
}
