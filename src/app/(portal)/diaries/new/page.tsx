import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser, teacherClassIds } from "@/lib/guards";
import { PageHeader } from "@/components/PageHeader";
import { Alert } from "@/components/Alert";
import { EmptyState } from "@/components/EmptyState";
import { DiaryForm } from "@/components/DiaryForm";
import type { DiaryTargetType } from "@/components/DiaryTargetPicker";
import { createDiary } from "@/actions/diaries";
import { getIntParam, getParam, type SearchParams } from "@/lib/params";

export const dynamic = "force-dynamic";

function safeReturnTo(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  if (/^\/diaries(\?.*)?$/.test(value)) return value;
  if (/^\/students\/\d+(\?.*)?$/.test(value)) return value;
  return fallback;
}

export default async function NewDiaryPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const user = await requireUser();
  if (user.role === "PARENT") {
    redirect("/?error=" + encodeURIComponent("家长无权发布成长日记"));
  }

  const error = getParam(searchParams, "error");
  const defaultStudentId = getIntParam(searchParams, "studentId");
  const defaultClassId = getIntParam(searchParams, "classId");
  const returnTo = safeReturnTo(getParam(searchParams, "returnTo"), "/diaries");

  const classIds =
    user.role === "TEACHER" ? await teacherClassIds(user.id) : undefined;

  const [students, classes] = await Promise.all([
    prisma.student.findMany({
      where: {
        status: "ACTIVE",
        ...(classIds ? { classId: { in: classIds } } : {}),
      },
      select: { id: true, name: true, class: { select: { name: true } } },
      orderBy: [{ classId: "asc" }, { name: "asc" }],
    }),
    prisma.schoolClass.findMany({
      where: classIds ? { id: { in: classIds } } : {},
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const visibleDefaultStudent = students.some(
    (student) => student.id === defaultStudentId,
  )
    ? defaultStudentId
    : undefined;
  const visibleDefaultClass = classes.some((item) => item.id === defaultClassId)
    ? defaultClassId
    : undefined;
  const defaultType: DiaryTargetType =
    visibleDefaultClass && !visibleDefaultStudent
      ? "CLASS"
      : students.length
        ? "CHILD"
        : "CLASS";

  return (
    <>
      <PageHeader
        title="写成长日记"
        description="可记录单个幼儿，也可记录整个班级的集体活动与通知。"
        actions={
          <Link href={returnTo} className="btn btn-secondary">
            返回
          </Link>
        }
      />
      <Alert error={error} />

      {students.length || classes.length ? (
        <DiaryForm
          mode="create"
          action={createDiary}
          students={students.map((student) => ({
            id: student.id,
            name: student.name,
            className: student.class?.name ?? null,
          }))}
          classes={classes}
          defaultType={defaultType}
          defaultStudentId={visibleDefaultStudent}
          defaultClassId={visibleDefaultClass}
          returnTo={returnTo}
        />
      ) : (
        <section className="card">
          <EmptyState
            title="暂无可记录的对象"
            description="请先在幼儿档案中创建幼儿并分班。"
          />
        </section>
      )}
    </>
  );
}
