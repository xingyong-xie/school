import { handle, requireTeacher } from "@/lib/api";
import { ok } from "@/lib/json";
import { loadTeacherClasses } from "@/lib/services/teacher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const user = await requireTeacher();
    const classes = await loadTeacherClasses(user.id);

    return ok({
      user: { id: user.id, name: user.name },
      classes,
      defaultClassId: classes[0]?.id ?? null,
    });
  });
}
