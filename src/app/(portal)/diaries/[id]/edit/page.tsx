import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/guards";
import { signMediaToken } from "@/lib/auth";
import { canManageDiaryEntry, diaryMediaUrl } from "@/lib/diary";
import { PageHeader } from "@/components/PageHeader";
import { Alert } from "@/components/Alert";
import { DiaryForm } from "@/components/DiaryForm";
import { updateDiary } from "@/actions/diaries";
import { getParam, type SearchParams } from "@/lib/params";

export const dynamic = "force-dynamic";

function safeReturnTo(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  if (/^\/diaries(\?.*)?$/.test(value)) return value;
  if (/^\/students\/\d+(\?.*)?$/.test(value)) return value;
  return fallback;
}

export default async function EditDiaryPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: SearchParams;
}) {
  const user = await requireUser();
  if (user.role === "PARENT") {
    redirect("/?error=" + encodeURIComponent("家长无权编辑成长日记"));
  }

  const id = Number(params.id);
  if (!Number.isInteger(id)) notFound();

  const entry = await prisma.diaryEntry.findUnique({
    where: { id },
    select: {
      id: true,
      studentId: true,
      classId: true,
      authorId: true,
      date: true,
      title: true,
      content: true,
      mood: true,
      student: { select: { name: true, class: { select: { name: true } } } },
      class: { select: { name: true } },
      photos: { select: { id: true }, orderBy: { sortOrder: "asc" } },
    },
  });
  if (!entry) notFound();

  if (!(await canManageDiaryEntry(user, entry))) {
    redirect("/diaries?error=" + encodeURIComponent("无权编辑该日记"));
  }

  const targetLabel =
    entry.classId !== null
      ? `全班 · ${entry.class?.name ?? "未分班"}`
      : `${entry.student?.name ?? "幼儿"} · ${entry.student?.class?.name ?? "未分班"}`;

  const error = getParam(searchParams, "error");
  const returnTo = safeReturnTo(
    getParam(searchParams, "returnTo"),
    `/diaries`,
  );
  const mediaToken = signMediaToken(user);

  return (
    <>
      <PageHeader
        title="编辑成长日记"
        description={`${targetLabel} · ${entry.date}`}
        actions={
          <Link href={returnTo} className="btn btn-secondary">
            返回
          </Link>
        }
      />
      <Alert error={error} />

      <DiaryForm
        mode="edit"
        action={updateDiary}
        returnTo={returnTo}
        entry={{
          id: entry.id,
          studentId: entry.studentId,
          classId: entry.classId,
          targetLabel,
          date: entry.date,
          title: entry.title,
          content: entry.content,
          mood: entry.mood,
          photos: entry.photos.map((photo) => ({
            id: photo.id,
            url: diaryMediaUrl(photo.id, mediaToken),
          })),
        }}
      />
    </>
  );
}
