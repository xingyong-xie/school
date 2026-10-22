import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/guards";
import { PageHeader } from "@/components/PageHeader";
import { Alert } from "@/components/Alert";
import { TeacherForm } from "@/components/TeacherForm";
import { getParam, type SearchParams } from "@/lib/params";

export const dynamic = "force-dynamic";

export default async function EditTeacherPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: SearchParams;
}) {
  await requireAdmin();
  const id = Number(params.id);
  if (!Number.isInteger(id)) notFound();

  const teacher = await prisma.teacher.findUnique({
    where: { id },
    include: { user: true },
  });
  if (!teacher) notFound();

  const error = getParam(searchParams, "error");

  return (
    <>
      <PageHeader
        title={`编辑教师 · ${teacher.user.name}`}
        description="修改教师资料或重置登录密码。"
      />
      <Alert error={error} />
      <TeacherForm
        mode="edit"
        teacher={{
          id: teacher.id,
          name: teacher.user.name,
          employeeNo: teacher.employeeNo,
          specialty: teacher.specialty,
          phone: teacher.phone,
          username: teacher.user.username,
        }}
      />
    </>
  );
}
