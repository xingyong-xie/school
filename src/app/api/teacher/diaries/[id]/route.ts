import type { DiaryMood } from "@prisma/client";
import {
  assertOneOf,
  dateField,
  handle,
  intParam,
  readJson,
  requireTeacher,
  stringField,
} from "@/lib/api";
import { signMediaToken } from "@/lib/auth";
import { DIARY_MOODS } from "@/lib/constants";
import { ok } from "@/lib/json";
import {
  deleteDiaryEntry,
  getDiaryEntryForManage,
  updateDiaryEntry,
} from "@/lib/services/diaries";
import { diaryEntryView } from "../_view";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  return handle(async () => {
    const user = await requireTeacher();
    const entryId = intParam(params.id, "日记 ID");
    const entry = await getDiaryEntryForManage(user, entryId);
    return ok(await diaryEntryView(entry, user, signMediaToken(user)));
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  return handle(async () => {
    const user = await requireTeacher();
    const entryId = intParam(params.id, "日记 ID");
    const body = await readJson(request);

    const moodRaw = stringField(body, "mood", { optional: true });
    const mood = moodRaw
      ? (assertOneOf(moodRaw, DIARY_MOODS, "mood") as DiaryMood)
      : null;

    const entry = await updateDiaryEntry({
      author: user,
      entryId,
      fields: {
        date: dateField(body, "date"),
        title: stringField(body, "title", { max: 60, optional: true }) || null,
        content: stringField(body, "content", { max: 2000 }),
        mood,
      },
    });

    return ok(await diaryEntryView(entry, user, signMediaToken(user)));
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  return handle(async () => {
    const user = await requireTeacher();
    const entryId = intParam(params.id, "日记 ID");
    await deleteDiaryEntry(user, entryId);
    return ok({ deleted: true, id: entryId });
  });
}
