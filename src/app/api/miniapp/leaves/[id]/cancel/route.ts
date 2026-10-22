import { handle, intParam, requireParent } from "@/lib/api";
import { ok } from "@/lib/json";
import { cancelLeaveForParent } from "@/lib/services/leaves";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
) {
  return handle(async () => {
    const user = await requireParent();
    const leaveId = intParam(params.id);
    const leave = await cancelLeaveForParent(user.id, leaveId);
    return ok({ cancelled: true, id: leave.id });
  });
}
