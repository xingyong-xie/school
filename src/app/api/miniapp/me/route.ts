import { handle, requireParent } from "@/lib/api";
import { prisma } from "@/lib/db";
import { ok } from "@/lib/json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const user = await requireParent();
    const children = await prisma.student.findMany({
      where: { parentId: user.id },
      select: {
        id: true,
        name: true,
        studentNo: true,
        class: {
          select: {
            id: true,
            name: true,
            teacher: { select: { user: { select: { name: true } } } },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return ok({
      user: { id: user.id, name: user.name },
      childrenCount: children.length,
      children: children.map((child) => ({
        id: child.id,
        name: child.name,
        studentNo: child.studentNo,
        className: child.class?.name ?? null,
        teacherName: child.class?.teacher?.user.name ?? null,
      })),
    });
  });
}
