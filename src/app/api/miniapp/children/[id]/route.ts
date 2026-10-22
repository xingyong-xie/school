import { ApiError, handle, requireChild, requireParent } from "@/lib/api";
import { prisma } from "@/lib/db";
import { ok } from "@/lib/json";
import {
  GENDER_LABELS,
  STUDENT_STATUS_LABELS,
} from "@/lib/constants";
import { calcAge, fmtDate } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  return handle(async () => {
    const user = await requireParent();
    const child = await requireChild(user, Number(params.id));
    const detail = await prisma.student.findUnique({
      where: { id: child.id },
      include: { class: { include: { teacher: { include: { user: true } } } } },
    });
    if (!detail) throw new ApiError("NOT_FOUND", "孩子档案不存在", 404);

    return ok({
      id: detail.id,
      name: detail.name,
      studentNo: detail.studentNo,
      gender: detail.gender,
      genderLabel: GENDER_LABELS[detail.gender],
      birthDate: fmtDate(detail.birthDate),
      ageYears: calcAge(detail.birthDate),
      enrollmentDate: fmtDate(detail.enrollmentDate),
      status: detail.status,
      statusLabel: STUDENT_STATUS_LABELS[detail.status],
      className: detail.class?.name ?? null,
      ageGroup: detail.class?.ageGroup ?? null,
      teacherName: detail.class?.teacher?.user.name ?? null,
      phone: detail.phone,
      address: detail.address,
    });
  });
}
