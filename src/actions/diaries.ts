"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { DiaryMood } from "@prisma/client";
import { ApiError } from "@/lib/api";
import { requireUser } from "@/lib/guards";
import { int, str, withError, withSuccess } from "@/lib/forms";
import { DIARY_MOODS } from "@/lib/constants";
import { isValidDateString } from "@/lib/format";
import { readPhotoInputs } from "@/lib/diary";
import {
  createDiaryEntry,
  deleteDiaryEntry,
  updateDiaryEntry,
  type DiaryFields,
  type DiaryTarget,
} from "@/lib/services/diaries";

function readDiaryFields(
  formData: FormData,
): { ok: true; data: DiaryFields } | { ok: false; error: string } {
  const date = str(formData, "date").slice(0, 10);
  const title = str(formData, "title");
  const content = str(formData, "content");
  const mood = str(formData, "mood");

  if (!isValidDateString(date)) {
    return { ok: false, error: "请选择有效的日记日期" };
  }
  if (title.length > 60) {
    return { ok: false, error: "标题不能超过 60 个字符" };
  }
  if (!content) {
    return { ok: false, error: "请填写日记内容" };
  }
  if (content.length > 2000) {
    return { ok: false, error: "日记内容不能超过 2000 个字符" };
  }
  if (mood && !DIARY_MOODS.includes(mood as DiaryMood)) {
    return { ok: false, error: "心情标签无效" };
  }

  return {
    ok: true,
    data: {
      date,
      title: title || null,
      content,
      mood: mood ? (mood as DiaryMood) : null,
    },
  };
}

function readDiaryTarget(
  formData: FormData,
): { ok: true; target: DiaryTarget } | { ok: false; error: string } {
  const studentId = int(formData, "studentId");
  const classId = int(formData, "classId");

  if (studentId !== null && classId !== null) {
    return { ok: false, error: "请只选择一名幼儿或一个班级" };
  }
  if (studentId === null && classId === null) {
    return { ok: false, error: "请选择幼儿或班级" };
  }
  if (studentId !== null && studentId <= 0) {
    return { ok: false, error: "幼儿无效" };
  }
  if (classId !== null && classId <= 0) {
    return { ok: false, error: "班级无效" };
  }

  return {
    ok: true,
    target:
      studentId !== null
        ? { studentId, classId: null }
        : { studentId: null, classId },
  };
}

/** 仅允许跳回日记页或幼儿详情页，避免开放重定向。 */
function backPath(formData: FormData): string {
  const raw = str(formData, "returnTo");
  if (/^\/diaries(\?.*)?$/.test(raw)) return raw;
  if (/^\/students\/\d+(\?.*)?$/.test(raw)) return raw;
  return "/diaries";
}

export async function createDiary(formData: FormData): Promise<void> {
  const user = await requireUser();
  const back = backPath(formData);

  const targetResult = readDiaryTarget(formData);
  if (!targetResult.ok) redirect(withError(back, targetResult.error));
  const { target } = targetResult;

  const fields = readDiaryFields(formData);
  if (!fields.ok) redirect(withError(back, fields.error));

  const photoResult = await readPhotoInputs(formData);
  if (!photoResult.ok) redirect(withError(back, photoResult.error));

  try {
    await createDiaryEntry({
      author: user,
      target,
      fields: fields.data,
      photos: photoResult.photos,
    });
  } catch (error) {
    if (error instanceof ApiError) redirect(withError(back, error.message));
    throw error;
  }

  revalidatePath("/diaries");
  if (target.studentId !== null) {
    revalidatePath(`/students/${target.studentId}`);
  }
  revalidatePath("/");
  redirect(
    withSuccess(
      back,
      target.classId !== null ? "班级日记已发布" : "成长日记已发布",
    ),
  );
}

export async function updateDiary(formData: FormData): Promise<void> {
  const user = await requireUser();
  const back = backPath(formData);

  const id = int(formData, "id");
  if (!id) redirect(withError(back, "参数错误"));

  const fields = readDiaryFields(formData);
  if (!fields.ok) redirect(withError(back, fields.error));

  const newPhotos = await readPhotoInputs(formData);
  if (!newPhotos.ok) redirect(withError(back, newPhotos.error));

  const removePhotoIds = formData
    .getAll("removePhotoIds")
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);

  let entry: Awaited<ReturnType<typeof updateDiaryEntry>>;
  try {
    entry = await updateDiaryEntry({
      author: user,
      entryId: id,
      fields: fields.data,
      newPhotos: newPhotos.photos,
      removePhotoIds,
    });
  } catch (error) {
    if (error instanceof ApiError) redirect(withError(back, error.message));
    throw error;
  }

  revalidatePath("/diaries");
  if (entry.studentId !== null) {
    revalidatePath(`/students/${entry.studentId}`);
  }
  revalidatePath("/");
  redirect(withSuccess(back, "成长日记已更新"));
}

export async function deleteDiary(formData: FormData): Promise<void> {
  const user = await requireUser();
  const back = backPath(formData);

  const id = int(formData, "id");
  if (!id) redirect(withError(back, "参数错误"));

  let entry: Awaited<ReturnType<typeof deleteDiaryEntry>>;
  try {
    entry = await deleteDiaryEntry(user, id);
  } catch (error) {
    if (error instanceof ApiError) redirect(withError(back, error.message));
    throw error;
  }

  revalidatePath("/diaries");
  if (entry.studentId !== null) {
    revalidatePath(`/students/${entry.studentId}`);
  }
  revalidatePath("/");
  redirect(withSuccess(back, `已删除 ${entry.date} 的成长日记`));
}
