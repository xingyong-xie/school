import "server-only";

import type { Prisma, Role } from "@prisma/client";
import {
  teacherCanAccessClass,
  teacherCanAccessStudent,
} from "@/lib/guards";

export const MAX_PHOTOS = 6;
export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
export const MAX_TOTAL_PHOTO_BYTES = 8 * 1024 * 1024;
export const DIARY_MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export type PhotoInput = {
  data: Buffer;
  mimeType: string;
  size: number;
};

/** 通过魔数识别图片类型，避免只信任客户端声明的 MIME。 */
function sniffImageType(buffer: Buffer): string | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    )
  ) {
    return "image/png";
  }
  const head = buffer.subarray(0, 12).toString("ascii");
  if (head.startsWith("GIF87a") || head.startsWith("GIF89a")) {
    return "image/gif";
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

/** 读取表单中的 photos 文件并校验数量、大小与类型。 */
export async function readPhotoInputs(
  formData: FormData,
): Promise<{ ok: true; photos: PhotoInput[] } | { ok: false; error: string }> {
  const files = formData
    .getAll("photos")
    .filter((value): value is File => value instanceof File && value.size > 0);

  if (files.length > MAX_PHOTOS) {
    return { ok: false, error: `一次最多上传 ${MAX_PHOTOS} 张照片` };
  }

  const photos: PhotoInput[] = [];
  let totalBytes = 0;

  for (const file of files) {
    if (file.size > MAX_PHOTO_BYTES) {
      return { ok: false, error: "每张照片不能超过 2MB，请压缩后重试" };
    }

    const data = Buffer.from(await file.arrayBuffer());
    totalBytes += data.length;
    if (totalBytes > MAX_TOTAL_PHOTO_BYTES) {
      return { ok: false, error: "照片总大小不能超过 8MB，请压缩后重试" };
    }

    const declared = ALLOWED_IMAGE_TYPES.find((type) => type === file.type);
    const mimeType = sniffImageType(data) ?? declared ?? null;
    if (!mimeType) {
      return { ok: false, error: "仅支持 JPG / PNG / WebP / GIF 图片" };
    }

    photos.push({ data, mimeType, size: data.length });
  }

  return { ok: true, photos };
}

/**
 * 解码小程序上传的 base64 图片，类型只信任魔数。
 * 兼容带 `data:image/...;base64,` 前缀的字符串。
 */
export function decodeImageBase64(
  raw: unknown,
): { ok: true; photo: PhotoInput } | { ok: false; error: string } {
  if (typeof raw !== "string" || !raw) {
    return { ok: false, error: "照片数据不能为空" };
  }
  const payload = raw.startsWith("data:")
    ? raw.slice(raw.indexOf(",") + 1)
    : raw;
  if (!payload) return { ok: false, error: "照片数据不能为空" };

  const data = Buffer.from(payload.replace(/\s/g, ""), "base64");
  if (data.length === 0) {
    return { ok: false, error: "照片数据无效" };
  }
  if (data.length > MAX_PHOTO_BYTES) {
    return { ok: false, error: "每张照片不能超过 2MB，请压缩后重试" };
  }

  const mimeType = sniffImageType(data);
  if (!mimeType) {
    return { ok: false, error: "仅支持 JPG / PNG / WebP / GIF 图片" };
  }

  return { ok: true, photo: { data, mimeType, size: data.length } };
}

export type DiaryTargetType = "CHILD" | "CLASS";

/** 判断日记的关联对象：班级日记还是幼儿日记。 */
export function diaryEntryTarget(entry: {
  classId: number | null;
}): DiaryTargetType {
  return entry.classId !== null ? "CLASS" : "CHILD";
}

/** 列表筛选：幼儿筛选只看个人日记；班级筛选包含班级日记与该班幼儿的个人日记。 */
export function diaryTargetWhere(target: {
  studentId?: number;
  classId?: number;
}): Prisma.DiaryEntryWhereInput[] {
  const and: Prisma.DiaryEntryWhereInput[] = [];
  if (target.studentId) and.push({ studentId: target.studentId });
  if (target.classId) {
    and.push({
      OR: [
        { classId: target.classId },
        { student: { classId: target.classId } },
      ],
    });
  }
  return and;
}

/** 各角色可见的日记范围；返回 null 表示不限制（管理员）。 */
export function diaryScopeWhere(user: {
  id: number;
  role: Role;
}): Prisma.DiaryEntryWhereInput | null {
  if (user.role === "ADMIN") return null;
  if (user.role === "TEACHER") {
    return {
      OR: [
        { authorId: user.id },
        { student: { class: { teacher: { userId: user.id } } } },
        { class: { teacher: { userId: user.id } } },
      ],
    };
  }
  return {
    OR: [
      { student: { parentId: user.id } },
      { class: { students: { some: { parentId: user.id } } } },
    ],
  };
}

/** 是否有权以某个幼儿/班级为目标写日记。 */
export async function canManageDiaryTarget(
  user: { id: number; role: Role },
  target: { studentId: number | null; classId: number | null },
): Promise<boolean> {
  if (user.role === "ADMIN") return true;
  if (user.role !== "TEACHER") return false;
  if (target.studentId !== null) {
    return teacherCanAccessStudent(user.id, target.studentId);
  }
  if (target.classId !== null) {
    return teacherCanAccessClass(user.id, target.classId);
  }
  return false;
}

/** 是否有权编辑/删除某条日记（Action 与页面共用）。 */
export async function canManageDiaryEntry(
  user: { id: number; role: Role },
  entry: {
    studentId: number | null;
    classId: number | null;
    authorId: number | null;
  },
): Promise<boolean> {
  if (user.role === "ADMIN") return true;
  if (user.role !== "TEACHER") return false;
  if (entry.authorId === user.id) return true;
  if (entry.studentId !== null) {
    return teacherCanAccessStudent(user.id, entry.studentId);
  }
  if (entry.classId !== null) {
    return teacherCanAccessClass(user.id, entry.classId);
  }
  return false;
}

/** 图片地址：附带短时媒体令牌，供 Web <img> 与小程序 <image> 使用。 */
export function diaryMediaUrl(photoId: number, mediaToken: string): string {
  return `/api/diary-photos/${photoId}?mt=${encodeURIComponent(mediaToken)}`;
}
