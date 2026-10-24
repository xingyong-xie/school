"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { DiaryMood } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/guards";
import { int, str, withError, withSuccess } from "@/lib/forms";
import { DIARY_MOODS } from "@/lib/constants";
import {
  canManageDiaryEntry,
  canManageDiaryTarget,
  DIARY_DATE_PATTERN,
  MAX_PHOTOS,
  readPhotoInputs,
} from "@/lib/diary";

type DiaryTarget = {
  studentId: number | null;
  classId: number | null;
};

type DiaryFields = {
  date: string;
  title: string | null;
  content: string;
  mood: DiaryMood | null;
};

function readDiaryFields(
  formData: FormData,
): { ok: true; data: DiaryFields } | { ok: false; error: string } {
  const date = str(formData, "date").slice(0, 10);
  const title = str(formData, "title");
  const content = str(formData, "content");
  const mood = str(formData, "mood");

  if (!DIARY_DATE_PATTERN.test(date)) {
    return { ok: false, error: "请选择日记日期" };
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

  if (!(await canManageDiaryTarget(user, target))) {
    redirect(
      withError(
        back,
        target.classId !== null
          ? "无权为该班级写日记"
          : "无权为该幼儿写成长日记",
      ),
    );
  }

  const fields = readDiaryFields(formData);
  if (!fields.ok) redirect(withError(back, fields.error));

  const photoResult = await readPhotoInputs(formData);
  if (!photoResult.ok) redirect(withError(back, photoResult.error));

  if (target.studentId !== null) {
    const student = await prisma.student.findUnique({
      where: { id: target.studentId },
      select: { id: true },
    });
    if (!student) redirect(withError(back, "幼儿档案不存在"));
  } else if (target.classId !== null) {
    const schoolClass = await prisma.schoolClass.findUnique({
      where: { id: target.classId },
      select: { id: true },
    });
    if (!schoolClass) redirect(withError(back, "班级不存在"));
  }

  await prisma.diaryEntry.create({
    data: {
      studentId: target.studentId,
      classId: target.classId,
      ...fields.data,
      authorId: user.id,
      photos: {
        create: photoResult.photos.map((photo, index) => ({
          data: photo.data,
          mimeType: photo.mimeType,
          size: photo.size,
          sortOrder: index,
        })),
      },
    },
  });

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

  const entry = await prisma.diaryEntry.findUnique({
    where: { id },
    select: {
      id: true,
      studentId: true,
      classId: true,
      authorId: true,
      photos: { select: { id: true }, orderBy: { sortOrder: "asc" } },
    },
  });
  if (!entry) redirect(withError(back, "成长日记不存在"));
  if (!(await canManageDiaryEntry(user, entry))) {
    redirect(withError(back, "无权编辑该日记"));
  }

  const fields = readDiaryFields(formData);
  if (!fields.ok) redirect(withError(back, fields.error));

  const newPhotos = await readPhotoInputs(formData);
  if (!newPhotos.ok) redirect(withError(back, newPhotos.error));

  const ownedIds = new Set(entry.photos.map((photo) => photo.id));
  const removeIds = formData
    .getAll("removePhotoIds")
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0 && ownedIds.has(value));
  const removed = new Set(removeIds);
  const kept = entry.photos.filter((photo) => !removed.has(photo.id));

  if (kept.length + newPhotos.photos.length > MAX_PHOTOS) {
    redirect(withError(back, `每篇日记最多 ${MAX_PHOTOS} 张照片`));
  }

  await prisma.$transaction([
    prisma.diaryPhoto.deleteMany({
      where: { entryId: id, id: { in: removeIds } },
    }),
    ...kept.map((photo, index) =>
      prisma.diaryPhoto.update({
        where: { id: photo.id },
        data: { sortOrder: index },
      }),
    ),
    prisma.diaryEntry.update({
      where: { id },
      data: {
        ...fields.data,
        photos: {
          create: newPhotos.photos.map((photo, index) => ({
            data: photo.data,
            mimeType: photo.mimeType,
            size: photo.size,
            sortOrder: kept.length + index,
          })),
        },
      },
    }),
  ]);

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

  const entry = await prisma.diaryEntry.findUnique({
    where: { id },
    select: {
      id: true,
      studentId: true,
      classId: true,
      authorId: true,
      date: true,
    },
  });
  if (!entry) redirect(withError(back, "成长日记不存在"));
  if (!(await canManageDiaryEntry(user, entry))) {
    redirect(withError(back, "无权删除该日记"));
  }

  await prisma.diaryEntry.delete({ where: { id } });

  revalidatePath("/diaries");
  if (entry.studentId !== null) {
    revalidatePath(`/students/${entry.studentId}`);
  }
  revalidatePath("/");
  redirect(withSuccess(back, `已删除 ${entry.date} 的成长日记`));
}
