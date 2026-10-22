import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/guards";
import { PageHeader } from "@/components/PageHeader";
import { Alert } from "@/components/Alert";
import { StudentForm } from "@/components/StudentForm";
import { getParam, type SearchParams } from "@/lib/params";

export const dynamic = "force-dynamic";

export default async function EditStudentPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: SearchParams;
}) {
  await requireAdmin();
  const id = Number(params.id);
  if (!Number.isInteger(id)) notFound();

  const error = getParam(searchParams, "error");
  const student = await prisma.student.findUnique({ where: { id } });
  if (!student) notFound();

  const [classes, parents] = await Promise.all([
    prisma.schoolClass.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { role: "PARENT" },
      select: { id: true, name: true, phone: true, username: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <>
      <PageHeader
        title={`编辑档案 · ${student.name}`}
        description="修改幼儿基本信息或重新关联家长账号。"
      />
      <Alert error={error} />
      <StudentForm
        mode="edit"
        classes={classes}
        parents={parents}
        student={{
          id: student.id,
          studentNo: student.studentNo,
          name: student.name,
          gender: student.gender,
          birthDate: student.birthDate.toISOString().slice(0, 10),
          status: student.status,
          classId: student.classId,
          phone: student.phone,
          address: student.address,
          notes: student.notes,
          parentId: student.parentId,
        }}
      />
    </>
  );
}
