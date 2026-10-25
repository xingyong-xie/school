import { handle, intParam, requireTeacher } from "@/lib/api";
import { ok } from "@/lib/json";
import { removeDiaryPhoto } from "@/lib/services/diaries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; photoId: string } },
) {
  return handle(async () => {
    const user = await requireTeacher();
    const entryId = intParam(params.id, "日记 ID");
    const photoId = intParam(params.photoId, "照片 ID");

    const result = await removeDiaryPhoto({ author: user, entryId, photoId });
    return ok({ deleted: true, ...result });
  });
}
