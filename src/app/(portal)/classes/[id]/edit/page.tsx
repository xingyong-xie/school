import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/guards";
import { PageHeader } from "@/components/PageHeader";
import { Alert } from "@/components/Alert";
import { ClassForm } from "@/components/ClassForm";
import { getParam, type SearchParams } from "@/lib/params";

export const dynamic = "force-dynamic";

export default async function EditClassPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: SearchParams;
}) {
  await requireAdmin();
  const id = Number(params.id);
  if (!Number.isInteger(id)) notFound();

  const schoolClass = await prisma.schoolClass.findUnique({ where: { id } });
  if (!schoolClass) notFound();

  const error = getParam(searchParams, "error");
  const teachers = await prisma.teacher.findMany({
    include: { user: { select: { name: true } } },
    orderBy: { employeeNo: "asc" },
  });

  return (
    <>
      <PageHeader title={`编辑班级 · ${schoolClass.name}`} description="调整班级信息或主班教师。" />
      <Alert error={error} />
      <ClassForm
        mode="edit"
        schoolClass={{
          id: schoolClass.id,
          name: schoolClass.name,
          ageGroup: schoolClass.ageGroup,
          capacity: schoolClass.capacity,
          room: schoolClass.room,
          teacherId: schoolClass.teacherId,
        }}
        teachers={teachers.map((teacher) => ({
          id: teacher.id,
          name: teacher.user.name,
          employeeNo: teacher.employeeNo,
        }))}
      />
    </>
  );
}
