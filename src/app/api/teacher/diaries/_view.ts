import type { DiaryMood } from "@prisma/client";
import type { SessionUser } from "@/lib/auth";
import { DIARY_MOOD_LABELS, categoryTone } from "@/lib/constants";
import {
  canManageDiaryEntry,
  diaryEntryTarget,
  diaryMediaUrl,
} from "@/lib/diary";

export const diaryEntryInclude = {
  student: { select: { id: true, name: true } },
  class: { select: { id: true, name: true } },
  author: { select: { id: true, name: true } },
  photos: {
    select: { id: true, sortOrder: true },
    orderBy: { sortOrder: "asc" as const },
  },
} as const;

export type DiaryEntryViewInput = {
  id: number;
  studentId: number | null;
  classId: number | null;
  date: string;
  title: string | null;
  content: string;
  mood: DiaryMood | null;
  authorId: number | null;
  createdAt: Date;
  updatedAt: Date;
  student: { id: number; name: string } | null;
  class: { id: number; name: string } | null;
  author: { id: number; name: string } | null;
  photos: { id: number; sortOrder: number }[];
};

export async function diaryEntryView(
  entry: DiaryEntryViewInput,
  user: SessionUser,
  mediaToken: string,
) {
  const canManage = await canManageDiaryEntry(user, entry);
  return {
    id: entry.id,
    target: diaryEntryTarget(entry),
    studentId: entry.studentId,
    studentName: entry.student?.name ?? null,
    classId: entry.classId,
    className: entry.class?.name ?? null,
    date: entry.date,
    title: entry.title,
    content: entry.content,
    mood: entry.mood,
    moodLabel: entry.mood ? DIARY_MOOD_LABELS[entry.mood] : null,
    moodTone: entry.mood ? categoryTone(entry.mood) : null,
    authorId: entry.authorId,
    authorName: entry.author?.name ?? null,
    isMine: entry.authorId === user.id,
    canEdit: canManage,
    canDelete: canManage,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
    photos: entry.photos.map((photo) => ({
      id: photo.id,
      sortOrder: photo.sortOrder,
      url: diaryMediaUrl(photo.id, mediaToken),
    })),
  };
}
