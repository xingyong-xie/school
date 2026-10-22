import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/guards";
import { PageHeader } from "@/components/PageHeader";
import { Alert } from "@/components/Alert";
import { ClassForm } from "@/components/ClassForm";
import { getParam, type SearchParams } from "@/lib/params";

export const dynamic = "force-dynamic";

export default async function NewClassPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  await requireAdmin();
  const error = getParam(searchParams, "error");

  const teachers = await prisma.teacher.findMany({
    include: { user: { select: { name: true } } },
    orderBy: { employeeNo: "asc" },
  });

  return (
    <>
      <PageHeader title="新增班级" description="创建班级并指定主班教师。" />
      <Alert error={error} />
      <ClassForm
        mode="create"
        teachers={teachers.map((teacher) => ({
          id: teacher.id,
          name: teacher.user.name,
          employeeNo: teacher.employeeNo,
        }))}
      />
    </>
  );
}
