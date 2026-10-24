import { prisma } from "@/lib/db";
import { handle, monthParam, requireChild, requireParent } from "@/lib/api";
import { ok } from "@/lib/json";
import { categoryTone, DIARY_MOOD_LABELS } from "@/lib/constants";
import { diaryEntryTarget, diaryMediaUrl } from "@/lib/diary";
import { signMediaToken } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  return handle(async () => {
    const user = await requireParent();
    const child = await requireChild(user, Number(params.id));
    const month = monthParam(new URL(request.url).searchParams.get("month"));
    const mediaToken = signMediaToken(user);

    const target = child.classId
      ? {
          OR: [
            { studentId: child.id },
            { studentId: null, classId: child.classId },
          ],
        }
      : { studentId: child.id };

    const entries = await prisma.diaryEntry.findMany({
      where: {
        AND: [
          target,
          { date: { gte: `${month}-01`, lte: `${month}-31` } },
        ],
      },
      include: {
        class: { select: { name: true } },
        author: { select: { name: true } },
        photos: { select: { id: true }, orderBy: { sortOrder: "asc" } },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 100,
    });

    const photoCount = entries.reduce((sum, entry) => sum + entry.photos.length, 0);
    const activeDays = new Set(entries.map((entry) => entry.date)).size;
    const classEntryCount = entries.filter(
      (entry) => entry.classId !== null,
    ).length;

    return ok({
      month,
      child: { id: child.id, name: child.name },
      summary: {
        entryCount: entries.length,
        photoCount,
        activeDays,
        classEntryCount,
      },
      entries: entries.map((entry) => ({
        id: entry.id,
        target: diaryEntryTarget(entry),
        className: entry.class?.name ?? null,
        date: entry.date,
        title: entry.title,
        content: entry.content,
        mood: entry.mood,
        moodLabel: entry.mood ? DIARY_MOOD_LABELS[entry.mood] : null,
        moodTone: entry.mood ? categoryTone(entry.mood) : null,
        authorName: entry.author?.name ?? null,
        createdAt: entry.createdAt.toISOString(),
        photos: entry.photos.map((photo) => ({
          id: photo.id,
          url: diaryMediaUrl(photo.id, mediaToken),
        })),
      })),
    });
  });
}
