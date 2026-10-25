import "server-only";

import type { DiaryMood } from "@prisma/client";
import { ApiError } from "@/lib/api";
import type { SessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  canManageDiaryEntry,
  canManageDiaryTarget,
  MAX_PHOTOS,
  type PhotoInput,
} from "@/lib/diary";

export type DiaryTarget = {
  studentId: number | null;
  classId: number | null;
};

export type DiaryFields = {
  date: string;
  title: string | null;
  content: string;
  mood: DiaryMood | null;
};

function assertTarget(target: DiaryTarget): void {
  if (target.studentId !== null && target.classId !== null) {
    throw new ApiError("VALIDATION", "请只选择一名幼儿或一个班级", 400);
  }
  if (target.studentId === null && target.classId === null) {
    throw new ApiError("VALIDATION", "请选择幼儿或班级", 400);
  }
}

async function assertTargetExists(target: DiaryTarget): Promise<void> {
  if (target.studentId !== null) {
    const student = await prisma.student.findUnique({
      where: { id: target.studentId },
      select: { id: true },
    });
    if (!student) throw new ApiError("NOT_FOUND", "幼儿档案不存在", 404);
    return;
  }
  const schoolClass = await prisma.schoolClass.findUnique({
    where: { id: target.classId! },
    select: { id: true },
  });
  if (!schoolClass) throw new ApiError("NOT_FOUND", "班级不存在", 404);
}

/** 创建日记；Web 可一次内嵌照片，小程序则先建文本再逐张追加。 */
export async function createDiaryEntry(input: {
  author: SessionUser;
  target: DiaryTarget;
  fields: DiaryFields;
  photos?: PhotoInput[];
}) {
  const { author, target, fields } = input;
  const photos = input.photos ?? [];

  assertTarget(target);
  if (!(await canManageDiaryTarget(author, target))) {
    throw new ApiError(
      "FORBIDDEN",
      target.classId !== null ? "无权为该班级写日记" : "无权为该幼儿写成长日记",
      403,
    );
  }
  if (photos.length > MAX_PHOTOS) {
    throw new ApiError("VALIDATION", `每篇日记最多 ${MAX_PHOTOS} 张照片`, 400);
  }
  await assertTargetExists(target);

  return prisma.diaryEntry.create({
    data: {
      studentId: target.studentId,
      classId: target.classId,
      ...fields,
      authorId: author.id,
      photos: {
        create: photos.map((photo, index) => ({
          data: photo.data,
          mimeType: photo.mimeType,
          size: photo.size,
          sortOrder: index,
        })),
      },
    },
  });
}

/** 加载可编辑的日记；不存在 → 404，越权 → 403。 */
export async function getDiaryEntryForManage(
  author: SessionUser,
  entryId: number,
) {
  const entry = await prisma.diaryEntry.findUnique({
    where: { id: entryId },
    include: {
      student: { select: { id: true, name: true } },
      class: { select: { id: true, name: true } },
      author: { select: { id: true, name: true } },
      photos: {
        select: { id: true, sortOrder: true, mimeType: true, size: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
  if (!entry) throw new ApiError("NOT_FOUND", "成长日记不存在", 404);
  if (!(await canManageDiaryEntry(author, entry))) {
    throw new ApiError("FORBIDDEN", "无权编辑该日记", 403);
  }
  return entry;
}

/** 更新日记文本与照片；目标不可修改。 */
export async function updateDiaryEntry(input: {
  author: SessionUser;
  entryId: number;
  fields: DiaryFields;
  newPhotos?: PhotoInput[];
  removePhotoIds?: number[];
}) {
  const { author, entryId, fields } = input;
  const newPhotos = input.newPhotos ?? [];
  const entry = await getDiaryEntryForManage(author, entryId);

  const ownedIds = new Set(entry.photos.map((photo) => photo.id));
  const removeIds = (input.removePhotoIds ?? []).filter((id) => ownedIds.has(id));
  const removed = new Set(removeIds);
  const kept = entry.photos.filter((photo) => !removed.has(photo.id));

  if (kept.length + newPhotos.length > MAX_PHOTOS) {
    throw new ApiError("VALIDATION", `每篇日记最多 ${MAX_PHOTOS} 张照片`, 400);
  }

  await prisma.$transaction([
    prisma.diaryPhoto.deleteMany({
      where: { entryId, id: { in: removeIds } },
    }),
    ...kept.map((photo, index) =>
      prisma.diaryPhoto.update({
        where: { id: photo.id },
        data: { sortOrder: index },
      }),
    ),
    prisma.diaryEntry.update({
      where: { id: entryId },
      data: {
        ...fields,
        photos: {
          create: newPhotos.map((photo, index) => ({
            data: photo.data,
            mimeType: photo.mimeType,
            size: photo.size,
            sortOrder: kept.length + index,
          })),
        },
      },
    }),
  ]);

  // 事务完成后重新读取，避免接口返回更新前的旧数据。
  return getDiaryEntryForManage(author, entryId);
}

/** 删除日记（照片级联删除）。 */
export async function deleteDiaryEntry(
  author: SessionUser,
  entryId: number,
) {
  const entry = await getDiaryEntryForManage(author, entryId);
  await prisma.diaryEntry.delete({ where: { id: entryId } });
  return entry;
}

/** 向已有日记追加一张照片。 */
export async function addDiaryPhoto(input: {
  author: SessionUser;
  entryId: number;
  photo: PhotoInput;
}) {
  const { author, entryId, photo } = input;
  await getDiaryEntryForManage(author, entryId);

  const photos = await prisma.diaryPhoto.findMany({
    where: { entryId },
    select: { sortOrder: true },
    orderBy: { sortOrder: "desc" },
  });
  if (photos.length >= MAX_PHOTOS) {
    throw new ApiError("CONFLICT", `每篇日记最多 ${MAX_PHOTOS} 张照片`, 409);
  }
  const sortOrder = (photos[0]?.sortOrder ?? -1) + 1;

  return prisma.diaryPhoto.create({
    data: {
      entryId,
      data: photo.data,
      mimeType: photo.mimeType,
      size: photo.size,
      sortOrder,
    },
  });
}

/** 删除某张照片并重排剩余顺序。 */
export async function removeDiaryPhoto(input: {
  author: SessionUser;
  entryId: number;
  photoId: number;
}) {
  const { author, entryId, photoId } = input;
  await getDiaryEntryForManage(author, entryId);

  const photos = await prisma.diaryPhoto.findMany({
    where: { entryId },
    select: { id: true },
    orderBy: { sortOrder: "asc" },
  });
  if (!photos.some((photo) => photo.id === photoId)) {
    throw new ApiError("NOT_FOUND", "照片不存在", 404);
  }
  const remaining = photos.filter((photo) => photo.id !== photoId);

  await prisma.$transaction([
    prisma.diaryPhoto.delete({ where: { id: photoId } }),
    ...remaining.map((photo, index) =>
      prisma.diaryPhoto.update({
        where: { id: photo.id },
        data: { sortOrder: index },
      }),
    ),
  ]);

  return { remaining: remaining.length };
}
