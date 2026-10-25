import {
  ApiError,
  handle,
  intParam,
  readJson,
  requireTeacher,
} from "@/lib/api";
import { signMediaToken } from "@/lib/auth";
import { decodeImageBase64, diaryMediaUrl } from "@/lib/diary";
import { ok } from "@/lib/json";
import { addDiaryPhoto } from "@/lib/services/diaries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PHOTO_BODY_BYTES = 3 * 1024 * 1024;

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  return handle(async () => {
    const user = await requireTeacher();
    const entryId = intParam(params.id, "日记 ID");
    const body = await readJson(request, { maxBytes: MAX_PHOTO_BODY_BYTES });

    const decoded = decodeImageBase64(body.dataBase64);
    if (!decoded.ok) {
      throw new ApiError("VALIDATION", decoded.error, 400);
    }

    const photo = await addDiaryPhoto({
      author: user,
      entryId,
      photo: decoded.photo,
    });

    return ok(
      {
        photo: {
          id: photo.id,
          sortOrder: photo.sortOrder,
          url: diaryMediaUrl(photo.id, signMediaToken(user)),
        },
      },
      201,
    );
  });
}
