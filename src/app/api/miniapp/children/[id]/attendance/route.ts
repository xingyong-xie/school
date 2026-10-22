import { handle, monthParam, requireChild, requireParent } from "@/lib/api";
import { prisma } from "@/lib/db";
import { ok } from "@/lib/json";
import { ATTENDANCE_LABELS, categoryTone } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  return handle(async () => {
    const user = await requireParent();
    const child = await requireChild(user, Number(params.id));
    const month = monthParam(new URL(request.url).searchParams.get("month"));

    const records = await prisma.attendance.findMany({
      where: {
        studentId: child.id,
        date: { gte: `${month}-01`, lte: `${month}-31` },
      },
      orderBy: { date: "desc" },
    });

    const summary = {
      presentDays: 0,
      lateDays: 0,
      sickDays: 0,
      personalDays: 0,
      absentDays: 0,
      recordedDays: records.length,
    };
    for (const record of records) {
      switch (record.status) {
        case "PRESENT":
          summary.presentDays += 1;
          break;
        case "LATE":
          summary.lateDays += 1;
          break;
        case "SICK":
          summary.sickDays += 1;
          break;
        case "PERSONAL":
          summary.personalDays += 1;
          break;
        case "ABSENT":
          summary.absentDays += 1;
          break;
      }
    }

    return ok({
      month,
      child: { id: child.id, name: child.name },
      summary,
      records: records.map((record) => ({
        id: record.id,
        date: record.date,
        status: record.status,
        label: ATTENDANCE_LABELS[record.status],
        tone: categoryTone(record.status),
        note: record.note,
      })),
    });
  });
}
